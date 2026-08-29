import { SeededRandom } from "../random/SeededRandom";
import type {
  TournamentBracketMatch,
  TournamentEntrant,
} from "./tournamentTypes";

export interface NpcTournamentMatchResult {
  winnerEntrantId: string;
  homeSetsWon: 0 | 1 | 2;
  awaySetsWon: 0 | 1 | 2;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function resolveNpcTournamentMatch(input: {
  tournamentId: string;
  match: TournamentBracketMatch;
  home: TournamentEntrant;
  away: TournamentEntrant;
}): NpcTournamentMatchResult {
  if (
    input.match.homeEntrantId !== input.home.entrantId ||
    input.match.awayEntrantId !== input.away.entrantId
  ) {
    throw new Error("tournament match entrants do not match the bracket");
  }
  if (input.home.entrantId === input.away.entrantId) {
    throw new Error("tournament opponents must be different entrants");
  }

  const random = new SeededRandom(
    `${input.tournamentId}::${input.match.id}::npc-resolution`,
  );
  const strengthDifference =
    input.home.seedStrength - input.away.seedStrength;
  const homeWinProbability = clamp(
    0.5 + strengthDifference * 0.006,
    0.18,
    0.82,
  );
  const homeWon = random.next() < homeWinProbability;
  const loserSets = random.next() < 0.42 ? 1 : 0;

  return homeWon
    ? {
        winnerEntrantId: input.home.entrantId,
        homeSetsWon: 2,
        awaySetsWon: loserSets,
      }
    : {
        winnerEntrantId: input.away.entrantId,
        homeSetsWon: loserSets,
        awaySetsWon: 2,
      };
}
