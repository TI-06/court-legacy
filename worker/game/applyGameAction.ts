import { gameDataBootstrap } from "../../src/data/gameData";
import { advanceGameWeek } from "../../src/domain/calendar/academicYearProgression";
import {
  isWeeklyActionCompleted,
  markWeeklyActionCompleted,
} from "../../src/domain/calendar/weekProgression";
import { surfaceWeeklyEvent } from "../../src/domain/events/eventPipeline";
import { resolveEventChoice } from "../../src/domain/events/resolveEventChoice";
import { simulateMatch } from "../../src/domain/match/simulateMatch";
import type { GameState } from "../../src/domain/model/GameState";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import { matchId } from "../../src/domain/model/identifiers";
import { SeededRandom } from "../../src/domain/random/SeededRandom";
import { selectPracticeOpponent } from "../../src/domain/selectors/matchSelectors";
import {
  evaluateFacilityUpgrade,
  upgradeFacility,
} from "../../src/domain/school/facilityUpgrade";
import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";
import { validateTeamSelection } from "../../src/domain/team/validateTeamSelection";
import { materializeGuestOpponent } from "../../src/domain/tournament/materializeGuestOpponent";
import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
  hasRequiredOfficialMatch,
} from "../../src/domain/tournament/progressOfficialTournaments";
import { recordOfficialTournamentOutcome } from "../../src/domain/tournament/recordOfficialMatch";
import type { AdditionalGrowthModifier } from "../../src/domain/training/calculateGrowth";
import { resolveWeeklyTraining } from "../../src/domain/training/resolveWeeklyTraining";
import { recordMatchOutcome } from "../../src/domain/world/rivalWorldProgression";
import type { CloudGameSnapshot } from "../data/GameStore";
import type { GameAction } from "./actionSchema";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const gameData = gameDataBootstrap.data;

export class GameRuleConflictError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GameRuleConflictError";
  }
}

export interface AppliedGameAction {
  state: GameState;
  teamSelection: TeamSelection;
  outcome?: unknown;
}

function cloneTeamSelection(selection: TeamSelection): TeamSelection {
  return {
    rotation: selection.rotation.map((assignment) => ({ ...assignment })),
    liberoPlayerId: selection.liberoPlayerId,
    benchPlayerIds: [...selection.benchPlayerIds],
    servingOrderPlayerIds: [...selection.servingOrderPlayerIds],
    substitutionPolicy: {
      ...selection.substitutionPolicy,
      starterLockPlayerIds: [
        ...selection.substitutionPolicy.starterLockPlayerIds,
      ],
    },
  };
}

function conflict(code: string, message: string): never {
  throw new GameRuleConflictError(code, message);
}

function trainingGrowthModifiers(state: GameState): AdditionalGrowthModifier[] {
  const pendingBoost = state.shopEffects?.nextTrainingGrowthBoost;
  if (!pendingBoost) {
    return [];
  }

  return [
    {
      code: "shop-training-boost",
      label: "練習効率アップ",
      percent: 100 + pendingBoost.percent,
    },
  ];
}

function consumeNextTrainingGrowthBoost(state: GameState): GameState {
  if (!state.shopEffects?.nextTrainingGrowthBoost) {
    return state;
  }

  return {
    ...state,
    shopEffects: undefined,
  };
}

function applyTraining(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "training" }>,
): AppliedGameAction {
  if (isWeeklyActionCompleted(state, "training")) {
    return conflict("training_already_completed", "今週の練習は完了しています");
  }

  const random = new SeededRandom(state.seed, state.randomCursor);
  try {
    const resolution = resolveWeeklyTraining({
      state,
      schoolId: state.userSchoolId,
      plan: action.plan,
      data: gameData,
      random,
      additionalGrowthModifiers: trainingGrowthModifiers(state),
    });
    const resolvedState = consumeNextTrainingGrowthBoost(resolution.state);
    return {
      state: markWeeklyActionCompleted(resolvedState, "training"),
      teamSelection,
      outcome: resolution.result,
    };
  } catch (error) {
    return conflict(
      "invalid_training_plan",
      error instanceof Error ? error.message : "練習計画を実行できません",
    );
  }
}

