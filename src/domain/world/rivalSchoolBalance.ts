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
