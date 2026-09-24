import type { Player } from "../model/Player";
import type { AdditionalGrowthModifier } from "../training/calculateGrowth";

export function specialAbilityTrainingModifiers(
  player: Player,
): AdditionalGrowthModifier[] {
  const ids = new Set(player.specialAbilityIds ?? []);
  const modifiers: AdditionalGrowthModifier[] = [];

  if (ids.has("growth_motivation")) {
    modifiers.push({
      code: "special-ability-motivation",
      label: "成長意欲○",
      percent: 105,
    });
  }

  if (ids.has("growth_practice")) {
    modifiers.push({
      code: "special-ability-practice",
      label: "練習上手",
      percent: 108,
    });
  }

  return modifiers;
}

export function restConditionRecoveryBonus(player: Player): number {
  return (player.specialAbilityIds ?? []).includes("physical_recovery") ? 8 : 0;
}
