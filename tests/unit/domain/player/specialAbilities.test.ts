import {
  getSpecialAbilityDefinition,
  SPECIAL_ABILITIES,
  SPECIAL_ABILITY_RARITY_BY_KIND,
} from "../../../../src/domain/player/specialAbilities";

describe("special ability catalog", () => {
  it("contains exactly 100 unique volleyball special abilities", () => {
    expect(SPECIAL_ABILITIES).toHaveLength(100);
    expect(new Set(SPECIAL_ABILITIES.map((ability) => ability.id)).size).toBe(
      100,
    );
  });

  it("keeps the intended positive, negative, elite, and gold distribution", () => {
    const counts = Object.fromEntries(
      ["positive", "negative", "elite", "gold"].map((kind) => [
        kind,
        SPECIAL_ABILITIES.filter((ability) => ability.kind === kind).length,
      ]),
    );

    expect(counts).toEqual({
      positive: 55,
      negative: 20,
      elite: 15,
      gold: 10,
    });
  });

  it("maps legacy kinds to the Phase50 rarity model without changing stable IDs", () => {
    expect(SPECIAL_ABILITY_RARITY_BY_KIND).toEqual({
      positive: "normal",
      negative: "negative",
      elite: "rare",
      gold: "super-rare",
    });
  });

  it("looks definitions up by stable ID", () => {
    expect(getSpecialAbilityDefinition("gold_absolute_ace")).toMatchObject({
      name: "絶対的エース",
      kind: "gold",
      category: "attack",
    });
    expect(
      getSpecialAbilityDefinition("missing-special-ability"),
    ).toBeUndefined();
  });
});
