import { gameDataBootstrap } from "../../src/data/gameData";
import { advanceGameWeek } from "../../src/domain/calendar/academicYearProgression";
import type {
  AdvanceWeekOutcome,
  PendingMatchPresentation,
} from "../../src/domain/calendar/advanceWeekOutcome";
import {
  isWeeklyActionCompleted,
  markWeeklyActionCompleted,
} from "../../src/domain/calendar/weekProgression";
import {
  setTeamLeadership,
  TeamLeadershipValidationError,
} from "../../src/domain/dynamics/setTeamLeadership";
import { buildPveDynamicsReadinessByPlayerId } from "../../src/domain/dynamics/officialMatchDynamics";
import { surfaceWeeklyEvent } from "../../src/domain/events/eventPipeline";
import { resolveEventChoice } from "../../src/domain/events/resolveEventChoice";
import {
  applyMatchCommand,
  MatchCommandValidationError,
} from "../../src/domain/match/applyMatchCommand";
import {
  resumeMatch,
  simulateMatch,
  startMatch,
  type MatchStepResult,
  type SimulateMatchResult,
} from "../../src/domain/match/simulateMatch";
import type { GameState } from "../../src/domain/model/GameState";
import type { Player } from "../../src/domain/model/Player";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import { matchId } from "../../src/domain/model/identifiers";
import {
  appendNotification,
  buildTrainingResultNotification,
  markNotificationRead,
} from "../../src/domain/notifications/gameNotifications";
import {
  appendPlayerDevelopmentWeek,
  buildPlayerDevelopmentWeek,
} from "../../src/domain/player/playerDevelopmentHistory";
import { SeededRandom } from "../../src/domain/random/SeededRandom";
import {
  contractAssistantCoach,
  evaluateAssistantCoachContract,
} from "../../src/domain/school/assistantCoach";
import {
  evaluateFacilityUpgrade,
  upgradeFacility,
} from "../../src/domain/school/facilityUpgrade";
import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";
import { applyMatchTacticPlan } from "../../src/domain/team/matchTactics";
import {
  deleteLineupPreset,
  saveLineupPreset,
  setDevelopmentPriorities,
  TeamPlanningValidationError,
} from "../../src/domain/team/teamPlanning";
import { validateTeamSelection } from "../../src/domain/team/validateTeamSelection";
import { materializeGuestOpponent } from "../../src/domain/tournament/materializeGuestOpponent";
import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
  hasRequiredOfficialMatch,
  type DueUserOfficialMatch,
} from "../../src/domain/tournament/progressOfficialTournaments";
import { recordOfficialTournamentOutcome } from "../../src/domain/tournament/recordOfficialMatch";
import type { AdditionalGrowthModifier } from "../../src/domain/training/calculateGrowth";
import {
  resolveWeeklyTraining,
  type TrainingResult,
} from "../../src/domain/training/resolveWeeklyTraining";
import {
  acceptIncomingPracticeOffer,
  declineIncomingPracticeOffer,
  PracticeSchedulingError,
  requestPracticeMatch,
} from "../../src/domain/weekly/practiceMatchScheduling";
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

export interface ApplyGameActionContext {
  userIntake?: readonly Player[];
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
    const developmentWeek = buildPlayerDevelopmentWeek({
      stateBeforeTraining: state,
      result: resolution.result,
    });
    const stateWithDevelopmentHistory: GameState = {
      ...resolvedState,
      history: {
        ...resolvedState.history,
        playerDevelopmentWeeks: appendPlayerDevelopmentWeek(
          resolvedState.history.playerDevelopmentWeeks,
          developmentWeek,
        ),
      },
    };
    return {
      state: markWeeklyActionCompleted(stateWithDevelopmentHistory, "training"),
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

function applyTrainingPlan(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "set-training-plan" }>,
): AppliedGameAction {
  return {
    state: {
      ...state,
      weeklySchedule: {
        ...state.weeklySchedule,
        trainingPlan: structuredClone(action.plan),
      },
    },
    teamSelection,
    outcome: { plan: action.plan },
  };
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

function applyTeamTactics(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "set-team-tactics" }>,
): AppliedGameAction {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    return conflict("user_school_not_found", "自校の戦術を更新できません");
  }

