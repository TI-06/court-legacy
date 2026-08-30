import type {
  TournamentCircuit,
  TournamentLevel,
  TournamentRound,
} from "./tournamentTypes";

const TOURNAMENT_ROUND_WEEKS = {
  interhigh: {
    prefectural: {
      "round-of-16": 9,
      quarterfinal: 10,
      semifinal: 11,
      final: 12,
    },
    national: {
      "round-of-16": 16,
      quarterfinal: 17,
      semifinal: 18,
      final: 19,
    },
  },
  "spring-high": {
    prefectural: {
      "round-of-16": 30,
      quarterfinal: 31,
      semifinal: 32,
      final: 33,
    },
    national: {
      "round-of-16": 41,
      quarterfinal: 42,
      semifinal: 43,
      final: 44,
    },
  },
} as const satisfies Record<
  TournamentCircuit,
  Record<TournamentLevel, Record<TournamentRound, number>>
>;

export function tournamentRoundWeek(
  circuit: TournamentCircuit,
  level: TournamentLevel,
  round: TournamentRound,
): number {
  return TOURNAMENT_ROUND_WEEKS[circuit][level][round];
}
