import { ABILITY_KEYS, clampAbility, type Player } from "../model/Player";
import type { SchoolReputation } from "../model/School";

export interface RivalSchoolBalanceProfile {
  recruitAbilityBonus: number;
  annualBaseGrowth: number;
}

const PROFILES: Record<SchoolReputation, RivalSchoolBalanceProfile> = {
  unknown: {
    recruitAbilityBonus: 0,
    annualBaseGrowth: 2,
  },
  "district-contender": {
    recruitAbilityBonus: 2,
    annualBaseGrowth: 3,
  },
  "prefectural-power": {
    recruitAbilityBonus: 4,
    annualBaseGrowth: 5,
  },
  "national-qualifier": {
    recruitAbilityBonus: 7,
    annualBaseGrowth: 7,
  },
  "national-regular": {
    recruitAbilityBonus: 9,
    annualBaseGrowth: 9,
  },
  elite: {
    recruitAbilityBonus: 12,
    annualBaseGrowth: 11,
  },
};

export function rivalSchoolBalanceProfile(
  reputation: SchoolReputation,
): RivalSchoolBalanceProfile {
  return PROFILES[reputation];
}

export function applyRivalRecruitAbilityBonus(
  player: Player,
  abilityBonus: number,
): Player {
  if (abilityBonus <= 0) {
    return player;
  }

  const abilities = { ...player.abilities };
  for (const ability of ABILITY_KEYS) {
    abilities[ability] = clampAbility(abilities[ability] + abilityBonus);
  }

  return {
    ...player,
    abilities,
  };
}
