import type { Player } from "../model/Player";
import type { GameDate, PlayerId } from "../model/identifiers";

export interface NextTrainingGrowthBoost {
  percent: 20;
  remainingUses: 1;
  sourceItemId: "training-efficiency-boost";
}

export interface PendingTrainingCamp {
  sourceItemId: "training-camp";
  scheduledDate: GameDate;
}

export interface TrainingCampTopGrowth {
  playerId: PlayerId;
  totalAbilityGrowth: number;
  abilityChanges: Partial<Record<keyof Player["abilities"], number>>;
}

export interface TrainingCampSpecialAbilityChange {
  playerId: PlayerId;
  abilityId: string;
  kind: "tip" | "learned" | "negative-removed";
  tipLevel?: 1 | 2;
}

export interface TrainingCampResult {
  sourceItemId: "training-camp";
  scheduledDate: GameDate;
  participantCount: number;
  grewPlayerCount: number;
  totalAbilityGrowth: number;
  topGrowth: TrainingCampTopGrowth[];
  averageFatigueChange: number;
  injuredPlayerIds: PlayerId[];
  specialAbilityChanges?: TrainingCampSpecialAbilityChange[];
}

export interface ShopGameEffects {
  nextTrainingGrowthBoost?: NextTrainingGrowthBoost;
  pendingTrainingCamp?: PendingTrainingCamp;
  trainingCampResult?: TrainingCampResult;
}

export const SPECIAL_COACH_FOCUS_ABILITIES = {
  spike: ["spike", "jump"],
  serve: ["serve", "mental"],
  receive: ["receive", "speed"],
  block: ["block", "jump"],
  physical: ["stamina", "speed", "jump"],
  decision: ["decision", "set", "mental"],
} as const;

export type SpecialCoachFocus = keyof typeof SPECIAL_COACH_FOCUS_ABILITIES;

export const SPECIAL_COACH_ACTIVITY = {
  baseGrowth: 8,
  fatigue: 6,
  injuryRisk: 4,
  trustGrowth: 3,
} as const;

export const TRAINING_CAMP_POSITION_ABILITIES = {
  OH: ["spike", "receive", "serve"],
  MB: ["block", "jump", "speed"],
  OP: ["spike", "serve", "block"],
  S: ["set", "decision", "speed"],
  L: ["receive", "speed", "mental"],
} as const;

export const TRAINING_CAMP_ACTIVITY = {
  baseGrowth: 3,
  fatigue: 12,
  injuryRisk: 5,
  trustGrowth: 2,
} as const;

export interface FatigueRecoveryResult {
  player: Player;
  before: {
    fatigue: number;
    condition: number;
  };
  after: {
    fatigue: number;
    condition: number;
  };
}

export function isFatigueRecoveryEligible(player: Player): boolean {
  return player.fatigue > 0 || player.condition < 100;
}

export function applyFatigueRecovery(player: Player): FatigueRecoveryResult {
  if (!isFatigueRecoveryEligible(player)) {
    throw new Error("fatigue recovery would be a no-op");
  }

  const fatigue = Math.max(0, player.fatigue - 40);
  const condition = Math.min(100, player.condition + 10);

  return {
    player: {
      ...player,
      fatigue,
      condition,
    },
    before: {
      fatigue: player.fatigue,
      condition: player.condition,
    },
    after: {
      fatigue,
      condition,
    },
  };
}
