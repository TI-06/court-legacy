import { gameDataBootstrap } from "../../../../src/data/gameData";
import { selectPlayerTraitIds } from "../../../../src/domain/generation/selectPlayerTraits";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}

const data = gameDataBootstrap.data;

describe("selectPlayerTraitIds", () => {
  it("caps generational trait selection at the available positive catalog", () => {
    const onlyPositive = [...data.traits.values()].find(
      (trait) => trait.polarity === "positive",
    );

    expect(onlyPositive).toBeDefined();
    if (!onlyPositive) {
      return;
    }

    const sparseTraits = new Map([[onlyPositive.id, onlyPositive]]);

    for (let index = 0; index < 20; index += 1) {
      expect(
        selectPlayerTraitIds(
          "generational",
          sparseTraits,
          new SeededRandom(`sparse-positive-${index}`),
        ),
      ).toEqual([onlyPositive.id]);
    }
  });

  it("does not fail when the catalog contains no negative traits", () => {
    const positiveTraits = new Map(
      [...data.traits.values()]
        .filter((trait) => trait.polarity === "positive")
        .slice(0, 3)
        .map((trait) => [trait.id, trait]),
    );

    for (let index = 0; index < 40; index += 1) {
      const selected = selectPlayerTraitIds(
        "normal",
        positiveTraits,
        new SeededRandom(`no-negative-${index}`),
      );

      expect(new Set(selected).size).toBe(selected.length);
      expect(selected.every((id) => positiveTraits.has(id))).toBe(true);
    }
  });

  it("returns unique IDs from the complete catalog", () => {
    for (let index = 0; index < 40; index += 1) {
      const selected = selectPlayerTraitIds(
        "generational",
        data.traits,
        new SeededRandom(`full-traits-${index}`),
      );

      expect(new Set(selected).size).toBe(selected.length);
      expect(selected.length).toBeGreaterThanOrEqual(2);
      expect(selected.every((id) => data.traits.has(id))).toBe(true);
    }
  });
});
