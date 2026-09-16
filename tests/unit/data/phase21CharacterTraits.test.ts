import { loadGameData } from "../../../src/data/dataRegistry";
import { rawGameData } from "../../../src/data/rawGameData";

const expectedTraitIds = [
  "character.analytical",
  "character.bottles-up",
  "character.caring",
  "character.clutch-support",
  "character.competitive-growth",
  "character.quiet-observer",
  "character.resilient",
  "character.spotlight",
  "character.team-first",
  "character.training-lover",
];

describe("Phase21 character trait catalog", () => {
  it("loads the fixed ten-trait character catalog separately from performance traits", () => {
    const data = loadGameData(rawGameData);

    expect(data.characterTraits.size).toBe(10);
    expect([...data.characterTraits.keys()].sort()).toEqual(expectedTraitIds);
    expect(data.characterTraits.get("character.caring")?.name).toBe(
      "面倒見がいい",
    );
    expect(data.traits.has("character.caring")).toBe(false);
  });

  it("gives every character trait at least one contextual discovery condition", () => {
    const data = loadGameData(rawGameData);

    for (const trait of data.characterTraits.values()) {
      expect(trait.discoveryConditions.length).toBeGreaterThan(0);
      expect(trait.discoveryConditions.length).toBeLessThanOrEqual(4);
      expect(trait.eventTags.length).toBeLessThanOrEqual(8);
      expect(trait.relationshipBias).toBeGreaterThanOrEqual(-10);
      expect(trait.relationshipBias).toBeLessThanOrEqual(10);
    }
  });
});
