import type { TraitDefinition } from "../validation/gameDataSchema";
import type { PlayerTier } from "../model/Player";
import type { RandomSource } from "../random/SeededRandom";

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
  const requestedPositiveCount =
    tier === "generational"
      ? random.int(2, 3)
      : tier === "prospect"
        ? random.int(1, 2)
        : random.int(0, 2);
  const selected = takeDistinctTraits(
    positiveTraits,
    requestedPositiveCount,
    random,
  );
  const weaknessChance =
    tier === "generational" ? 45 : tier === "prospect" ? 35 : 28;

  if (
    negativeTraits.length > 0 &&
    random.int(1, 100) <= weaknessChance
  ) {
    selected.push(random.pick(negativeTraits));
  }

  return selected.map((trait) => trait.id);
}
