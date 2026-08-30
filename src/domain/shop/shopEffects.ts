import type { Player } from "../model/Player";

export interface NextTrainingGrowthBoost {
  percent: 20;
  remainingUses: 1;
  sourceItemId: "training-efficiency-boost";
}

export interface ShopGameEffects {
  nextTrainingGrowthBoost?: NextTrainingGrowthBoost;
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
