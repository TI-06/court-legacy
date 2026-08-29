import type { GameState } from "../model/GameState";
import type { SchoolId } from "../model/identifiers";
import { findDueUserOfficialMatch } from "./progressOfficialTournaments";
import { tournamentRoundWeek } from "./tournamentSchedule";
import type {
  TournamentBracketMatch,
  TournamentCircuit,
  TournamentEntrant,
  TournamentLevel,
  TournamentRound,
  TournamentStageState,
  WorldSchoolTournamentEntrant,
} from "./tournamentTypes";

export interface TournamentPublicEntrant {
  entrantId: string;
  schoolId: SchoolId | null;
  displayName: string;
  shortName: string;
  regionLabel: string | null;
}

export interface TournamentBracketMatchView {
  id: string;
  round: TournamentRound;
  scheduledWeek: number;
  status: TournamentBracketMatch["status"];
  home: TournamentPublicEntrant | null;
  away: TournamentPublicEntrant | null;
  winnerEntrantId: string | null;
  homeSetsWon: number | null;
  awaySetsWon: number | null;
  userInMatch: boolean;
}

export type TournamentStageViewStatus =
  "upcoming" | "active" | "due" | "eliminated" | "champion" | "completed";

export interface TournamentStageView {
  tournamentId: string;
  academicYear: number;
  circuit: TournamentCircuit;
  level: TournamentLevel;
  status: TournamentStageViewStatus;
  entrants: TournamentPublicEntrant[];
  matches: TournamentBracketMatchView[];
  champion: TournamentPublicEntrant | null;
  userEntrantId: string | null;
  userBestRound: TournamentRound | null;
}

export interface NextOfficialMatchView {
  kind: "match";
  academicYear: number;
  circuit: TournamentCircuit;
  level: TournamentLevel;
  tournamentId: string;
  matchId: string;
  round: TournamentRound;
  scheduledWeek: number;
  timing: "upcoming" | "due";
  weeksUntil: number;
  opponent: TournamentPublicEntrant;
}

export interface NextCircuitStartView {
  kind: "circuit-start";
  academicYear: number;
  circuit: TournamentCircuit;
  level: "prefectural";
  scheduledWeek: number;
  weeksUntil: number;
}

export type NextOfficialEventView =
  NextOfficialMatchView | NextCircuitStartView;

function circuitState(state: GameState, circuit: TournamentCircuit) {
  return circuit === "interhigh"
    ? state.officialSeason.interhigh
    : state.officialSeason.springHigh;
}

function stageFor(
  state: GameState,
  circuit: TournamentCircuit,
  level: TournamentLevel,
): TournamentStageState | null {
  const selectedCircuit = circuitState(state, circuit);
  return level === "prefectural"
    ? selectedCircuit.prefectural
    : selectedCircuit.national;
}

function publicEntrant(
  entrant: TournamentEntrant | null | undefined,
): TournamentPublicEntrant | null {
  if (!entrant) {
    return null;
  }
  return {
    entrantId: entrant.entrantId,
    schoolId: entrant.source === "world-school" ? entrant.schoolId : null,
    displayName: entrant.displayName,
    shortName: entrant.shortName,
    regionLabel:
      entrant.source === "guest-representative" ? entrant.regionLabel : null,
  };
}

function entrantById(
  stage: TournamentStageState,
  entrantId: string | null,
): TournamentEntrant | null {
  if (!entrantId) {
    return null;
  }
  return (
    stage.entrants.find((entrant) => entrant.entrantId === entrantId) ?? null
  );
}

function userEntrant(
  state: GameState,
  stage: TournamentStageState,
): WorldSchoolTournamentEntrant | null {
  const entrant = stage.entrants.find(
    (candidate) =>
      candidate.source === "world-school" &&
      candidate.schoolId === state.userSchoolId,
  );
  return entrant?.source === "world-school" ? entrant : null;
}

function stageStatus(
  state: GameState,
  stage: TournamentStageState,
  user: WorldSchoolTournamentEntrant | null,
): TournamentStageViewStatus {
  if (user && stage.championEntrantId === user.entrantId) {
    return "champion";
  }
  if (stage.userEliminated) {
    return "eliminated";
  }
  if (
    user &&
    stage.matches.some(
      (match) =>
        match.status === "user-required" &&
        (match.homeEntrantId === user.entrantId ||
          match.awayEntrantId === user.entrantId),
    )
  ) {
    return "due";
  }
  if (stage.championEntrantId) {
    return "completed";
  }
  const firstWeek = Math.min(
    ...stage.matches.map((match) => match.scheduledWeek),
  );
  return state.calendar.weekOfYear < firstWeek ? "upcoming" : "active";
}

