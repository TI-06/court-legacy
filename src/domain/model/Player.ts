import type { PlayerId, SchoolId } from "./identifiers";

export type Position = "OH" | "MB" | "OP" | "S" | "L";
export type Grade = 1 | 2 | 3;
export type Handedness = "right" | "left";
export type PlayerTier = "normal" | "prospect" | "generational";
export type BodyType = "slim" | "standard" | "muscular" | "large";

export interface PlayerAbilities {
  spike: number;
  jump: number;
  receive: number;
  serve: number;
  set: number;
  block: number;
  speed: number;
  stamina: number;
  decision: number;
  mental: number;
}

export interface PlayerCareer {
  schoolId: SchoolId;
  enrolledYear: number;
  appearances: number;
  setsPlayed: number;
  points: number;
  blocks: number;
  serviceAces: number;
  captainSeasons: number;
  awardIds: string[];
  bestTournamentResultId: string | null;
}

export interface PlayerInjury {
  injuryId: string;
  severity: "minor" | "moderate" | "severe";
  remainingWeeks: number;
  recurrenceRisk: number;
}

export interface Player {
  id: PlayerId;
  firstName: string;
  lastName: string;
  reading: string;
  grade: Grade;
  heightCm: number;
  bodyType: BodyType;
  handedness: Handedness;
  preferredPosition: Position;
  positionAptitudes: Record<Position, number>;
  abilities: PlayerAbilities;
  condition: number;
  fatigue: number;
  morale: number;
  trust: number;
  academic: number;
  personalityId: string;
  growthTypeId: string;
  traitIds: string[];
  hiddenTraitIds: string[];
  tier: PlayerTier;
  injury: PlayerInjury | null;
  career: PlayerCareer;
}

export const ABILITY_KEYS = [
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
] as const satisfies readonly (keyof PlayerAbilities)[];

export function createAbilities(value = 0): PlayerAbilities {
  const normalized = Math.max(0, Math.min(100, Math.round(value)));

  return {
    spike: normalized,
    jump: normalized,
    receive: normalized,
    serve: normalized,
    set: normalized,
    block: normalized,
    speed: normalized,
    stamina: normalized,
    decision: normalized,
    mental: normalized,
  };
}

export function clampAbility(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("ability value must be finite");
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}
