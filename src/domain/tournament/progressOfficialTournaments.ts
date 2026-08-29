import type { GameState } from "../model/GameState";
import { matchId } from "../model/identifiers";
import { recordMatchOutcome } from "../world/rivalWorldProgression";
import { createNationalStage } from "./createNationalStage";
import { resolveNpcTournamentMatch } from "./resolveNpcTournamentMatch";
import { appendOfficialTournamentSummary } from "./tournamentHistory";
import type {
  TournamentBracketMatch,
  TournamentCircuit,
  TournamentEntrant,
  TournamentLevel,
  TournamentRound,
  TournamentStageState,
  WorldSchoolTournamentEntrant,
} from "./tournamentTypes";

const CIRCUITS: readonly TournamentCircuit[] = ["interhigh", "spring-high"];
const LEVELS: readonly TournamentLevel[] = ["prefectural", "national"];

export interface DueUserOfficialMatch {
  circuit: TournamentCircuit;
  level: TournamentLevel;
  stage: TournamentStageState;
  match: TournamentBracketMatch;
  userEntrant: WorldSchoolTournamentEntrant;
  opponent: TournamentEntrant;
}

export interface CompleteTournamentMatchInput {
  state: GameState;
  circuit: TournamentCircuit;
  level: TournamentLevel;
  matchId: string;
  winnerEntrantId: string;
  homeSetsWon: 0 | 1 | 2;
  awaySetsWon: 0 | 1 | 2;
}

function getStage(
  state: GameState,
  circuit: TournamentCircuit,
  level: TournamentLevel,
): TournamentStageState | null {
  const circuitState =
    circuit === "interhigh"
      ? state.officialSeason.interhigh
      : state.officialSeason.springHigh;
  return level === "prefectural" ? circuitState.prefectural : circuitState.national;
}

function replaceStage(
  state: GameState,
  circuit: TournamentCircuit,
  level: TournamentLevel,
  stage: TournamentStageState,
): GameState {
  const circuitKey = circuit === "interhigh" ? "interhigh" : "springHigh";
  const circuitState = state.officialSeason[circuitKey];
  return {
    ...state,
    officialSeason: {
      ...state.officialSeason,
      [circuitKey]: {
        ...circuitState,
        [level]: stage,
      },
    },
  };
}

