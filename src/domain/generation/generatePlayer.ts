import type { GameDataRegistry } from "../../data/dataRegistry";
import {
  clampAbility,
  type BodyType,
  type Grade,
  type Player,
  type PlayerAbilities,
  type PlayerTier,
  type Position,
} from "../model/Player";
import type { PlayerId, SchoolId } from "../model/identifiers";
import { playerId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";
import { weightedChoice } from "../random/weightedChoice";
import { selectPlayerTraitIds } from "./selectPlayerTraits";

const POSITION_WEIGHTS: ReadonlyArray<{ value: Position; weight: number }> = [
  { value: "OH", weight: 30 },
  { value: "MB", weight: 22 },
  { value: "OP", weight: 14 },
  { value: "S", weight: 18 },
  { value: "L", weight: 16 },
];

const HEIGHT_RANGES: Record<Position, readonly [number, number]> = {
  L: [160, 180],
  S: [166, 190],
  OH: [168, 195],
  OP: [172, 200],
  MB: [178, 205],
};

const POSITION_BOOSTS: Record<Position, Partial<PlayerAbilities>> = {
  OH: { spike: 10, jump: 7, receive: 4, serve: 3 },
  MB: { block: 12, jump: 9, speed: 3, spike: 4 },
  OP: { spike: 12, serve: 7, jump: 6, mental: 3 },
  S: { set: 14, decision: 10, speed: 4, mental: 3 },
  L: { receive: 14, speed: 10, decision: 8, mental: 4, spike: -8 },
};

const TIER_ABILITY_OFFSET: Record<PlayerTier, number> = {
  normal: 0,
  prospect: 11,
  generational: 22,
};

const ABILITY_KEYS: ReadonlyArray<keyof PlayerAbilities> = [
  "spike",
  "jump",
  "receive",
  "serve",
  "set",
  "block",
  "speed",
  "stamina",
  "decision",
  "mental",
];

export interface GeneratePlayerInput {
  id: PlayerId;
  schoolId: SchoolId;
  grade: Grade;
  enrolledYear: number;
  tier: PlayerTier;
  data: GameDataRegistry;
  random: RandomSource;
  preferredPosition?: Position;
  excludedFullNames: Set<string>;
}

export interface GenerateInitialSquadInput {
  schoolId: SchoolId;
  academicYear: number;
  firstPlayerNumber: number;
  data: GameDataRegistry;
  random: RandomSource;
}

export interface GenerateIntakeInput {
  schoolId: SchoolId;
  academicYear: number;
  firstPlayerNumber: number;
  data: GameDataRegistry;
  random: RandomSource;
  currentPlayers: readonly Player[];
  count?: number;
}

function chooseWeightedName(
  entries: GameDataRegistry["names"]["surnames"],
  random: RandomSource,
): (typeof entries)[number] {
  const selected = weightedChoice(
    entries.map((entry) => ({ value: entry, weight: entry.weight })),
    random,
  );

  if (!selected) {
    throw new Error("name catalog must contain a positive weight");
  }
  return selected;
}

function generateUniqueName(
  data: GameDataRegistry,
  random: RandomSource,
  excludedFullNames: Set<string>,
): {
  firstName: string;
  lastName: string;
  reading: string;
  fullName: string;
} {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const surname = chooseWeightedName(data.names.surnames, random);
    const givenName = chooseWeightedName(data.names.givenNames, random);
    const fullName = `${surname.name} ${givenName.name}`;

    if (!excludedFullNames.has(fullName)) {
      excludedFullNames.add(fullName);
      return {
        firstName: givenName.name,
        lastName: surname.name,
        reading: `${surname.reading} ${givenName.reading}`,
        fullName,
      };
    }
  }

  throw new Error("could not generate a unique player name");
}

function generateBodyType(heightCm: number, random: RandomSource): BodyType {
  const roll = random.int(1, 100);

  if (heightCm >= 195 && roll <= 40) {
    return "large";
  }
  if (roll <= 22) {
    return "slim";
  }
  if (roll <= 48) {
    return "muscular";
  }
  if (roll >= 94) {
    return "large";
  }
  return "standard";
}

function generateAbilities(
  position: Position,
  tier: PlayerTier,
  random: RandomSource,
): PlayerAbilities {
  const tierOffset = TIER_ABILITY_OFFSET[tier];
  const boosts = POSITION_BOOSTS[position];
  const abilities = {} as PlayerAbilities;

  for (const ability of ABILITY_KEYS) {
    const base = random.int(28, 52);
    abilities[ability] = clampAbility(
      base + tierOffset + (boosts[ability] ?? 0),
    );
  }

  return abilities;
}

