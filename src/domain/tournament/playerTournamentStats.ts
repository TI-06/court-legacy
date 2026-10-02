import type { GameState } from "../model/GameState";
import type { PlayerSeasonStats } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { UserMatchPerformanceSnapshot } from "../match/userMatchPerformance";
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

export interface ApplyOfficialMatchPlayerStatsInput extends TournamentResultInput {
  state: GameState;
  performance: UserMatchPerformanceSnapshot;
}

function emptySeasonStats(academicYear: number): PlayerSeasonStats {
  return {
    academicYear,
    appearances: 0,
    setsPlayed: 0,
    points: 0,
    attackPoints: 0,
    attackAttempts: 0,
    blocks: 0,
    serviceAces: 0,
    receiveAttempts: 0,
    perfectReceives: 0,
    defensePoints: 0,
    idealSets: 0,
    successfulDigs: 0,
  };
}

function currentSeasonStats(
  stats: PlayerSeasonStats | undefined,
  academicYear: number,
): PlayerSeasonStats {
  return stats?.academicYear === academicYear
    ? { ...stats }
    : emptySeasonStats(academicYear);
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
  const currentRank =
    TOURNAMENT_RESULT_RANK[current as TournamentResultId] ?? 0;
  return currentRank >= TOURNAMENT_RESULT_RANK[candidate] ? current : candidate;
}

export function applyOfficialMatchPlayerStats(
  input: ApplyOfficialMatchPlayerStatsInput,
): GameState {
  const participantIds = new Set<PlayerId>(
    input.performance.appearanceParticipantIds,
  );
  const resultId = tournamentResultIdForMatch(input);
  const scoringIds = [...input.performance.players.entries()]
    .filter(([, stats]) => stats.points > 0)
    .map(([playerId]) => playerId);
  const affectedIds = new Set<PlayerId>([...participantIds, ...scoringIds]);
  const players = { ...input.state.players };

  for (const playerId of affectedIds) {
    const player = players[playerId];
    if (!player || player.career.schoolId !== input.state.userSchoolId) {
      continue;
    }
    const participated = participantIds.has(playerId);
    const totals = input.performance.players.get(playerId);
    const seasonStats = currentSeasonStats(
      player.career.seasonStats,
      input.state.calendar.academicYear,
    );
    players[playerId] = {
      ...player,
      career: {
        ...player.career,
        appearances: player.career.appearances + (participated ? 1 : 0),
        setsPlayed:
          player.career.setsPlayed +
          (participated ? input.performance.completedSetCount : 0),
        points: player.career.points + (totals?.points ?? 0),
        blocks: player.career.blocks + (totals?.blockPoints ?? 0),
        serviceAces: player.career.serviceAces + (totals?.serviceAces ?? 0),
        bestTournamentResultId: participated
          ? improveBestTournamentResultId(
              player.career.bestTournamentResultId,
              resultId,
            )
          : player.career.bestTournamentResultId,
        seasonStats: {
          ...seasonStats,
          appearances: seasonStats.appearances + (participated ? 1 : 0),
          setsPlayed:
            seasonStats.setsPlayed +
            (participated ? input.performance.completedSetCount : 0),
          points: seasonStats.points + (totals?.points ?? 0),
          attackPoints: seasonStats.attackPoints + (totals?.attackPoints ?? 0),
          attackAttempts:
            seasonStats.attackAttempts + (totals?.attackAttempts ?? 0),
          blocks: seasonStats.blocks + (totals?.blockPoints ?? 0),
          serviceAces: seasonStats.serviceAces + (totals?.serviceAces ?? 0),
          receiveAttempts:
            seasonStats.receiveAttempts + (totals?.receiveAttempts ?? 0),
          perfectReceives:
            seasonStats.perfectReceives + (totals?.perfectReceives ?? 0),
          defensePoints:
            seasonStats.defensePoints + (totals?.defensePoints ?? 0),
          idealSets: seasonStats.idealSets + (totals?.idealSets ?? 0),
          successfulDigs:
            seasonStats.successfulDigs + (totals?.successfulDigs ?? 0),
        },
      },
    };
  }

  return {
    ...input.state,
    players,
  };
}
