import type { Player, Position } from "../model/Player";
import type { PlayerId } from "../model/identifiers";
import type { RandomSource } from "../random/SeededRandom";
import {
  SPECIAL_ABILITIES,
  type SpecialAbilityCategory,
} from "./specialAbilities";

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

const MAX_SPECIAL_ABILITIES = 24;
const MAX_SPECIAL_ABILITY_TIPS = 16;

export interface SpecialAbilityUpgradeRule {
  abilityId: string;
  kind: "elite" | "gold";
  requiredAbilityIds: readonly string[];
}

export const SPECIAL_ABILITY_UPGRADE_RULES: readonly SpecialAbilityUpgradeRule[] =
  [
    {
      abilityId: "elite_serve_craftsman",
      kind: "elite",
      requiredAbilityIds: ["serve_stable", "serve_aim", "float_mastery"],
    },
    {
      abilityId: "elite_service_ace",
      kind: "elite",
      requiredAbilityIds: [
        "jump_serve_mastery",
        "serve_streak",
        "receive_breaker",
      ],
    },
    {
      abilityId: "elite_serve_hunter",
      kind: "elite",
      requiredAbilityIds: ["serve_aim", "receive_breaker", "serve_bold"],
    },
    {
      abilityId: "elite_court_hitter",
      kind: "elite",
      requiredAbilityIds: ["attack_course", "attack_line", "attack_cross"],
    },
    {
      abilityId: "elite_block_crusher",
      kind: "elite",
      requiredAbilityIds: [
        "attack_blockout",
        "attack_high_contact",
        "attack_clutch",
      ],
    },
    {
      abilityId: "elite_fast_finisher",
      kind: "elite",
      requiredAbilityIds: ["attack_quick", "attack_transition", "mental_focus"],
    },
    {
      abilityId: "elite_allround_attacker",
      kind: "elite",
      requiredAbilityIds: [
        "attack_backrow",
        "attack_out_of_system",
        "attack_transition",
      ],
    },
    {
      abilityId: "elite_game_maker",
      kind: "elite",
      requiredAbilityIds: ["set_stable", "set_distribution", "set_quick_link"],
    },
    {
      abilityId: "elite_deception_set",
      kind: "elite",
      requiredAbilityIds: ["set_back", "set_distribution", "set_emergency"],
    },
    {
      abilityId: "elite_defense_craftsman",
      kind: "elite",
      requiredAbilityIds: ["receive_dig", "receive_range", "receive_cover"],
    },
    {
      abilityId: "elite_receive_wall",
      kind: "elite",
      requiredAbilityIds: ["receive_serve", "receive_power", "receive_connect"],
    },
    {
      abilityId: "elite_block_commander",
      kind: "elite",
      requiredAbilityIds: ["block_read", "block_team", "block_close"],
    },
    {
      abilityId: "elite_shutdown",
      kind: "elite",
      requiredAbilityIds: ["block_commit", "block_touch", "block_side"],
    },
    {
      abilityId: "elite_clutch",
      kind: "elite",
      requiredAbilityIds: ["mental_clutch", "mental_focus", "mental_reset"],
    },
    {
      abilityId: "elite_steel_mental",
      kind: "elite",
      requiredAbilityIds: ["mental_comeback", "mental_calm", "mental_tournament"],
    },
    {
      abilityId: "gold_absolute_ace",
      kind: "gold",
      requiredAbilityIds: [
        "elite_court_hitter",
        "elite_block_crusher",
        "elite_clutch",
      ],
    },
    {
      abilityId: "gold_serve_king",
      kind: "gold",
      requiredAbilityIds: [
        "elite_serve_craftsman",
        "elite_service_ace",
        "elite_serve_hunter",
      ],
    },
    {
      abilityId: "gold_commander",
      kind: "gold",
      requiredAbilityIds: [
        "elite_game_maker",
        "elite_deception_set",
        "team_captaincy",
      ],
    },
    {
      abilityId: "gold_guardian",
      kind: "gold",
      requiredAbilityIds: [
        "elite_defense_craftsman",
        "elite_receive_wall",
        "mental_calm",
      ],
    },
    {
      abilityId: "gold_iron_wall",
      kind: "gold",
      requiredAbilityIds: [
        "elite_block_commander",
        "elite_shutdown",
        "block_team",
      ],
    },
    {
      abilityId: "gold_flow_controller",
      kind: "gold",
      requiredAbilityIds: ["elite_clutch", "team_mood", "team_captaincy"],
    },
    {
      abilityId: "gold_indomitable",
      kind: "gold",
      requiredAbilityIds: [
        "elite_steel_mental",
        "elite_clutch",
        "mental_comeback",
      ],
    },
    {
      abilityId: "gold_total_player",
      kind: "gold",
      requiredAbilityIds: [
        "elite_allround_attacker",
        "elite_defense_craftsman",
        "physical_stamina",
      ],
    },
    {
      abilityId: "gold_ultra_quick",
      kind: "gold",
      requiredAbilityIds: [
        "elite_fast_finisher",
        "attack_quick",
        "set_quick_link",
      ],
    },
    {
      abilityId: "gold_court_brain",
      kind: "gold",
      requiredAbilityIds: [
        "elite_game_maker",
        "elite_block_commander",
        "block_read",
      ],
    },
  ];

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
  if (owned.includes(abilityId) || owned.length >= MAX_SPECIAL_ABILITIES) {
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

export function eligibleSpecialAbilityUpgradeIds(
  player: Player,
  kind: "elite" | "gold",
): string[] {
  const owned = new Set(player.specialAbilityIds ?? []);
  return SPECIAL_ABILITY_UPGRADE_RULES.filter(
    (rule) =>
      rule.kind === kind &&
      !owned.has(rule.abilityId) &&
      rule.requiredAbilityIds.every((id) => owned.has(id)),
  ).map((rule) => rule.abilityId);
}

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

  const goldCandidates = eligibleSpecialAbilityUpgradeIds(current, "gold");
  if (goldCandidates.length > 0 && random.int(1, 100) <= 2) {
    const upgraded = learnSpecialAbility(current, random.pick(goldCandidates));
    return {
      player: upgraded.player,
      changes: [...changes, ...upgraded.changes],
    };
  }

  const eliteCandidates = eligibleSpecialAbilityUpgradeIds(current, "elite");
  if (eliteCandidates.length > 0 && random.int(1, 100) <= 8) {
    const upgraded = learnSpecialAbility(current, random.pick(eliteCandidates));
    current = upgraded.player;
    changes.push(...upgraded.changes);
  }

  return { player: current, changes };
}
