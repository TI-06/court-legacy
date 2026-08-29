import type {
  GameState,
  HistoricalMatchSummary,
} from "../model/GameState";
import type { MatchState } from "../model/Match";
import { MAX_MATCH_HISTORY } from "../world/rivalWorldProgression";
import {
  applyOfficialMatchPlayerStats,
} from "./playerTournamentStats";
import { completeTournamentMatch } from "./progressOfficialTournaments";
import type {
  TournamentCircuit,
  TournamentEntrant,
  TournamentLevel,
  TournamentStageState,
} from "./tournamentTypes";

export interface RecordOfficialTournamentOutcomeInput {
  state: GameState;
  circuit: TournamentCircuit;
  level: TournamentLevel;
  bracketMatchId: string;
  match: MatchState;
}

function stageFor(
  state: GameState,
  circuit: TournamentCircuit,
  level: TournamentLevel,
): TournamentStageState {
  const circuitState =
    circuit === "interhigh"
      ? state.officialSeason.interhigh
      : state.officialSeason.springHigh;
  const stage =
    level === "prefectural" ? circuitState.prefectural : circuitState.national;
  if (!stage) {
    throw new Error("official tournament stage is not available");
  }
  return stage;
}

function entrantById(
  stage: TournamentStageState,
  entrantId: string | null,
): TournamentEntrant {
  if (!entrantId) {
    throw new Error("official tournament match entrant is missing");
  }
  const entrant = stage.entrants.find(
    (candidate) => candidate.entrantId === entrantId,
  );
  if (!entrant) {
    throw new Error(`unknown official tournament entrant: ${entrantId}`);
  }
  return entrant;
}

function validateCompletedMatch(match: MatchState): {
  homeSetsWon: 0 | 1 | 2;
  awaySetsWon: 0 | 1 | 2;
  homeWon: boolean;
} {
  if (match.phase !== "match-complete") {
    throw new Error("official tournament match must be complete before recording");
  }
  const homeSetsWon = match.homeSetsWon;
  const awaySetsWon = match.awaySetsWon;
  const homeWon = homeSetsWon === 2 && awaySetsWon < 2;
  const awayWon = awaySetsWon === 2 && homeSetsWon < 2;
  if (!homeWon && !awayWon) {
    throw new Error("official tournament match has an invalid best-of-three result");
  }
  return {
    homeSetsWon: homeSetsWon as 0 | 1 | 2,
    awaySetsWon: awaySetsWon as 0 | 1 | 2,
    homeWon,
  };
}

function validateWorldEntrantSchool(
  entrant: TournamentEntrant,
  matchSchoolId: MatchState["homeSchoolId"],
): void {
  if (entrant.source === "world-school" && entrant.schoolId !== matchSchoolId) {
    throw new Error("official match school does not match its bracket entrant");
  }
}

function updateGuestSafeOfficialRecord(
  state: GameState,
  userWon: boolean,
): GameState {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error("user school is missing while recording official match");
  }
  return {
    ...state,
    schools: {
      ...state.schools,
      [school.id]: {
        ...school,
        history: {
          ...school.history,
          officialWins: school.history.officialWins + (userWon ? 1 : 0),
          officialLosses: school.history.officialLosses + (userWon ? 0 : 1),
        },
      },
    },
  };
}

function appendGuestSafeHistory(
  state: GameState,
  summary: HistoricalMatchSummary,
): GameState {
  return {
    ...state,
    history: {
      ...state.history,
      matches: [...state.history.matches, summary].slice(-MAX_MATCH_HISTORY),
    },
  };
}

export function recordOfficialTournamentOutcome(
  input: RecordOfficialTournamentOutcomeInput,
): GameState {
  if (
    input.state.history.matches.some(
      (summary) => summary.matchId === input.match.id,
    )
  ) {
    return input.state;
  }
  if (input.match.id !== input.bracketMatchId) {
    throw new Error("official match id must match the authoritative bracket match id");
  }

  const stage = stageFor(input.state, input.circuit, input.level);
  const bracketMatch = stage.matches.find(
    (candidate) => candidate.id === input.bracketMatchId,
  );
  if (!bracketMatch) {
    throw new Error("official tournament bracket match was not found");
  }
  if (!bracketMatch.homeEntrantId || !bracketMatch.awayEntrantId) {
    throw new Error("official tournament bracket match is not ready");
  }
  if (bracketMatch.status === "completed") {
    throw new Error("official tournament bracket match is already completed");
  }

  const homeEntrant = entrantById(stage, bracketMatch.homeEntrantId);
  const awayEntrant = entrantById(stage, bracketMatch.awayEntrantId);
  validateWorldEntrantSchool(homeEntrant, input.match.homeSchoolId);
  validateWorldEntrantSchool(awayEntrant, input.match.awaySchoolId);

  const userIsHome =
    homeEntrant.source === "world-school" &&
    homeEntrant.schoolId === input.state.userSchoolId;
  const userIsAway =
    awayEntrant.source === "world-school" &&
    awayEntrant.schoolId === input.state.userSchoolId;
  if (!userIsHome && !userIsAway) {
    throw new Error("official tournament match does not involve the user school");
  }

  const result = validateCompletedMatch(input.match);
  const winnerEntrant = result.homeWon ? homeEntrant : awayEntrant;
  const winnerSchoolId = result.homeWon
    ? input.match.homeSchoolId
    : input.match.awaySchoolId;
  const userWon = winnerSchoolId === input.state.userSchoolId;

  let next = applyOfficialMatchPlayerStats({
    state: input.state,
    match: input.match,
    circuit: input.circuit,
    level: input.level,
    round: bracketMatch.round,
    won: userWon,
  });

  const containsGuest =
    homeEntrant.source === "guest-representative" ||
    awayEntrant.source === "guest-representative";
  if (containsGuest) {
    const summary: HistoricalMatchSummary = {
      matchId: input.match.id,
      date: input.state.date,
      homeSchoolId: input.match.homeSchoolId,
      awaySchoolId: input.match.awaySchoolId,
      winnerSchoolId,
      homeSetsWon: result.homeSetsWon,
      awaySetsWon: result.awaySetsWon,
      tournamentId: stage.tournamentId,
      homeDisplayName: homeEntrant.displayName,
      awayDisplayName: awayEntrant.displayName,
    };
    next = appendGuestSafeHistory(next, summary);
    next = updateGuestSafeOfficialRecord(next, userWon);
  }

  return completeTournamentMatch({
    state: next,
    circuit: input.circuit,
    level: input.level,
    matchId: input.bracketMatchId,
    winnerEntrantId: winnerEntrant.entrantId,
    homeSetsWon: result.homeSetsWon,
    awaySetsWon: result.awaySetsWon,
  });
}