  return {
    state: {
      ...state,
      schools: {
        ...state.schools,
        [school.id]: {
          ...school,
          tactics: applyMatchTacticPlan(school.tactics, action.plan),
        },
      },
    },
    teamSelection,
  };
}

function applyTeamLeadership(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "set-team-leadership" }>,
): AppliedGameAction {
  try {
    const nextState = setTeamLeadership(
      state,
      action.captainPlayerId,
      action.viceCaptainPlayerId,
    );
    return {
      state: nextState,
      teamSelection,
      outcome: {
        captainPlayerId: action.captainPlayerId,
        viceCaptainPlayerId: action.viceCaptainPlayerId,
        cohesion: nextState.teamDynamics.cohesion,
      },
    };
  } catch (error) {
    if (error instanceof TeamLeadershipValidationError) {
      return conflict(error.code, error.message);
    }
    throw error;
  }
}

function applyTeamPlanning(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<
    GameAction,
    {
      type:
        | "set-development-priorities"
        | "save-lineup-preset"
        | "delete-lineup-preset";
    }
  >,
): AppliedGameAction {
  try {
    const nextState =
      action.type === "set-development-priorities"
        ? setDevelopmentPriorities(state, action.playerIds)
        : action.type === "save-lineup-preset"
          ? saveLineupPreset(state, action)
          : deleteLineupPreset(state, action.slot);
    return {
      state: nextState,
      teamSelection,
    };
  } catch (error) {
    if (error instanceof TeamPlanningValidationError) {
      return conflict(error.code.replaceAll("-", "_"), error.message);
    }
    throw error;
  }
}

function applyPracticeScheduling(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<
    GameAction,
    {
      type:
        "practice-offer-accept" | "practice-offer-decline" | "practice-request";
    }
  >,
): AppliedGameAction {
  try {
    const resolution =
      action.type === "practice-offer-accept"
        ? acceptIncomingPracticeOffer(state)
        : action.type === "practice-offer-decline"
          ? declineIncomingPracticeOffer(state)
          : requestPracticeMatch(state, action.schoolId);

    return {
      state: resolution.state,
      teamSelection,
      outcome: resolution.outcome,
    };
  } catch (error) {
    if (error instanceof PracticeSchedulingError) {
      return conflict(error.code, error.message);
    }
    throw error;
  }
}

