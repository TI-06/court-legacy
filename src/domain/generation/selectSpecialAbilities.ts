import type { PlayerId } from "../model/identifiers";
import type { PlayerTier, Position } from "../model/Player";
import {
  SPECIAL_ABILITIES,
  type SpecialAbilityCategory,
  type SpecialAbilityDefinition,
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
  normal: 0,
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

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function scoreAbility(
  playerId: PlayerId,
  position: Position,
  tier: PlayerTier,
  ability: SpecialAbilityDefinition,
): number {
  const categoryIndex = preferredCategories[position].indexOf(ability.category);
  const categoryBonus =
    categoryIndex === -1
      ? 0
      : (preferredCategories[position].length - categoryIndex) * 100_000;

  return (
    categoryBonus +
    (hashString(\`\${playerId}:\${position}:\${tier}:\${ability.id}\`) %
      100_000)
  );
}

function rankCandidates(
  input: InitialSpecialAbilityInput,
  kind: "positive" | "negative",
): SpecialAbilityDefinition[] {
  return SPECIAL_ABILITIES.filter((ability) => ability.kind === kind).sort(
    (left, right) =>
      scoreAbility(input.playerId, input.position, input.tier, right) -
        scoreAbility(input.playerId, input.position, input.tier, left) ||
      left.id.localeCompare(right.id),
  );
}

export function selectInitialSpecialAbilityIds(
  input: InitialSpecialAbilityInput,
): string[] {
  const positiveRoll =
    hashString(\`\${input.playerId}:special-positive\`) % 100;
  const negativeRoll =
    hashString(\`\${input.playerId}:special-negative\`) % 100;
  const positiveCount =
    positiveRoll < positiveChanceByTier[input.tier]
      ? Math.max(1, positiveCountByTier[input.tier])
      : 0;

  const selected = rankCandidates(input, "positive")
    .slice(0, positiveCount)
    .map((ability) => ability.id);

  if (negativeRoll < negativeChanceByTier[input.tier]) {
    const negative = rankCandidates(input, "negative")[0];
    if (negative) {
      selected.push(negative.id);
    }
  }

  return selected;
}
