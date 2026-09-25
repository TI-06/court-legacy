import { createDemoGame } from "../../../../src/app/createDemoGame";
import type {
  Player,
  PlayerAbilities,
} from "../../../../src/domain/model/Player";
import {
  SPECIAL_ABILITIES,
  type SpecialAbilityKind,
} from "../../../../src/domain/player/specialAbilities";
import {
  adjustSpecialAbilityInjuryRisk,
  getSpecialAbilityRecoveryValues,
  getSpecialAbilityTipChances,
  getSpecialAbilityTrainingGrowthPercent,
} from "../../../../src/domain/player/specialAbilityDevelopmentModifiers";
import {
  getServeSpecialAbilityAdjustment,
  getSpecialAbilityAbilityDelta,
  type MatchSpecialAbilitySituation,
} from "../../../../src/domain/player/specialAbilityMatchModifiers";

const ABILITY_KEYS: readonly (keyof PlayerAbilities)[] = [
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

const MATCH_SITUATIONS: readonly MatchSpecialAbilitySituation[] = [
  {
    ownScore: 2,
    opponentScore: 2,
    setNumber: 1,
    bestOfSets: 3,
  },
  {
    ownScore: 8,
    opponentScore: 7,
    setNumber: 1,
    bestOfSets: 3,
  },
  {
    ownScore: 10,
    opponentScore: 14,
    setNumber: 1,
    bestOfSets: 3,
  },
  {
    ownScore: 23,
    opponentScore: 22,
    setNumber: 1,
    bestOfSets: 3,
  },
  {
    ownScore: 13,
    opponentScore: 12,
    setNumber: 3,
    bestOfSets: 3,
  },
];

function basePlayer(): Player {
  const state = createDemoGame();
  const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
  return structuredClone(state.players[playerId]!);
}

function playerWithSpecialAbility(player: Player, abilityId: string): Player {
  return {
    ...player,
    specialAbilityIds: [abilityId],
  };
}

function hasMatchEffect(player: Player): boolean {
  return MATCH_SITUATIONS.some((situation) => {
    const abilityEffect = ABILITY_KEYS.some(
      (ability) =>
        getSpecialAbilityAbilityDelta(player, ability, situation) !== 0,
    );
    const serveAdjustment = getServeSpecialAbilityAdjustment(player, situation);
    const serveEffect = Object.values(serveAdjustment).some(
      (value) => value !== 0,
    );
    return abilityEffect || serveEffect;
  });
}

function hasDevelopmentEffect(player: Player, baseline: Player): boolean {
  if (
    getSpecialAbilityTrainingGrowthPercent(player) !==
    getSpecialAbilityTrainingGrowthPercent(baseline)
  ) {
    return true;
  }
  if (
    adjustSpecialAbilityInjuryRisk(player, 20) !==
    adjustSpecialAbilityInjuryRisk(baseline, 20)
  ) {
    return true;
  }
  if (
    JSON.stringify(getSpecialAbilityTipChances(player)) !==
    JSON.stringify(getSpecialAbilityTipChances(baseline))
  ) {
    return true;
  }
  return (
    JSON.stringify(getSpecialAbilityRecoveryValues(player)) !==
    JSON.stringify(getSpecialAbilityRecoveryValues(baseline))
  );
}

describe("special ability gameplay effect coverage", () => {
  it("keeps the initial catalog at exactly 100 abilities with the intended kind split", () => {
    expect(SPECIAL_ABILITIES).toHaveLength(100);

    const counts = SPECIAL_ABILITIES.reduce<Record<SpecialAbilityKind, number>>(
      (result, ability) => {
        result[ability.kind] += 1;
        return result;
      },
      {
        positive: 0,
        negative: 0,
        elite: 0,
        gold: 0,
      },
    );

    expect(counts).toEqual({
      positive: 55,
      negative: 20,
      elite: 15,
      gold: 10,
    });
  });

  it("ensures every special ability changes either match play or player development", () => {
    const baseline = basePlayer();
    baseline.specialAbilityIds = [];

    const missingEffectIds = SPECIAL_ABILITIES.flatMap((ability) => {
      const player = playerWithSpecialAbility(baseline, ability.id);
      return hasMatchEffect(player) || hasDevelopmentEffect(player, baseline)
        ? []
        : [ability.id];
    });

    expect(missingEffectIds).toEqual([]);
  });
});