function matchView(
  stage: TournamentStageState,
  match: TournamentBracketMatch,
  userEntrantId: string | null,
): TournamentBracketMatchView {
  return {
    id: match.id,
    round: match.round,
    scheduledWeek: match.scheduledWeek,
    status: match.status,
    home: publicEntrant(entrantById(stage, match.homeEntrantId)),
    away: publicEntrant(entrantById(stage, match.awayEntrantId)),
    winnerEntrantId: match.winnerEntrantId,
    homeSetsWon: match.homeSetsWon,
    awaySetsWon: match.awaySetsWon,
    userInMatch: Boolean(
      userEntrantId &&
      (match.homeEntrantId === userEntrantId ||
        match.awayEntrantId === userEntrantId),
    ),
  };
}

export function selectTournamentStageView(
  state: GameState,
  circuit: TournamentCircuit,
  level: TournamentLevel,
): TournamentStageView | null {
  const stage = stageFor(state, circuit, level);
  if (!stage) {
    return null;
  }
  const user = userEntrant(state, stage);
  return {
    tournamentId: stage.tournamentId,
    academicYear: state.officialSeason.academicYear,
    circuit,
    level,
    status: stageStatus(state, stage, user),
    entrants: stage.entrants.map((entrant) => publicEntrant(entrant)!),
    matches: stage.matches.map((match) =>
      matchView(stage, match, user?.entrantId ?? null),
    ),
    champion: publicEntrant(entrantById(stage, stage.championEntrantId)),
    userEntrantId: user?.entrantId ?? null,
    userBestRound: stage.userBestRound,
  };
}

function dueEvent(state: GameState): NextOfficialMatchView | null {
  const due = findDueUserOfficialMatch(state);
  if (!due) {
    return null;
  }
  const opponent = publicEntrant(due.opponent);
  if (!opponent) {
    return null;
  }
  return {
    kind: "match",
    academicYear: state.officialSeason.academicYear,
    circuit: due.circuit,
    level: due.level,
    tournamentId: due.stage.tournamentId,
    matchId: due.match.id,
    round: due.match.round,
    scheduledWeek: due.match.scheduledWeek,
    timing: "due",
    weeksUntil: 0,
    opponent,
  };
}

function nextCircuitAfterElimination(
  state: GameState,
): NextCircuitStartView | null {
  const currentWeek = state.calendar.weekOfYear;
  const interhighEliminated =
    state.officialSeason.interhigh.prefectural.userEliminated ||
    Boolean(state.officialSeason.interhigh.national?.userEliminated);
  const springStart = tournamentRoundWeek(
    "spring-high",
    "prefectural",
    "round-of-16",
  );
  if (interhighEliminated && currentWeek < springStart) {
    return {
      kind: "circuit-start",
      academicYear: state.officialSeason.academicYear,
      circuit: "spring-high",
      level: "prefectural",
      scheduledWeek: springStart,
      weeksUntil: springStart - currentWeek,
    };
  }
  return null;
}

function upcomingMatches(state: GameState): NextOfficialMatchView[] {
  const result: NextOfficialMatchView[] = [];
  const circuits: readonly TournamentCircuit[] = ["interhigh", "spring-high"];
  const levels: readonly TournamentLevel[] = ["prefectural", "national"];

  for (const circuit of circuits) {
    for (const level of levels) {
      const stage = stageFor(state, circuit, level);
      if (!stage || stage.userEliminated) {
        continue;
      }
      const user = userEntrant(state, stage);
      if (!user) {
        continue;
      }
      const match = stage.matches.find(
        (candidate) =>
          candidate.status !== "completed" &&
          (candidate.homeEntrantId === user.entrantId ||
            candidate.awayEntrantId === user.entrantId),
      );
      if (!match) {
        continue;
      }
      const opponentId =
        match.homeEntrantId === user.entrantId
          ? match.awayEntrantId
          : match.homeEntrantId;
      const opponent = publicEntrant(entrantById(stage, opponentId));
      if (!opponent) {
        continue;
      }
      const weeksUntil = Math.max(
        0,
        match.scheduledWeek - state.calendar.weekOfYear,
      );
      result.push({
        kind: "match",
        academicYear: state.officialSeason.academicYear,
        circuit,
        level,
        tournamentId: stage.tournamentId,
        matchId: match.id,
        round: match.round,
        scheduledWeek: match.scheduledWeek,
        timing: weeksUntil === 0 ? "due" : "upcoming",
        weeksUntil,
        opponent,
      });
    }
  }

  return result.sort(
    (left, right) =>
      left.scheduledWeek - right.scheduledWeek ||
      left.tournamentId.localeCompare(right.tournamentId),
  );
}

export function selectNextOfficialEvent(
  state: GameState,
): NextOfficialEventView | null {
  const due = dueEvent(state);
  if (due) {
    return due;
  }
  const circuitStart = nextCircuitAfterElimination(state);
  if (circuitStart) {
    return circuitStart;
  }
  return upcomingMatches(state)[0] ?? null;
}
