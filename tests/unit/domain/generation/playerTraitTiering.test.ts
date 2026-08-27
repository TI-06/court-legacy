import { gameDataBootstrap } from "../../../../src/data/gameData";
import { selectPlayerTraitIds } from "../../../../src/domain/generation/selectPlayerTraits";
import type { PlayerTier } from "../../../../src/domain/model/Player";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;
const TIERS: readonly PlayerTier[] = [
  "normal",
  "promising",
  "elite",
  "generational",
  "monster",
];

function averagePositiveTraits(tier: PlayerTier): number {
  let total = 0;
  const samples = 240;
  for (let index = 0; index < samples; index += 1) {
    const selected = selectPlayerTraitIds(
      tier,
      data.traits,
      new SeededRandom(`trait-tier-${index}`),
    );
    total += selected.filter(
      (id) => data.traits.get(id)?.polarity === "positive",
    ).length;
  }
  return total / samples;
}

describe("player trait tier weighting", () => {
  it("supports all five tiers and increases positive-trait expectation gradually", () => {
    const averages = TIERS.map(averagePositiveTraits);

    expect(averages[1]).toBeGreaterThan(averages[0]!);
    expect(averages[2]).toBeGreaterThan(averages[1]!);
    expect(averages[3]).toBeGreaterThanOrEqual(averages[2]!);
    expect(averages[4]).toBeGreaterThanOrEqual(averages[3]!);
  });

  it("allows rare positive traits for top tiers without guaranteeing them", () => {
    const rarePositiveIds = new Set(
      [...data.traits.values()]
        .filter((trait) => trait.polarity === "positive" && trait.rarity <= 25)
        .map((trait) => trait.id),
    );

    expect(rarePositiveIds.size).toBeGreaterThan(0);

    const monsterSelections = Array.from({ length: 160 }, (_, index) =>
      selectPlayerTraitIds(
        "monster",
        data.traits,
        new SeededRandom(`monster-traits-${index}`),
      ),
    );

    expect(
      monsterSelections.some((ids) =>
        ids.some((id) => rarePositiveIds.has(id)),
      ),
    ).toBe(true);
    expect(
      monsterSelections.some((ids) =>
        ids.every((id) => !rarePositiveIds.has(id)),
      ),
    ).toBe(true);
  });
});
