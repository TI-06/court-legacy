import type { Player, Position } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";
import {
  MAX_SPECIAL_ABILITIES,
  SPECIAL_ABILITIES,
  SPECIAL_ABILITY_CONFLICTS,
  type SpecialAbilityCategory,
} from "./specialAbilities";
import { getSpecialAbilityTipChances } from "./specialAbilityDevelopmentModifiers";

export type SpecialAbilityProgressKind = "tip" | "learned" | "negative-removed";

export interface SpecialAbilityProgress {
  playerId: PlayerId;
  abilityId: string;
  kind: SpecialAbilityProgressKind;
  tipLevel?: 1 | 2;
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

const MAX_SPECIAL_ABILITY_TIPS = 16;

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

export function addSpecialAbilityTip(
  player: Player,
  abilityId: string,
  amount = 1,
): SpecialAbilityProgressResult {
  const owned = player.specialAbilityIds ?? [];
  if (owned.includes(abilityId) || amount <= 0) {
    return { player, changes: [] };
  }

  const existingTips = player.specialAbilityTipLevels ?? {};
  const current = existingTips[abilityId] ?? 0;
  if (
    current === 0 &&
    Object.keys(existingTips).length >= MAX_SPECIAL_ABILITY_TIPS
  ) {
    return { player, changes: [] };
  }
  const next = Math.min(3, current + amount) as 0 | 1 | 2 | 3;
  const tipLevels = { ...existingTips };

  if (next >= 3) {
    return learnSpecialAbility(
      {
        ...player,
        specialAbilityTipLevels: tipLevels,
      },
      abilityId,
    );
  }

  tipLevels[abilityId] = next;
  return {
    player: {
      ...player,
      specialAbilityIds: [...owned],
      specialAbilityTipLevels: tipLevels,
    },
    changes: [
      {
        playerId: player.id,
        abilityId,
        kind: "tip",
        tipLevel: next as 1 | 2,
      },
    ],
  };
}

export function learnSpecialAbility(
  player: Player,
  abilityId: string,
): SpecialAbilityProgressResult {
  const owned = player.specialAbilityIds ?? [];
  if (owned.includes(abilityId) || owned.length >= MAX_SPECIAL_ABILITIES) {
    return { player, changes: [] };
  }

  const tipLevels = { ...(player.specialAbilityTipLevels ?? {}) };
  delete tipLevels[abilityId];
  const conflictingAbilityId = SPECIAL_ABILITY_CONFLICTS[abilityId];
  if (conflictingAbilityId) {
    delete tipLevels[conflictingAbilityId];
  }
  const withoutConflict = conflictingAbilityId
    ? owned.filter((id) => id !== conflictingAbilityId)
    : [...owned];

  return {
    player: {
      ...player,
      specialAbilityIds: [...withoutConflict, abilityId],
      specialAbilityTipLevels: tipLevels,
    },
    changes: [
      {
        playerId: player.id,
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
  const owned = player.specialAbilityIds ?? [];
  if (!owned.includes(abilityId)) {
    return { player, changes: [] };
  }

  return {
    player: {
      ...player,
      specialAbilityIds: owned.filter((id) => id !== abilityId),
    },
    changes: [
      {
        playerId: player.id,
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
  let current = player;
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

  const acquisitionChance = getSpecialAbilityTipChances(current);
  if (
    random.int(1, 100) <=
    Math.min(100, acquisitionChance.progressPercent + bonusPercent)
  ) {
    const candidates = positiveCandidates(current);
    if (candidates.length > 0) {
      const learned = learnSpecialAbility(current, random.pick(candidates));
      current = learned.player;
      changes.push(...learned.changes);
    }
  }

  return { player: current, changes };
}
