import type { PlayerId } from "../model/identifiers";
import type { PlayerTier, Position } from "../model/Player";
import {
  SPECIAL_ABILITIES,
  type SpecialAbilityCategory,
} from "../player/specialAbilities";

interface InitialSpecialAbilityInput {
  playerId: PlayerId;
  position: Position;
  tier: PlayerTier;
}

const preferredCategories: Record<
  Position,
  readonly SpecialAbilityCategory[]
> = {
  OH: ["attack", "serve", "receive", "mental", "physical"],
  MB: ["block", "attack", "physical", "mental"],
  OP: ["attack", "serve", "mental", "physical"],
  S: ["set", "mental", "team", "physical"],
  L: ["receive", "mental", "physical", "team"],
};

const positiveCountByTier: Record<PlayerTier, number> = {
  normal: 1,
  promising: 1,
  prospect: 1,
  elite: 2,
  generational: 3,
  monster: 4,
};

const positiveChanceByTier: Record<PlayerTier, number> = {
  normal: 42,
  promising: 100,
  prospect: 100,
  elite: 100,
  generational: 100,
  monster: 100,
};

const negativeChanceByTier: Record<PlayerTier, number> = {
  normal: 16,
  promising: 13,
  prospect: 13,
  elite: 9,
  generational: 6,
  monster: 4,
};

function abilityIdsFor(
  position: Position,
  kind: "positive" | "negative",
): string[] {
  const preferred = new Set(preferredCategories[position]);
  return SPECIAL_ABILITIES.filter(
    (ability) => ability.kind === kind && preferred.has(ability.category),
  ).map((ability) => ability.id);
}

const positiveIdsByPosition: Record<Position, readonly string[]> = {
  OH: abilityIdsFor("OH", "positive"),
  MB: abilityIdsFor("MB", "positive"),
  OP: abilityIdsFor("OP", "positive"),
  S: abilityIdsFor("S", "positive"),
  L: abilityIdsFor("L", "positive"),
};

const negativeIdsByPosition: Record<Position, readonly string[]> = {
  OH: abilityIdsFor("OH", "negative"),
  MB: abilityIdsFor("MB", "negative"),
  OP: abilityIdsFor("OP", "negative"),
  S: abilityIdsFor("S", "negative"),
  L: abilityIdsFor("L", "negative"),
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectPositiveIds(
  input: InitialSpecialAbilityInput,
  count: number,
): string[] {
  const candidates = positiveIdsByPosition[input.position];
  if (count <= 0 || candidates.length === 0) return [];

  const selected: string[] = [];
  const used = new Set<number>();

  for (let slot = 0; slot < count; slot += 1) {
    let index =
      hashString(
        [
          input.playerId,
          input.position,
          input.tier,
          "positive",
          String(slot),
        ].join(":"),
      ) % candidates.length;

    while (used.has(index)) {
      index = (index + 1) % candidates.length;
    }

    used.add(index);
    selected.push(candidates[index]!);
  }

  return selected;
}

function selectNegativeId(
  input: InitialSpecialAbilityInput,
): string | undefined {
  const candidates = negativeIdsByPosition[input.position];
  if (candidates.length === 0) return undefined;
  const index =
    hashString(
      [input.playerId, input.position, input.tier, "negative"].join(":"),
    ) % candidates.length;
  return candidates[index];
}

export function selectInitialSpecialAbilityIds(
  input: InitialSpecialAbilityInput,
): string[] {
  const positiveRoll =
    hashString([input.playerId, "special-positive"].join(":")) % 100;
  const negativeRoll =
    hashString([input.playerId, "special-negative"].join(":")) % 100;
  const positiveCount =
    positiveRoll < positiveChanceByTier[input.tier]
      ? positiveCountByTier[input.tier]
      : 0;
  const selected = selectPositiveIds(input, positiveCount);

  if (negativeRoll < negativeChanceByTier[input.tier]) {
    const negativeId = selectNegativeId(input);
    if (negativeId) selected.push(negativeId);
  }

  return selected;
}