function applyTeamSelection(
  state: GameState,
  action: Extract<GameAction, { type: "team-selection" }>,
): AppliedGameAction {
  const selection = cloneTeamSelection(action.selection);
  const issues = validateTeamSelection({
    state,
    schoolId: state.userSchoolId,
    selection,
  });
  if (issues.length > 0) {
    return conflict("invalid_team_selection", issues[0]!.message);
  }

  return { state, teamSelection: selection };
}

function applyPracticeMatch(
  state: GameState,
  teamSelection: TeamSelection,
): AppliedGameAction {
  if (isWeeklyActionCompleted(state, "practice-match")) {
    return conflict(
      "practice_match_already_completed",
      "今週の練習試合は完了しています",
    );
  }

  try {
    const opponent = selectPracticeOpponent(state);
    const opponentSelection = autoSelectTeam({
      state,
      schoolId: opponent.id,
    });
    const id = matchId(`practice-${state.date}-${state.randomCursor}`);
    const random = new SeededRandom(state.seed, state.randomCursor);
    const simulation = simulateMatch({
      state,
      id,
      homeSchoolId: state.userSchoolId,
      awaySchoolId: opponent.id,
      homeSelection: teamSelection,
      awaySelection: opponentSelection,
      bestOfSets: 3,
      random,
    });
    const matchState: GameState = {
      ...state,
      randomCursor: simulation.match.randomCursor,
      activeMatch: simulation.match,
    };
    const recorded = recordMatchOutcome(matchState, {
      matchId: simulation.match.id,
      date: state.date,
      homeSchoolId: simulation.match.homeSchoolId,
      awaySchoolId: simulation.match.awaySchoolId,
      winnerSchoolId: simulation.analysis.winnerSchoolId,
      homeSetsWon: simulation.match.homeSetsWon,
      awaySetsWon: simulation.match.awaySetsWon,
      tournamentId: null,
    });

    return {
      state: markWeeklyActionCompleted(recorded, "practice-match"),
      teamSelection,
      outcome: simulation,
    };
  } catch (error) {
    return conflict(
      "practice_match_unavailable",
      error instanceof Error ? error.message : "練習試合を実行できません",
    );
  }
}

function applyOfficialMatch(
  state: GameState,
  teamSelection: TeamSelection,
): AppliedGameAction {
  const due = findDueUserOfficialMatch(state);
  if (!due) {
    return conflict("official_match_not_due", "現在開始できる公式戦がありません");
  }
  if (!isWeeklyActionCompleted(state, "training")) {
    return conflict(
      "official_match_training_required",
      "公式戦の前に今週の練習を完了してください",
    );
  }

  const issues = validateTeamSelection({
    state,
    schoolId: state.userSchoolId,
    selection: teamSelection,
  });
  if (issues.length > 0) {
    return conflict("invalid_team_selection", issues[0]!.message);
  }

  try {
    const opponentContext =
      due.opponent.source === "world-school"
        ? {
            state,
            schoolId: due.opponent.schoolId,
            selection: autoSelectTeam({
              state,
              schoolId: due.opponent.schoolId,
            }),
          }
        : (() => {
            const materialized = materializeGuestOpponent({
              state,
              entrant: due.opponent,
              data: gameData,
            });
            return {
              state: materialized.temporaryState,
              schoolId: materialized.school.id,
              selection: materialized.selection,
            };
          })();
    const userIsHome =
      due.match.homeEntrantId === due.userEntrant.entrantId;
    const id = matchId(due.match.id);
    const random = new SeededRandom(state.seed).fork(
      `match:${due.stage.tournamentId}:${due.match.id}`,
    );
    const simulation = simulateMatch({
      state: opponentContext.state,
      id,
      homeSchoolId: userIsHome ? state.userSchoolId : opponentContext.schoolId,
      awaySchoolId: userIsHome ? opponentContext.schoolId : state.userSchoolId,
      homeSelection: userIsHome ? teamSelection : opponentContext.selection,
      awaySelection: userIsHome ? opponentContext.selection : teamSelection,
      bestOfSets: 3,
      random,
    });
    const recorded = recordOfficialTournamentOutcome({
      state,
      circuit: due.circuit,
      level: due.level,
      bracketMatchId: due.match.id,
      match: simulation.match,
    });
    const progressed = advanceOfficialTournamentsThroughWeek(recorded);

    return {
      state: progressed,
      teamSelection,
      outcome: {
        officialMatch: {
          tournamentId: due.stage.tournamentId,
          circuit: due.circuit,
          level: due.level,
          round: due.match.round,
          opponent: {
            entrantId: due.opponent.entrantId,
            source: due.opponent.source,
            displayName: due.opponent.displayName,
            shortName: due.opponent.shortName,
          },
        },
        simulation,
      },
    };
  } catch (error) {
    if (error instanceof GameRuleConflictError) {
      throw error;
    }
    return conflict(
      "official_match_unavailable",
      error instanceof Error ? error.message : "公式戦を実行できません",
    );
  }
}