function generatePositionAptitudes(
  preferredPosition: Position,
  tier: PlayerTier,
  random: RandomSource,
): Record<Position, number> {
  const tierBoost = tier === "generational" ? 6 : tier === "prospect" ? 3 : 0;
  const positions: Position[] = ["OH", "MB", "OP", "S", "L"];
  const aptitudes = {} as Record<Position, number>;

  for (const position of positions) {
    aptitudes[position] =
      position === preferredPosition
        ? clampAbility(random.int(78, 94) + tierBoost)
        : random.int(18, 58);
  }

  const secondaryCandidates = positions.filter(
    (position) => position !== preferredPosition,
  );
  const secondary = random.pick(secondaryCandidates);
  aptitudes[secondary] = Math.max(
    aptitudes[secondary],
    random.int(50, 68) + Math.floor(tierBoost / 2),
  );

  return aptitudes;
}

function selectPreferredPosition(random: RandomSource): Position {
  const position = weightedChoice(POSITION_WEIGHTS, random);
  if (!position) {
    throw new Error("position weights must include a positive value");
  }
  return position;
}

export function generatePlayer(input: GeneratePlayerInput): Player {
  const position =
    input.preferredPosition ?? selectPreferredPosition(input.random);
  const [minimumHeight, maximumHeight] = HEIGHT_RANGES[position];
  const heightCm = input.random.int(minimumHeight, maximumHeight);
  const generatedName = generateUniqueName(
    input.data,
    input.random,
    input.excludedFullNames,
  );
  const personality = input.random.pick([...input.data.personalities.values()]);
  const growthType = input.random.pick([...input.data.growthTypes.values()]);
  const traitIds = selectPlayerTraitIds(
    input.tier,
    input.data.traits,
    input.random,
  );

  return {
    id: input.id,
    firstName: generatedName.firstName,
    lastName: generatedName.lastName,
    reading: generatedName.reading,
    grade: input.grade,
    heightCm,
    bodyType: generateBodyType(heightCm, input.random),
    handedness: input.random.int(1, 100) <= 9 ? "left" : "right",
    preferredPosition: position,
    positionAptitudes: generatePositionAptitudes(
      position,
      input.tier,
      input.random,
    ),
    abilities: generateAbilities(position, input.tier, input.random),
    condition: input.random.int(75, 100),
    fatigue: 0,
    morale: input.random.int(55, 85),
    trust: input.random.int(35, 55),
    academic: input.random.int(40, 90),
    personalityId: personality.id,
    growthTypeId: growthType.id,
    traitIds,
    hiddenTraitIds: [],
    tier: input.tier,
    injury: null,
    career: {
      schoolId: input.schoolId,
      enrolledYear: input.enrolledYear,
      appearances: 0,
      setsPlayed: 0,
      points: 0,
      blocks: 0,
      serviceAces: 0,
      captainSeasons: 0,
      awardIds: [],
      bestTournamentResultId: null,
    },
  };
}

const INITIAL_SQUAD_POSITIONS: ReadonlyArray<Position> = [
  "OH",
  "MB",
  "S",
  "L",
  "OH",
  "MB",
  "OP",
  "S",
  "OH",
  "MB",
  "OP",
  "L",
];

export function generateInitialSquad(
  input: GenerateInitialSquadInput,
): Player[] {
  const excludedFullNames = new Set<string>();

  return INITIAL_SQUAD_POSITIONS.map((position, index) => {
    const grade = (Math.floor(index / 4) + 1) as Grade;
    const number = input.firstPlayerNumber + index;

    return generatePlayer({
      id: playerId(`player-${String(number).padStart(4, "0")}`),
      schoolId: input.schoolId,
      grade,
      enrolledYear: Math.max(1, input.academicYear - grade + 1),
      tier: "normal",
      preferredPosition: position,
      data: input.data,
      random: input.random,
      excludedFullNames,
    });
  });
}

export function generateIntake(input: GenerateIntakeInput): Player[] {
  const excludedFullNames = new Set(
    input.currentPlayers.map(
      (player) => `${player.lastName} ${player.firstName}`,
    ),
  );
  const count = input.count ?? input.random.int(4, 7);

  return Array.from({ length: count }, (_, index) =>
    generatePlayer({
      id: playerId(
        `player-${String(input.firstPlayerNumber + index).padStart(4, "0")}`,
      ),
      schoolId: input.schoolId,
      grade: 1,
      enrolledYear: input.academicYear,
      tier: "normal",
      data: input.data,
      random: input.random,
      excludedFullNames,
    }),
  );
}
