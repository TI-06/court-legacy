import type { RandomSource } from "./SeededRandom";

export interface WeightedItem<T> {
  value: T;
  weight: number;
}

export function weightedChoice<T>(
  items: readonly WeightedItem<T>[],
  random: RandomSource,
): T | null {
  let totalWeight = 0;

  for (const item of items) {
    if (!Number.isFinite(item.weight) || item.weight < 0) {
      throw new Error("weight must be a non-negative finite number");
    }

    totalWeight += item.weight;
  }

  if (totalWeight === 0) {
    return null;
  }

  const target = random.next() * totalWeight;
  let cumulativeWeight = 0;
  let lastPositiveValue: T | null = null;

  for (const item of items) {
    if (item.weight === 0) {
      continue;
    }

    lastPositiveValue = item.value;
    cumulativeWeight += item.weight;

    if (target < cumulativeWeight) {
      return item.value;
    }
  }

  return lastPositiveValue;
}
