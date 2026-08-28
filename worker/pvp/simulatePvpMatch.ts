import { simulateMatch } from "../../src/domain/match/simulateMatch";
import { matchId } from "../../src/domain/model/identifiers";
import { SeededRandom } from "../../src/domain/random/SeededRandom";
import type { CloudGameSnapshot } from "../data/GameStore";
import type { PublishedPvpTeamSnapshot } from "../data/PvPStore";
import { buildPvpSimulationState } from "./buildPvpSimulationState";

export interface PvpPublicSetResult {
  setNumber: number;
  challengerScore: number;
  defenderScore: number;
}

export interface PvpPublicMatchResult {
  outcome: "win" | "loss";
  challengerSetsWon: number;
  defenderSetsWon: number;
  sets: PvpPublicSetResult[];
}

export interface SimulatePvpMatchInput {
  challenger: CloudGameSnapshot;
  defender: PublishedPvpTeamSnapshot;
  matchSeed: string;
}

export interface SimulatePvpMatchResult {
  challengerWon: boolean;
  result: PvpPublicMatchResult;
}

export function simulatePvpMatch(
  input: SimulatePvpMatchInput,
): SimulatePvpMatchResult {
  const simulation = buildPvpSimulationState({
    challenger: {
      userId: input.challenger.userId,
      state: input.challenger.state,
      teamSelection: input.challenger.teamSelection,
    },
    defender: input.defender,
  });
  const resolved = simulateMatch({
    state: simulation.state,
    id: matchId(`pvp:${input.matchSeed}`),
    homeSchoolId: simulation.challengerSchoolId,
    awaySchoolId: simulation.defenderSchoolId,
    homeSelection: simulation.challengerSelection,
    awaySelection: simulation.defenderSelection,
    bestOfSets: 3,
    random: new SeededRandom(input.matchSeed),
  });
  const challengerWon = resolved.match.homeSetsWon > resolved.match.awaySetsWon;

  return {
    challengerWon,
    result: {
      outcome: challengerWon ? "win" : "loss",
      challengerSetsWon: resolved.match.homeSetsWon,
      defenderSetsWon: resolved.match.awaySetsWon,
      sets: resolved.match.sets.map((set) => ({
        setNumber: set.setNumber,
        challengerScore: set.homeScore,
        defenderScore: set.awayScore,
      })),
    },
  };
}