function startPracticeMatchSession(
  state: GameState,
  teamSelection: TeamSelection,
): AppliedGameAction {
  if (isWeeklyActionCompleted(state, "practice-match")) {
    return conflict(
      "practice_match_already_completed",
      "今週の練習試合は完了しています",
    );
  }

  if (state.activeMatch && state.activeMatch.phase !== "match-complete") {
    return conflict(
      "match_already_in_progress",
      "進行中の試合を完了してください",
    );
  }

  const scheduledOpponentId =
    state.weeklySchedule.practiceMatch.scheduledOpponentId;
  if (!scheduledOpponentId) {
    return conflict(
      "practice_match_not_scheduled",
      "練習試合の対戦相手を決めてください",
    );
  }

  try {
    const opponent = state.schools[scheduledOpponentId];
    if (!opponent) {
      throw new Error("scheduled practice opponent not found");
    }
    const opponentSelection = autoSelectTeam({
      state,
      schoolId: opponent.id,
    });
    const id = matchId(`practice-${state.date}-${state.randomCursor}`);
    const random = new SeededRandom(state.seed, state.randomCursor);
    const simulation = startMatch({
      state,
      id,
      homeSchoolId: state.userSchoolId,
      awaySchoolId: opponent.id,
      homeSelection: teamSelection,
      awaySelection: opponentSelection,
      bestOfSets: 3,
      random,
      controlledSchoolId: state.userSchoolId,
    });

    return {
      state: {
        ...state,
        randomCursor: simulation.match.randomCursor,
        activeMatch: simulation.match,
      },
      teamSelection,
      outcome: simulation,
    };
  } catch (error) {
    if (error instanceof GameRuleConflictError) {
      throw error;
    }
    return conflict(
      "practice_match_unavailable",
      error instanceof Error ? error.message : "練習試合を開始できません",
    );
  }
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

  const scheduledOpponentId =
    state.weeklySchedule.practiceMatch.scheduledOpponentId;
  if (!scheduledOpponentId) {
    return conflict(
      "practice_match_not_scheduled",
      "練習試合の対戦相手を決めてください",
    );
  }

  try {
    const opponent = state.schools[scheduledOpponentId];
    if (!opponent) {
      throw new Error("scheduled practice opponent not found");
    }
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

    const completedState = markWeeklyActionCompleted(
      recorded,
      "practice-match",
    );
    return {
      state: {
        ...completedState,
        weeklySchedule: {
          ...completedState.weeklySchedule,
          practiceMatch: {
            ...completedState.weeklySchedule.practiceMatch,
            scheduledOpponentId: null,
            scheduledBy: null,
          },
          recentPracticeMatches: [
            ...completedState.weeklySchedule.recentPracticeMatches,
            {
              opponentSchoolId: scheduledOpponentId,
              date: state.date,
            },
          ].slice(-8),
        },
      },
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

function applyPracticeMatchCommand(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "match-command" }>,
): AppliedGameAction {
  const activeMatch = state.activeMatch;
  const scheduledOpponentId =
    state.weeklySchedule.practiceMatch.scheduledOpponentId;
  if (!activeMatch?.runtime || !scheduledOpponentId) {
    return conflict(
      "active_practice_match_not_found",
      "進行中の練習試合がありません",
    );
  }
  if (activeMatch.runtime.controlledSchoolId !== state.userSchoolId) {
    return conflict(
      "active_practice_match_not_controlled",
      "この試合では監督指示を実行できません",
    );
  }
  const opponentSchoolId =
    activeMatch.homeSchoolId === state.userSchoolId
      ? activeMatch.awaySchoolId
      : activeMatch.awaySchoolId === state.userSchoolId
        ? activeMatch.homeSchoolId
        : null;
  if (opponentSchoolId !== scheduledOpponentId) {
    return conflict(
      "active_practice_match_mismatch",
      "進行中の試合と練習試合予定が一致しません",
    );
  }

  try {
    const commandedMatch = applyMatchCommand({
      state,
      match: activeMatch,
      schoolId: state.userSchoolId,
      command: action.command,
    });
    const simulation = resumeMatch({ state, match: commandedMatch });
    const resumedState: GameState = {
      ...state,
      randomCursor: simulation.match.randomCursor,
      activeMatch: simulation.match,
    };

    if (!simulation.analysis) {
      return {
        state: resumedState,
        teamSelection,
        outcome: buildPracticePresentation(resumedState, simulation),
      };
    }

    const recorded = recordMatchOutcome(resumedState, {
      matchId: simulation.match.id,
      date: state.date,
      homeSchoolId: simulation.match.homeSchoolId,
      awaySchoolId: simulation.match.awaySchoolId,
      winnerSchoolId: simulation.analysis.winnerSchoolId,
      homeSetsWon: simulation.match.homeSetsWon,
      awaySetsWon: simulation.match.awaySetsWon,
      tournamentId: null,
    });
    const completedState = markWeeklyActionCompleted(
      recorded,
      "practice-match",
    );
    const finalizedState: GameState = {
      ...completedState,
      weeklySchedule: {
        ...completedState.weeklySchedule,
        practiceMatch: {
          ...completedState.weeklySchedule.practiceMatch,
          scheduledOpponentId: null,
          scheduledBy: null,
        },
        recentPracticeMatches: [
          ...completedState.weeklySchedule.recentPracticeMatches,
          {
            opponentSchoolId: scheduledOpponentId,
            date: state.date,
          },
        ].slice(-8),
      },
    };
    return {
      state: finalizedState,
      teamSelection,
      outcome: buildPracticePresentation(finalizedState, simulation),
    };
  } catch (error) {
    if (error instanceof MatchCommandValidationError) {
      return conflict(error.code.replaceAll("-", "_"), error.message);
    }
    if (error instanceof GameRuleConflictError) {
      throw error;
    }
    return conflict(
      "match_command_unavailable",
      error instanceof Error
        ? error.message
        : "試合中の監督指示を処理できません",
    );
  }
}

function buildOfficialSimulationContext(
  state: GameState,
  due: DueUserOfficialMatch,
) {
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
  return {
    ...opponentContext,
    userIsHome: due.match.homeEntrantId === due.userEntrant.entrantId,
  };
}

function buildOfficialActionOutcome(
  due: DueUserOfficialMatch,
  simulation: MatchStepResult,
) {
  return {
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
  };
}

function validateOfficialMatchStart(
  state: GameState,
  teamSelection: TeamSelection,
  due: DueUserOfficialMatch,
): void {
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
  if (
    state.activeMatch &&
    state.activeMatch.phase !== "match-complete" &&
    (state.activeMatch.id !== matchId(due.match.id) ||
      state.activeMatch.runtime?.controlledSchoolId !== state.userSchoolId)
  ) {
    return conflict(
      "match_already_in_progress",
      "進行中の試合を完了してください",
    );
  }
}

function applyOfficialMatch(
  state: GameState,
  teamSelection: TeamSelection,
): AppliedGameAction {
  const due = findDueUserOfficialMatch(state);
  if (!due) {
    return conflict(
      "official_match_not_due",
      "現在開始できる公式戦がありません",
    );
  }
  validateOfficialMatchStart(state, teamSelection, due);

  const existing = state.activeMatch;
  if (
    existing?.runtime &&
    existing.phase !== "match-complete" &&
    existing.id === matchId(due.match.id) &&
    existing.runtime.controlledSchoolId === state.userSchoolId
  ) {
    return {
      state,
      teamSelection,
      outcome: buildOfficialActionOutcome(due, {
        match: existing,
        analysis: null,
      }),
    };
  }

  try {
    const context = buildOfficialSimulationContext(state, due);
    const id = matchId(due.match.id);
    const random = new SeededRandom(state.seed).fork(
      `match:${due.stage.tournamentId}:${due.match.id}`,
    );
    const simulation = startMatch({
      state: context.state,
      id,
      homeSchoolId: context.userIsHome ? state.userSchoolId : context.schoolId,
      awaySchoolId: context.userIsHome ? context.schoolId : state.userSchoolId,
      homeSelection: context.userIsHome ? teamSelection : context.selection,
      awaySelection: context.userIsHome ? context.selection : teamSelection,
      bestOfSets: 3,
      random,
      controlledSchoolId: state.userSchoolId,
      dynamicsReadinessByPlayerId: buildPveDynamicsReadinessByPlayerId(state),
    });

    const startedState: GameState = {
      ...state,
      activeMatch: simulation.match,
    };
    return {
      state: startedState,
      teamSelection,
      outcome: buildOfficialActionOutcome(due, simulation),
    };
  } catch (error) {
    if (error instanceof GameRuleConflictError) {
      throw error;
    }
    return conflict(
      "official_match_unavailable",
      error instanceof Error ? error.message : "公式戦を開始できません",
    );
  }
}

function applyOfficialMatchCommand(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "match-command" }>,
): AppliedGameAction {
  const due = findDueUserOfficialMatch(state);
  const activeMatch = state.activeMatch;
  if (!due || !activeMatch?.runtime) {
    return conflict(
      "active_official_match_not_found",
      "進行中の公式戦がありません",
    );
  }
  if (
    activeMatch.id !== matchId(due.match.id) ||
    activeMatch.runtime.controlledSchoolId !== state.userSchoolId
  ) {
    return conflict(
      "active_official_match_mismatch",
      "進行中の試合と公式戦予定が一致しません",
    );
  }

  const context = buildOfficialSimulationContext(state, due);
  const expectedHomeSchoolId = context.userIsHome
    ? state.userSchoolId
    : context.schoolId;
  const expectedAwaySchoolId = context.userIsHome
    ? context.schoolId
    : state.userSchoolId;
  if (
    activeMatch.homeSchoolId !== expectedHomeSchoolId ||
    activeMatch.awaySchoolId !== expectedAwaySchoolId
  ) {
    return conflict(
      "active_official_match_participants_mismatch",
      "進行中の公式戦の対戦情報が一致しません",
    );
  }

  try {
    const commandedMatch = applyMatchCommand({
      state: context.state,
      match: activeMatch,
      schoolId: state.userSchoolId,
      command: action.command,
    });
    const simulation = resumeMatch({
      state: context.state,
      match: commandedMatch,
    });
    const resumedState: GameState = {
      ...state,
      activeMatch: simulation.match,
    };

    if (!simulation.analysis) {
      return {
        state: resumedState,
        teamSelection,
        outcome: buildOfficialPresentation(
          resumedState,
          buildOfficialActionOutcome(due, simulation),
        ),
      };
    }

    const recorded = recordOfficialTournamentOutcome({
      state: resumedState,
      circuit: due.circuit,
      level: due.level,
      bracketMatchId: due.match.id,
      match: simulation.match,
    });
    const progressed = advanceOfficialTournamentsThroughWeek(recorded);
    return {
      state: progressed,
      teamSelection,
      outcome: buildOfficialPresentation(
        progressed,
        buildOfficialActionOutcome(due, simulation),
      ),
    };
  } catch (error) {
    if (error instanceof MatchCommandValidationError) {
      return conflict(error.code.replaceAll("-", "_"), error.message);
    }
    if (error instanceof GameRuleConflictError) {
      throw error;
    }
    return conflict(
      "match_command_unavailable",
      error instanceof Error
        ? error.message
        : "公式戦の監督指示を処理できません",
    );
  }
}

function applyActiveMatchCommand(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "match-command" }>,
): AppliedGameAction {
  const activeMatch = state.activeMatch;
  if (!activeMatch?.runtime) {
    return conflict("active_match_not_found", "進行中の試合がありません");
  }

  const due = findDueUserOfficialMatch(state);
  if (due && activeMatch.id === matchId(due.match.id)) {
    return applyOfficialMatchCommand(state, teamSelection, action);
  }

  const scheduledOpponentId =
    state.weeklySchedule.practiceMatch.scheduledOpponentId;
  const activeOpponentId =
    activeMatch.homeSchoolId === state.userSchoolId
      ? activeMatch.awaySchoolId
      : activeMatch.awaySchoolId === state.userSchoolId
        ? activeMatch.homeSchoolId
        : null;
  if (scheduledOpponentId && activeOpponentId === scheduledOpponentId) {
    return applyPracticeMatchCommand(state, teamSelection, action);
  }

  return conflict(
    "active_match_context_mismatch",
    "進行中の試合を確認できません",
  );
}

