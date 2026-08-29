import type { GameState } from "../model/GameState";
import type { MatchState } from "../model/Match";
import type { PlayerId } from "../model/identifiers";
import type {
  TournamentCircuit,
  TournamentLevel,
  TournamentRound,
} from "./tournamentTypes";

export type TournamentResultId =
  | "spring-high:national:champion"
  | "interhigh:national:champion"
  | "national:finalist"
  | "national:semifinalist"
  | "national:quarterfinalist"
  | "national:participant"
  | "prefectural:champion"
  | "prefectural:finalist"
  | "prefectural:semifinalist"
  | "prefectural:quarterfinalist"
  | "prefectural:participant";

const TOURNAMENT_RESULT_RANK: Readonly<Record<TournamentResultId, number>> = {
  "spring-high:national:champion": 11,
  "interhigh:national:champion": 10,
  "national:finalist": 9,
  "national:semifinalist": 8,
  "national:quarterfinalist": 7,
  "national:participant": 6,
  "prefectural:champion": 5,
  "prefectural:finalist": 4,
  "prefectural:semifinalist": 3,
  "prefectural:quarterfinalist": 2,
  "prefectural:participant": 1,
};

export interface TournamentResultInput {
  circuit: TournamentCircuit;
  level: TournamentLevel;
  round: TournamentRound;
  won: boolean;
}

export interface ApplyOfficialMatchPlayerStatsInput
  extends TournamentResultInput {
  state: GameState;
  match: MatchState;
}

function losingResult(
  level: TournamentLevel,
  round: TournamentRound,
): TournamentResultId {
  if (level === "national") {
    switch (round) {
      case "final":
        return "national:finalist";
      case "semifinal":
        return "national:semifinalist";
      case "quarterfinal":
        return "national:quarterfinalist";
      case "round-of-16":
        return "national:participant";
    }
  }

  switch (round) {
    case "final":
      return "prefectural:finalist";
    case "semifinal":
      return "prefectural:semifinalist";
    case "quarterfinal":
      return "prefectural:quarterfinalist";
    case "round-of-16":
      return "prefectural:participant";
  }
}

function winningResult(
  circuit: TournamentCircuit,
  level: TournamentLevel,
  round: TournamentRound,
): TournamentResultId {
  if (round === "final") {
    if (level === "national") {
      return circuit === "spring-high"
        ? "spring-high:national:champion"
        : "interhigh:national:champion";
    }
    return "prefectural:champion";
  }

  if (level === "national") {
    switch (round) {
      case "semifinal":
        return "national:finalist";
      case "quarterfinal":
        return "national:semifinalist";
      case "round-of-16":
        return "national:quarterfinalist";
    }
  }

  switch (round) {
    case "semifinal":
      return "prefectural:finalist";
    case "quarterfinal":
      return "prefectural:semifinalist";
    case "round-of-16":
      return "prefectural:quarterfinalist";
  }
}

export function tournamentResultIdForMatch(
  input: TournamentResultInput,
): TournamentResultId {
  return input.won
    ? winningResult(input.circuit, input.level, input.round)
    : losingResult(input.level, input.round);
}

export function improveBestTournamentResultId(
  current: string | null,
  candidate: TournamentResultId,
): string {
  if (!current) {
    return candidate;
  }
  const currentRank = TOURNAMENT_RESULT_RANK[current as TournamentResultId] ?? 0;
  return currentRank >= TOURNAMENT_RESULT_RANK[candidate] ? current : candidate;
}

function userSelection(state: GameState, match: MatchState) {
  if (match.homeSchoolId === state.userSchoolId) {
    return match.homeSelection;
  }
  if (match.awaySchoolId === state.userSchoolId) {
    return match.awaySelection;
  }
  throw new Error("official match does not involve the user school");
}

export function applyOfficialMatchPlayerStats(
  input: ApplyOfficialMatchPlayerStatsInput,
): GameState {
  const selection = userSelection(input.state, input.match);
  const participantIds = new Set<PlayerId>(
    selection.rotation.map((assignment) => assignment.playerId),
  );
  if (selection.liberoPlayerId) {
    participantIds.add(selection.liberoPlayerId);
  }

  const completedSetCount = input.match.sets.filter(
    (set) => set.completed,
  ).length;
  const scoring = new Map<
    PlayerId,
    { points: number; blocks: number; serviceAces: number }
  >();

  for (const event of input.match.eventLog) {
    if (
      event.type !== "point" ||
      event.winnerSchoolId !== input.state.userSchoolId ||
      !event.actorPlayerId
    ) {
      continue;
    }
    const player = input.state.players[event.actorPlayerId];
    if (!player || player.career.schoolId !== input.state.userSchoolId) {
      continue;
    }
    const totals = scoring.get(player.id) ?? {
      points: 0,
      blocks: 0,
      serviceAces: 0,
    };
    totals.points += 1;
    if (event.detailCode === "point.block") {
      totals.blocks += 1;
    }
    if (event.detailCode === "point.serve-ace") {
      totals.serviceAces += 1;
    }
    scoring.set(player.id, totals);
  }

  const resultId = tournamentResultIdForMatch(input);
  const affectedIds = new Set<PlayerId>([
    ...participantIds,
    ...scoring.keys(),
  ]);
  const players = { ...input.state.players };

  for (const playerId of affectedIds) {
    const player = players[playerId];
    if (!player || player.career.schoolId !== input.state.userSchoolId) {
      continue;
    }
    const participated = participantIds.has(playerId);
    const totals = scoring.get(playerId) ?? {
      points: 0,
      blocks: 0,
      serviceAces: 0,
    };
    players[playerId] = {
      ...player,
      career: {
        ...player.career,
        appearances: player.career.appearances + (participated ? 1 : 0),
        setsPlayed:
          player.career.setsPlayed + (participated ? completedSetCount : 0),
        points: player.career.points + totals.points,
        blocks: player.career.blocks + totals.blocks,
        serviceAces: player.career.serviceAces + totals.serviceAces,
        bestTournamentResultId: participated
          ? improveBestTournamentResultId(
              player.career.bestTournamentResultId,
              resultId,
            )
          : player.career.bestTournamentResultId,
      },
    };
  }

  return {
    ...input.state,
    players,
  };
}
