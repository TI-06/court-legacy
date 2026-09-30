import type { Player, Position } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";
import {
  MAX_SPECIAL_ABILITIES,
  SPECIAL_ABILITIES,
  SPECIAL_ABILITY_CONFLICTS,
  type SpecialAbilityCategory,
} from "./specialAbilities";
import { getSpecialAbilityCampAcquisitionChance } from "./specialAbilityDevelopmentModifiers";

export type SpecialAbilityProgressKind = "learned" | "negative-removed";

export interface SpecialAbilityProgress {
  playerId: PlayerId;
  abilityId: string;
  kind: SpecialAbilityProgressKind;
}

export interface SpecialAbilityProgressResult {
  player: Player;
  changes: SpecialAbilityProgress[];
}

const POSITION_CATEGORIES: Record<Position, readonly SpecialAbilityCategory[]> =
  {
    OH: ["attack", "serve", "receive", "mental", "physical"],
    MB: ["block", "attack", "physical", "mental"],
    OP: ["attack", "serve", "mental", "physical"],
    S: ["set", "mental", "team", "physical"],
    L: ["receive", "mental", "physical", "team"],
  };

function withoutLegacySpecialAbilityTips(player: Player): Player {
  if (!player.specialAbilityTipLevels) return player;
  const { specialAbilityTipLevels: _legacyTips, ...cleanPlayer } = player;
  return cleanPlayer;
}

function positiveCandidates(player: Player): string[] {
  const owned = new Set(player.specialAbilityIds ?? []);
  const preferred = new Set(POSITION_CATEGORIES[player.preferredPosition]);

  return SPECIAL_ABILITIES.filter(
    (ability) =>
      ability.kind === "positive" &&
      preferred.has(ability.category) &&
      !owned.has(ability.id),
  ).map((ability) => ability.id);
}

function negativeAbilities(player: Player): string[] {
  const owned = new Set(player.specialAbilityIds ?? []);

  return SPECIAL_ABILITIES.filter(
    (ability) => ability.kind === "negative" && owned.has(ability.id),
  ).map((ability) => ability.id);
}

export function learnSpecialAbility(
  player: Player,
  abilityId: string,
): SpecialAbilityProgressResult {
  const cleanPlayer = withoutLegacySpecialAbilityTips(player);
  const owned = cleanPlayer.specialAbilityIds ?? [];
  if (owned.includes(abilityId) || owned.length >= MAX_SPECIAL_ABILITIES) {
    return { player: cleanPlayer, changes: [] };
  }

  const conflictingAbilityId = SPECIAL_ABILITY_CONFLICTS[abilityId];
  const withoutConflict = conflictingAbilityId
    ? owned.filter((id) => id !== conflictingAbilityId)
    : [...owned];

  return {
    player: {
      ...cleanPlayer,
      specialAbilityIds: [...withoutConflict, abilityId],
    },
    changes: [
      {
        playerId: cleanPlayer.id,
        abilityId,
        kind: "learned",
      },
    ],
  };
}

export function removeSpecialAbility(
  player: Player,
  abilityId: string,
): SpecialAbilityProgressResult {
  const cleanPlayer = withoutLegacySpecialAbilityTips(player);
  const owned = cleanPlayer.specialAbilityIds ?? [];
  if (!owned.includes(abilityId)) {
    return { player: cleanPlayer, changes: [] };
  }

  return {
    player: {
      ...cleanPlayer,
      specialAbilityIds: owned.filter((id) => id !== abilityId),
    },
    changes: [
      {
        playerId: cleanPlayer.id,
        abilityId,
        kind: "negative-removed",
      },
    ],
  };
}

export const removeNegativeSpecialAbility = removeSpecialAbility;

export function resolveTrainingCampSpecialAbilityProgress(
  player: Player,
  random: RandomSource,
  bonusPercent = 0,
): SpecialAbilityProgressResult {
  let current = withoutLegacySpecialAbilityTips(player);
  const changes: SpecialAbilityProgress[] = [];
  const negatives = negativeAbilities(current);

  if (
    negatives.length > 0 &&
    random.int(1, 100) <= Math.min(100, 18 + bonusPercent)
  ) {
    const removed = removeNegativeSpecialAbility(
      current,
      random.pick(negatives),
    );
    current = removed.player;
    changes.push(...removed.changes);
  }

  const acquisitionChance = Math.min(
    100,
    getSpecialAbilityCampAcquisitionChance(current) + bonusPercent,
  );
  if (random.int(1, 100) <= acquisitionChance) {
    const candidates = positiveCandidates(current);
    if (candidates.length > 0) {
      const learned = learnSpecialAbility(current, random.pick(candidates));
      current = learned.player;
      changes.push(...learned.changes);
    }
  }

  return { player: current, changes };
}