function teamPresentation(
  state: GameState,
  schoolId: SimulateMatchResult["match"]["homeSchoolId"],
  fallback?: { displayName: string; shortName: string },
): PendingMatchPresentation["homeTeam"] {
  const school = state.schools[schoolId];
  if (school)
    return { schoolId, displayName: school.name, shortName: school.shortName };
  if (fallback) return { schoolId, ...fallback };
  throw new Error(`match presentation school not found: ${schoolId}`);
}
function buildPracticePresentation(
  state: GameState,
  simulation: MatchStepResult,
): PendingMatchPresentation {
  return {
    kind: "practice",
    simulation,
    homeTeam: teamPresentation(state, simulation.match.homeSchoolId),
    awayTeam: teamPresentation(state, simulation.match.awaySchoolId),
  };
}
function practicePresentation(
  state: GameState,
  applied: AppliedGameAction,
): PendingMatchPresentation {
  return buildPracticePresentation(state, applied.outcome as MatchStepResult);
}
function buildOfficialPresentation(
  state: GameState,
  outcome: ReturnType<typeof buildOfficialActionOutcome>,
): PendingMatchPresentation {
  const simulation = outcome.simulation;
  const fallback = {
    displayName: outcome.officialMatch.opponent.displayName,
    shortName: outcome.officialMatch.opponent.shortName,
  };
  return {
    kind: "official",
    simulation,
    homeTeam: teamPresentation(
      state,
      simulation.match.homeSchoolId,
      simulation.match.homeSchoolId === state.userSchoolId
        ? undefined
        : fallback,
    ),
    awayTeam: teamPresentation(
      state,
      simulation.match.awaySchoolId,
      simulation.match.awaySchoolId === state.userSchoolId
        ? undefined
        : fallback,
    ),
    official: {
      tournamentId: outcome.officialMatch.tournamentId,
      circuit: outcome.officialMatch.circuit,
      level: outcome.officialMatch.level,
      round: outcome.officialMatch.round,
    },
  };
}

