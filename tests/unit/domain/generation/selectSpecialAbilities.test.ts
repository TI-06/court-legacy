import { selectInitialSpecialAbilityIds } from "../../../../src/domain/generation/selectSpecialAbilities";
import { playerId } from "../../../../src/domain/model/identifiers";
import { getSpecialAbilityDefinition } from "../../../../src/domain/player/specialAbilities";

describe("initial special ability selection", () => {
  it("is deterministic for the same player identity without consuming game RNG", () => {
    const input = {
      playerId: playerId("player-special-deterministic"),
      position: "OH" as const,
      tier: "elite" as const,
    };

    expect(selectInitialSpecialAbilityIds(input)).toEqual(
      selectInitialSpecialAbilityIds(input),
    );
  });

  it("gives stronger tiers more starting positive abilities", () => {
    const base = {
      playerId: playerId("player-special-tier"),
      position: "MB" as const,
    };
    const elite = selectInitialSpecialAbilityIds({
      ...base,
      tier: "elite",
    });
    const generational = selectInitialSpecialAbilityIds({
      ...base,
      tier: "generational",
    });

    const positiveCount = (ids: readonly string[]) =>
      ids.filter(
        (id) => getSpecialAbilityDefinition(id)?.kind === "positive",
      ).length;

    expect(positiveCount(elite)).toBe(2);
    expect(positiveCount(generational)).toBe(3);
  });

  it("uses position-relevant categories for starting positive abilities", () => {
    const ids = selectInitialSpecialAbilityIds({
      playerId: playerId("player-special-setter"),
      position: "S",
      tier: "monster",
    });
    const positiveCategories = ids
      .map((id) => getSpecialAbilityDefinition(id))
      .filter((ability) => ability?.kind === "positive")
      .map((ability) => ability!.category);

    expect(positiveCategories).toHaveLength(4);
    expect(
      positiveCategories.every((category) =>
        ["set", "mental", "team", "physical"].includes(category),
      ),
    ).toBe(true);
  });

  it("never grants elite or gold abilities at initial generation", () => {
    const ids = selectInitialSpecialAbilityIds({
      playerId: playerId("player-special-monster"),
      position: "OP",
      tier: "monster",
    });

    expect(
      ids.some((id) =>
        ["elite", "gold"].includes(
          getSpecialAbilityDefinition(id)?.kind ?? "missing",
        ),
      ),
    ).toBe(false);
  });
});
