import type { Player, Position } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";
import {
  SPECIAL_ABILITIES,
  type SpecialAbilityCategory,
} from "./specialAbilities";

export type SpecialAbilityProgressKind =
  | "tip"
  | "learned"
  | "negative-removed";

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

const POSITION_CATEGORIES: Record<
  Position,
  readonly SpecialAbilityCategory[]
> = {
  OH: ["attack", "serve", "receive", "mental", "physical"],
  MB: ["block", "attack", "physical", "mental"],
  OP: ["attack", "serve", "mental", "physical"],
  S: ["set", "mental", "team", "physical"],
  L: ["receive", "mental", "physical", "team"],
};

const MAX_SPECIAL_ABILITIES = 24;
const MAX_SPECIAL_ABILITY_TIPS = 16;

const CONFLICTING_SPECIAL_ABILITIES: Readonly<Record<string, string>> = {
  serve_stable: "serve_unstable",
  serve_unstable: "serve_stable",
  attack_quick: "attack_quick_bad",
  attack_quick_bad: "attack_quick",
  set_stable: "set_unstable",
  set_unstable: "set_stable",
  set_emergency: "set_emergency_bad",
  set_emergency_bad: "set_emergency",
  receive_serve: "receive_weak",
  receive_weak: "receive_serve",
  receive_power: "receive_power_fear",
  receive_power_fear: "receive_power",
  receive_tip: "receive_tip_bad",
  receive_tip_bad: "receive_tip",
  receive_cover: "receive_cover_slow",
  receive_cover_slow: "receive_cover",
  mental_clutch: "mental_choke",
  mental_choke: "mental_clutch",
  physical_injury_resist: "physical_injury_prone",
  physical_injury_prone: "physical_injury_resist",
};

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
  if (
    owned.includes(abilityId) ||
    owned.length >= MAX_SPECIAL_ABILITIES
  ) {
    return { player, changes: [] };
  }

  const tipLevels = { ...(player.specialAbilityTipLevels ?? {}) };
  delete tipLevels[abilityId];
  const conflictingAbilityId = CONFLICTING_SPECIAL_ABILITIES[abilityId];
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
): SpecialAbilityProgressResult {
  let current = player;
  const changes: SpecialAbilityProgress[] = [];
  const negatives = negativeAbilities(current);

  if (negatives.length > 0 && random.int(1, 100) <= 18) {
    const removed = removeNegativeSpecialAbility(
      current,
      random.pick(negatives),
    );
    current = removed.player;
    changes.push(...removed.changes);
  }

  if (random.int(1, 100) <= 38) {
    const candidates = positiveCandidates(current);
    if (candidates.length > 0) {
      const tipAmount = random.int(1, 100) <= 12 ? 2 : 1;
      const progressed = addSpecialAbilityTip(
        current,
        random.pick(candidates),
        tipAmount,
      );
      current = progressed.player;
      changes.push(...progressed.changes);
    }
  }

  return { player: current, changes };
}