function officialPresentation(
  state: GameState,
  applied: AppliedGameAction,
): PendingMatchPresentation {
  return buildOfficialPresentation(
    state,
    applied.outcome as ReturnType<typeof buildOfficialActionOutcome>,
  );
}

function hasUserOfficialMatchOnCurrentDate(state: GameState): boolean {
  return state.history.matches.some(
    (m) =>
      m.date === state.date &&
      m.tournamentId !== null &&
      (m.homeSchoolId === state.userSchoolId ||
        m.awaySchoolId === state.userSchoolId),
  );
}
function applyAdvanceWeek(
  state: GameState,
  teamSelection: TeamSelection,
  context: ApplyGameActionContext,
): AppliedGameAction {
  let currentState = state;
  let trainingResult: TrainingResult | undefined;
  if (!isWeeklyActionCompleted(currentState, "training")) {
    const before = currentState;
    const training = applyTraining(currentState, teamSelection, {
      type: "training",
      plan: currentState.weeklySchedule.trainingPlan,
    });
    const result = training.outcome as TrainingResult;
    const notification = buildTrainingResultNotification({
      stateBeforeTraining: before,
      result,
      data: gameData,
    });
    currentState = {
      ...training.state,
      notifications: appendNotification(
        training.state.notifications,
        notification,
      ),
    };
    trainingResult = result;
  }
  if (hasRequiredOfficialMatch(currentState)) {
    const official = applyOfficialMatch(currentState, teamSelection);
    const outcome: AdvanceWeekOutcome = {
      trainingResult,
      pendingMatchPresentation: officialPresentation(currentState, official),
      weekAdvanced: false,
      academicYearTransition: null,
      recoveredPlayerIds: [],
      healedPlayerIds: [],
    };
    return {
      state: official.state,
      teamSelection: official.teamSelection,
      outcome,
    };
  }
  if (
    currentState.weeklySchedule.practiceMatch.scheduledOpponentId !== null &&
    !isWeeklyActionCompleted(currentState, "practice-match") &&
    !hasUserOfficialMatchOnCurrentDate(currentState)
  ) {
    const practice = startPracticeMatchSession(currentState, teamSelection);
    const outcome: AdvanceWeekOutcome = {
      trainingResult,
      pendingMatchPresentation: practicePresentation(currentState, practice),
      weekAdvanced: false,
      academicYearTransition: null,
      recoveredPlayerIds: [],
      healedPlayerIds: [],
    };
    return {
      state: practice.state,
      teamSelection: practice.teamSelection,
      outcome,
    };
  }
  try {
    const progression = advanceGameWeek(currentState, gameData, {
      userIntake: context.userIntake,
    });
    const nextState = progression.academicYearTransition
      ? progression.state
      : surfaceWeeklyEvent(progression.state, gameData);
    const nextSelection = progression.academicYearTransition
      ? autoSelectTeam({ state: nextState, schoolId: nextState.userSchoolId })
      : teamSelection;
    const outcome: AdvanceWeekOutcome = {
      trainingResult,
      pendingMatchPresentation: null,
      weekAdvanced: true,
      academicYearTransition: progression.academicYearTransition,
      recoveredPlayerIds: progression.recoveredPlayerIds,
      healedPlayerIds: progression.healedPlayerIds,
    };
    return { state: nextState, teamSelection: nextSelection, outcome };
  } catch (error) {
    return conflict(
      "advance_week_unavailable",
      error instanceof Error ? error.message : "週を進められません",
    );
  }
}

