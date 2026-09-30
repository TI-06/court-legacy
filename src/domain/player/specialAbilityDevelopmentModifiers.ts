import type { Player } from "../model/Player";

function abilitySet(player: Player): Set<string> {
  return new Set(player.specialAbilityIds ?? []);
}

export function getSpecialAbilityTrainingGrowthPercent(player: Player): number {
  const abilities = abilitySet(player);
  let percent = 100;
  if (abilities.has("growth_motivation")) percent += 8;
  if (abilities.has("growth_practice")) percent += 6;
  return percent;
}

export function adjustSpecialAbilityInjuryRisk(
  player: Player,
  baseRisk: number,
): number {
  const abilities = abilitySet(player);
  let multiplier = 1;
  if (abilities.has("physical_injury_resist")) multiplier *= 0.7;
  if (abilities.has("physical_injury_prone")) multiplier *= 1.35;
  return Math.max(0, Math.min(100, Math.round(baseRisk * multiplier)));
}

export function getSpecialAbilityCampAcquisitionChance(player: Player): number {
  return (player.specialAbilityIds ?? []).includes("growth_practice") ? 50 : 38;
}

export function getSpecialAbilityRecoveryValues(player: Player): {
  fatigueRecovery: number;
  conditionRecovery: number;
  restConditionBonus: number;
} {
  if ((player.specialAbilityIds ?? []).includes("physical_recovery")) {
    return {
      fatigueRecovery: 55,
      conditionRecovery: 15,
      restConditionBonus: 5,
    };
  }
  return {
    fatigueRecovery: 40,
    conditionRecovery: 10,
    restConditionBonus: 0,
  };
}
