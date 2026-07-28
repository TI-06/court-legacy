import type { GameDataRegistry } from "../../data/dataRegistry";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type {
  School,
  SchoolReputation,
  UniformColors,
} from "../model/School";
import type { RandomSource } from "../random/SeededRandom";

export interface GenerateSchoolInput {
  id: SchoolId;
  name: string;
  shortName: string;
  regionId: string;
  coachName: string;
  uniform: UniformColors;
  playerIds: PlayerId[];
  captainPlayerId: PlayerId | null;
  data: GameDataRegistry;
  random: RandomSource;
  isUserSchool: boolean;
}

const RIVAL_REPUTATIONS: ReadonlyArray<SchoolReputation> = [
  "unknown",
  "district-contender",
  "district-contender",
  "prefectural-power",
  "prefectural-power",
  "national-qualifier",
];

function reputationPoints(reputation: SchoolReputation): number {
  switch (reputation) {
    case "unknown":
      return 20;
    case "district-contender":
      return 100;
    case "prefectural-power":
      return 240;
    case "national-qualifier":
      return 420;
    case "national-regular":
      return 650;
    case "elite":
      return 900;
  }
}

export function generateSchool(input: GenerateSchoolInput): School {
  const archetype = input.random.pick([
    ...input.data.schoolArchetypes.values(),
  ]);
  const reputation = input.isUserSchool
    ? "unknown"
    : input.random.pick(RIVAL_REPUTATIONS);
  const facilityBase = input.isUserSchool ? 0 : input.random.int(0, 2);

  return {
    id: input.id,
    name: input.name,
    shortName: input.shortName,
    regionId: input.regionId,
    archetypeId: archetype.id,
    uniform: input.uniform,
    reputation,
    reputationPoints:
      reputationPoints(reputation) + (input.isUserSchool ? 0 : input.random.int(0, 50)),
    funds: input.isUserSchool ? 300 : input.random.int(250, 700),
    playerIds: [...input.playerIds],
    alumniPlayerIds: [],
    captainPlayerId: input.captainPlayerId,
    coach: {
      name: input.coachName,
      development: input.random.int(35, 70),
      observation: input.random.int(35, 70),
      tactics: input.random.int(35, 70),
      leadership: input.random.int(35, 70),
      charisma: input.random.int(35, 70),
      scouting: input.random.int(35, 70),
      network: input.random.int(35, 70),
      conditioning: input.random.int(35, 70),
    },
    facilities: {
      gym: facilityBase,
      trainingRoom: facilityBase,
      analysisRoom: Math.max(0, facilityBase - 1),
      recoveryRoom: Math.max(0, facilityBase - 1),
      dormitory: 0,
      scoutingNetwork: Math.max(0, facilityBase - 1),
      alumniAssociation: Math.max(0, facilityBase - 1),
      studyRoom: input.random.int(0, 1),
    },
    tactics: {
      serveRisk: input.random.int(35, 70),
      serveTargetPlayerId: null,
      attackTempo: archetype.attackTempo,
      attackDistribution: {
        OH: 34,
        MB: archetype.attackTempo === "fast" ? 25 : 18,
        OP: 25,
        S: 3,
        L: 0,
      },
      blockSystem: archetype.blockSystem,
      defenseBias: input.random.pick(["cross", "balanced", "line"]),
    },
    history: {
      seasons: 0,
      officialWins: 0,
      officialLosses: 0,
      prefecturalTitles: 0,
      nationalAppearances: 0,
      nationalTitles: 0,
    },
  };
}