function applyMarkNotificationRead(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "mark-notification-read" }>,
): AppliedGameAction {
  return {
    state: {
      ...state,
      notifications: markNotificationRead(
        state.notifications,
        action.notificationId,
        state.date,
      ),
    },
    teamSelection,
  };
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

function applyAssistantCoachContract(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "assistant-coach-contract" }>,
): AppliedGameAction {
  const evaluation = evaluateAssistantCoachContract(
    state,
    action.rank,
    action.specialty,
  );
  if (!evaluation.allowed) {
    let message = "コーチと契約できません";
    switch (evaluation.reason) {
      case "insufficient-funds":
        message = "コーチ契約に必要な資金が不足しています";
        break;
      case "specialty-required":
        message = "中級以上のコーチは専門分野を選んでください";
        break;
      case "specialty-not-allowed":
        message = "初級コーチに専門分野は設定できません";
        break;
      case "available":
        break;
    }
    return conflict(
      `assistant_coach_${evaluation.reason.replaceAll("-", "_")}`,
      message,
    );
  }

  return {
    state: contractAssistantCoach(state, action.rank, action.specialty),
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
  context: ApplyGameActionContext = {},
): AppliedGameAction {
  const state = structuredClone(snapshot.state) as GameState;
  const teamSelection = cloneTeamSelection(snapshot.teamSelection);

  switch (action.type) {
    case "training":
      return applyTraining(state, teamSelection, action);
    case "set-training-plan":
      return applyTrainingPlan(state, teamSelection, action);
    case "team-selection":
      return applyTeamSelection(state, action);
    case "set-team-tactics":
      return applyTeamTactics(state, teamSelection, action);
    case "set-team-leadership":
      return applyTeamLeadership(state, teamSelection, action);
    case "set-development-priorities":
    case "save-lineup-preset":
    case "delete-lineup-preset":
      return applyTeamPlanning(state, teamSelection, action);
    case "practice-offer-accept":
    case "practice-offer-decline":
    case "practice-request":
      return applyPracticeScheduling(state, teamSelection, action);
    case "practice-match":
      return applyPracticeMatch(state, teamSelection);
    case "match-command":
      return applyActiveMatchCommand(state, teamSelection, action);
    case "official-match":
      return applyOfficialMatch(state, teamSelection);
    case "advance-week":
      return applyAdvanceWeek(state, teamSelection, context);
    case "mark-notification-read":
      return applyMarkNotificationRead(state, teamSelection, action);
    case "facility-upgrade":
      return applyFacilityUpgrade(state, teamSelection, action);
    case "assistant-coach-contract":
      return applyAssistantCoachContract(state, teamSelection, action);
    case "event-choice":
      return applyEventChoice(state, teamSelection, action);
  }
}