function applyAdvanceWeek(
  state: GameState,
  teamSelection: TeamSelection,
): AppliedGameAction {
  if (!isWeeklyActionCompleted(state, "training")) {
    return conflict(
      "training_required",
      "週を進める前に今週の練習を完了してください",
    );
  }
  if (hasRequiredOfficialMatch(state)) {
    return conflict(
      "official_match_required",
      "週を進める前に現在の公式戦を完了してください",
    );
  }

  try {
    const progression = advanceGameWeek(state, gameData);
    const nextState = progression.academicYearTransition
      ? progression.state
      : surfaceWeeklyEvent(progression.state, gameData);
    const nextSelection = progression.academicYearTransition
      ? autoSelectTeam({ state: nextState, schoolId: nextState.userSchoolId })
      : teamSelection;

    return {
      state: nextState,
      teamSelection: nextSelection,
      outcome: {
        academicYearTransition: progression.academicYearTransition,
        recoveredPlayerIds: progression.recoveredPlayerIds,
        healedPlayerIds: progression.healedPlayerIds,
      },
    };
  } catch (error) {
    return conflict(
      "advance_week_unavailable",
      error instanceof Error ? error.message : "週を進められません",
    );
  }
}

function applyFacilityUpgrade(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "facility-upgrade" }>,
): AppliedGameAction {
  const evaluation = evaluateFacilityUpgrade(
    state,
    state.userSchoolId,
    action.facility,
  );
  if (!evaluation.allowed) {
    return conflict(
      `facility_${evaluation.reason}`,
      "この施設は現在アップグレードできません",
    );
  }

  return {
    state: upgradeFacility(state, state.userSchoolId, action.facility),
    teamSelection,
    outcome: evaluation,
  };
}

function applyEventChoice(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "event-choice" }>,
): AppliedGameAction {
  if (!state.pendingEvent) {
    return conflict("event_not_pending", "選択待ちのイベントがありません");
  }

  try {
    const random = new SeededRandom(state.seed, state.randomCursor);
    const resolution = resolveEventChoice(
      state,
      action.choiceId,
      gameData,
      random,
    );
    return {
      state: resolution.state,
      teamSelection,
      outcome: resolution.occurrence,
    };
  } catch (error) {
    return conflict(
      "invalid_event_choice",
      error instanceof Error ? error.message : "イベントを処理できません",
    );
  }
}

export function applyGameAction(
  snapshot: CloudGameSnapshot,
  action: GameAction,
): AppliedGameAction {
  const state = structuredClone(snapshot.state) as GameState;
  const teamSelection = cloneTeamSelection(snapshot.teamSelection);

  switch (action.type) {
    case "training":
      return applyTraining(state, teamSelection, action);
    case "team-selection":
      return applyTeamSelection(state, action);
    case "practice-match":
      return applyPracticeMatch(state, teamSelection);
    case "official-match":
      return applyOfficialMatch(state, teamSelection);
    case "advance-week":
      return applyAdvanceWeek(state, teamSelection);
    case "facility-upgrade":
      return applyFacilityUpgrade(state, teamSelection, action);
    case "event-choice":
      return applyEventChoice(state, teamSelection, action);
  }
}
