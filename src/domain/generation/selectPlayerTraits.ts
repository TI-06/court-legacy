import type { PlayerTier } from "../model/Player";
import type { RandomSource } from "../random/SeededRandom";
import type { TraitDefinition } from "../validation/gameDataSchema";

function takeDistinctTraits(
  traits: readonly TraitDefinition[],
  count: number,
  random: RandomSource,
): TraitDefinition[] {
  const available = [...traits];
  const selected: TraitDefinition[] = [];
  const selectionCount = Math.min(count, available.length);

  while (selected.length < selectionCount) {
    const index = random.int(0, available.length - 1);
    const [trait] = available.splice(index, 1);

    if (!trait) {
      throw new Error("trait selection produced an invalid index");
    }
    selected.push(trait);
  }

  return selected;
}

function requestedPositiveTraitCount(
  tier: PlayerTier,
  random: RandomSource,
): number {
  switch (tier) {
    case "normal":
      return random.int(0, 1);
    case "promising":
    case "prospect":
      return random.int(1, 2);
    case "elite":
      return 2;
    case "generational":
      return random.int(2, 3);
    case "monster":
      return random.int(3, 4);
  }
}

function weaknessChance(tier: PlayerTier): number {
  switch (tier) {
    case "normal":
      return 28;
    case "promising":
    case "prospect":
      return 34;
    case "elite":
      return 38;
    case "generational":
      return 45;
    case "monster":
      return 50;
  }
}

export function selectPlayerTraitIds(
  tier: PlayerTier,
  traits: ReadonlyMap<string, TraitDefinition>,
  random: RandomSource,
): string[] {
  const positiveTraits = [...traits.values()].filter(
    (trait) => trait.polarity === "positive",
  );
  const negativeTraits = [...traits.values()].filter(
    (trait) => trait.polarity === "negative",
  );
  const selected = takeDistinctTraits(
    positiveTraits,
    requestedPositiveTraitCount(tier, random),
    random,
  );

  if (negativeTraits.length > 0 && random.int(1, 100) <= weaknessChance(tier)) {
    selected.push(random.pick(negativeTraits));
  }

  return selected.map((trait) => trait.id);
}