function entrantById(
  stage: TournamentStageState,
  entrantId: string | null,
): TournamentEntrant | null {
  if (!entrantId) {
    return null;
  }
  return stage.entrants.find((entrant) => entrant.entrantId === entrantId) ?? null;
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

function matchInvolvesEntrant(
  match: TournamentBracketMatch,
  entrantId: string,
): boolean {
  return (
    match.homeEntrantId === entrantId || match.awayEntrantId === entrantId
  );
}

function nextRoundMatch(
  stage: TournamentStageState,
  match: TournamentBracketMatch,
): TournamentBracketMatch | null {
  if (match.round === "final") {
    return null;
  }
  return (
    stage.matches.find(
      (candidate) =>
        candidate.roundIndex === match.roundIndex + 1 &&
        candidate.slotIndex === Math.floor(match.slotIndex / 2),
    ) ?? null
  );
}

function propagateWinner(
  stage: TournamentStageState,
  match: TournamentBracketMatch,
  winnerEntrantId: string,
): TournamentStageState {
  const target = nextRoundMatch(stage, match);
  if (!target) {
    return {
      ...stage,
      championEntrantId: winnerEntrantId,
    };
  }

  const matches = stage.matches.map((candidate) => {
    if (candidate.id !== target.id) {
      return candidate;
    }
    const updated =
      match.slotIndex % 2 === 0
        ? { ...candidate, homeEntrantId: winnerEntrantId }
        : { ...candidate, awayEntrantId: winnerEntrantId };
    return {
      ...updated,
      status:
        updated.homeEntrantId && updated.awayEntrantId
          ? ("ready" as const)
          : ("waiting" as const),
    };
  });

  return { ...stage, matches };
}

function withCompletedMatch(
  stage: TournamentStageState,
  match: TournamentBracketMatch,
  input: Pick<
    CompleteTournamentMatchInput,
    "winnerEntrantId" | "homeSetsWon" | "awaySetsWon"
  >,
  userId: string | null,
): TournamentStageState {
  const userPlayed = Boolean(userId && matchInvolvesEntrant(match, userId));
  const userLost = Boolean(userPlayed && input.winnerEntrantId !== userId);
  const completed: TournamentBracketMatch = {
    ...match,
    winnerEntrantId: input.winnerEntrantId,
    homeSetsWon: input.homeSetsWon,
    awaySetsWon: input.awaySetsWon,
    status: "completed",
  };
  let next: TournamentStageState = {
    ...stage,
    matches: stage.matches.map((candidate) =>
      candidate.id === match.id ? completed : candidate,
    ),
    userEliminated: stage.userEliminated || userLost,
    userBestRound: userPlayed ? match.round : stage.userBestRound,
  };
  next = propagateWinner(next, completed, input.winnerEntrantId);
  return next;
}

function validateResult(
  match: TournamentBracketMatch,
  input: CompleteTournamentMatchInput,
): void {
  if (!match.homeEntrantId || !match.awayEntrantId) {
    throw new Error("tournament match does not have both entrants");
  }
  if (
    input.winnerEntrantId !== match.homeEntrantId &&
    input.winnerEntrantId !== match.awayEntrantId
  ) {
    throw new Error("tournament winner must be one of the match entrants");
  }
  const homeWon = input.homeSetsWon === 2 && input.awaySetsWon < 2;
  const awayWon = input.awaySetsWon === 2 && input.homeSetsWon < 2;
  if (!homeWon && !awayWon) {
    throw new Error("official tournament result must be a legal best-of-three score");
  }
  if (
    (homeWon && input.winnerEntrantId !== match.homeEntrantId) ||
    (awayWon && input.winnerEntrantId !== match.awayEntrantId)
  ) {
    throw new Error("tournament winner does not match the set score");
  }
}

function recordPersistentNpcOutcome(
  state: GameState,
  stage: TournamentStageState,
  match: TournamentBracketMatch,
): GameState {
  if (
    match.status !== "completed" ||
    !match.winnerEntrantId ||
    match.homeSetsWon === null ||
    match.awaySetsWon === null
  ) {
    return state;
  }
  const home = entrantById(stage, match.homeEntrantId);
  const away = entrantById(stage, match.awayEntrantId);
  if (
    home?.source !== "world-school" ||
    away?.source !== "world-school"
  ) {
    return state;
  }
  const winner = entrantById(stage, match.winnerEntrantId);
  if (winner?.source !== "world-school") {
    return state;
  }

  return recordMatchOutcome(state, {
    matchId: matchId(match.id),
    date: state.date,
    homeSchoolId: home.schoolId,
    awaySchoolId: away.schoolId,
    winnerSchoolId: winner.schoolId,
    homeSetsWon: match.homeSetsWon,
    awaySetsWon: match.awaySetsWon,
    tournamentId: stage.tournamentId,
    homeDisplayName: home.displayName,
    awayDisplayName: away.displayName,
  });
}

function updateChampionSchoolCounters(
  state: GameState,
  stage: TournamentStageState,
): GameState {
  if (!stage.championEntrantId) {
    return state;
  }
  const champion = entrantById(stage, stage.championEntrantId);
  if (champion?.source !== "world-school") {
    return state;
  }
  const school = state.schools[champion.schoolId];
  if (!school) {
    return state;
  }

  const alreadyArchived = state.history.officialTournaments.some(
    (summary) => summary.tournamentId === stage.tournamentId,
  );
  if (alreadyArchived) {
    return state;
  }

  if (stage.level === "prefectural") {
    return {
      ...state,
      schools: {
        ...state.schools,
        [school.id]: {
          ...school,
          history: {
            ...school.history,
            prefecturalTitles: school.history.prefecturalTitles + 1,
            nationalAppearances: school.history.nationalAppearances + 1,
          },
        },
      },
    };
  }

  const nextState: GameState = {
    ...state,
    schools: {
      ...state.schools,
      [school.id]: {
        ...school,
        history: {
          ...school.history,
          nationalTitles: school.history.nationalTitles + 1,
        },
      },
    },
  };
  if (stage.circuit !== "spring-high") {
    return nextState;
  }
  return {
    ...nextState,
    history: {
      ...nextState.history,
      nationalChampionSchoolIdsByYear: {
        ...nextState.history.nationalChampionSchoolIdsByYear,
        [nextState.officialSeason.academicYear]: school.id,
      },
    },
  };
}

function finalizeStageIfNeeded(
  state: GameState,
  circuit: TournamentCircuit,
  level: TournamentLevel,
): GameState {
  const stage = getStage(state, circuit, level);
  if (!stage?.championEntrantId) {
    return state;
  }
  const alreadyArchived = state.history.officialTournaments.some(
    (summary) => summary.tournamentId === stage.tournamentId,
  );
  if (alreadyArchived) {
    return state;
  }

  let next = updateChampionSchoolCounters(state, stage);
  if (level === "prefectural") {
    const champion = entrantById(stage, stage.championEntrantId);
    if (champion?.source !== "world-school") {
      throw new Error("prefectural champion must be a persistent school");
    }
    const circuitKey = circuit === "interhigh" ? "interhigh" : "springHigh";
    const circuitState = next.officialSeason[circuitKey];
    if (!circuitState.national) {
      const national = createNationalStage({
        state: next,
        circuit,
        champion,
      });
      next = {
        ...next,
        officialSeason: {
          ...next.officialSeason,
          [circuitKey]: {
            ...circuitState,
            national,
          },
        },
      };
    }
  }
  return appendOfficialTournamentSummary(next, stage);
}

export function completeTournamentMatch(
  input: CompleteTournamentMatchInput,
): GameState {
  const stage = getStage(input.state, input.circuit, input.level);
  if (!stage) {
    throw new Error("tournament stage is not available");
  }
  const match = stage.matches.find((candidate) => candidate.id === input.matchId);
  if (!match) {
    throw new Error("tournament match was not found");
  }
  if (match.status === "completed") {
    if (
      match.winnerEntrantId === input.winnerEntrantId &&
      match.homeSetsWon === input.homeSetsWon &&
      match.awaySetsWon === input.awaySetsWon
    ) {
      return input.state;
    }
    throw new Error("tournament match is already completed");
  }
  validateResult(match, input);

  const user = userEntrant(input.state, stage);
  const nextStage = withCompletedMatch(
    stage,
    match,
    input,
    user?.entrantId ?? null,
  );
  let next = replaceStage(input.state, input.circuit, input.level, nextStage);
  const completedMatch = nextStage.matches.find(
    (candidate) => candidate.id === match.id,
  )!;
  next = recordPersistentNpcOutcome(next, nextStage, completedMatch);
  next = finalizeStageIfNeeded(next, input.circuit, input.level);
  return next;
}

function dueMatch(
  state: GameState,
  circuit: TournamentCircuit,
  level: TournamentLevel,
): DueUserOfficialMatch | null {
  const stage = getStage(state, circuit, level);
  if (!stage || stage.userEliminated) {
    return null;
  }
  const user = userEntrant(state, stage);
  if (!user) {
    return null;
  }
  const match = stage.matches.find(
    (candidate) =>
      candidate.status === "user-required" &&
      matchInvolvesEntrant(candidate, user.entrantId),
  );
  if (!match) {
    return null;
  }
  const opponentId =
    match.homeEntrantId === user.entrantId
      ? match.awayEntrantId
      : match.homeEntrantId;
  const opponent = entrantById(stage, opponentId);
  if (!opponent) {
    return null;
  }
  return { circuit, level, stage, match, userEntrant: user, opponent };
}

export function findDueUserOfficialMatch(
  state: GameState,
): DueUserOfficialMatch | null {
  for (const circuit of CIRCUITS) {
    for (const level of LEVELS) {
      const due = dueMatch(state, circuit, level);
      if (due) {
        return due;
      }
    }
  }
  return null;
}

export function hasRequiredOfficialMatch(state: GameState): boolean {
  return findDueUserOfficialMatch(state) !== null;
}

function markOrResolveOneMatch(
  state: GameState,
  circuit: TournamentCircuit,
  level: TournamentLevel,
): { state: GameState; progressed: boolean } {
  const stage = getStage(state, circuit, level);
  if (!stage || stage.championEntrantId) {
    return { state, progressed: false };
  }
  const user = userEntrant(state, stage);
  const candidate = stage.matches.find(
    (match) =>
      match.status !== "completed" &&
      match.scheduledWeek <= state.calendar.weekOfYear &&
      Boolean(match.homeEntrantId && match.awayEntrantId),
  );
  if (!candidate) {
    return { state, progressed: false };
  }

  if (
    user &&
    !stage.userEliminated &&
    matchInvolvesEntrant(candidate, user.entrantId)
  ) {
    if (candidate.status === "user-required") {
      return { state, progressed: false };
    }
    const marked: TournamentStageState = {
      ...stage,
      matches: stage.matches.map((match) =>
        match.id === candidate.id
          ? { ...match, status: "user-required" as const }
          : match,
      ),
    };
    return {
      state: replaceStage(state, circuit, level, marked),
      progressed: true,
    };
  }

  const home = entrantById(stage, candidate.homeEntrantId);
  const away = entrantById(stage, candidate.awayEntrantId);
  if (!home || !away) {
    return { state, progressed: false };
  }
  const result = resolveNpcTournamentMatch({
    tournamentId: stage.tournamentId,
    match: candidate,
    home,
    away,
  });
  return {
    state: completeTournamentMatch({
      state,
      circuit,
      level,
      matchId: candidate.id,
      ...result,
    }),
    progressed: true,
  };
}

function progressStage(
  state: GameState,
  circuit: TournamentCircuit,
  level: TournamentLevel,
): GameState {
  let next = state;
  for (;;) {
    const result = markOrResolveOneMatch(next, circuit, level);
    next = result.state;
    if (!result.progressed || findDueUserOfficialMatch(next)) {
      return next;
    }
  }
}

export function advanceOfficialTournamentsThroughWeek(
  state: GameState,
): GameState {
  let next = state;
  for (const circuit of CIRCUITS) {
    next = progressStage(next, circuit, "prefectural");
    if (findDueUserOfficialMatch(next)) {
      return next;
    }
    if (getStage(next, circuit, "national")) {
      next = progressStage(next, circuit, "national");
      if (findDueUserOfficialMatch(next)) {
        return next;
      }
    }
  }
  return next;
}
