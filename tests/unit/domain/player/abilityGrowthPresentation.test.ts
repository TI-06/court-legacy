import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  buildAbilityValueChanges,
  buildMatchGrowthPresentation,
} from "../../../../src/domain/player/abilityGrowthPresentation";

describe("ability growth presentation", () => {
  it("keeps exact before/after values and grade transitions", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    player.abilities.spike = 79;

    expect(buildAbilityValueChanges(player, { spike: 1 })).toEqual([
      {
        ability: "spike",
        before: 79,
        after: 80,
        delta: 1,
        beforeGrade: "B",
        afterGrade: "A",
      },
    ]);
  });

  it("reports only user-school players whose match experience changed", () => {
    const before = createDemoGame();
    const playerId = before.schools[before.userSchoolId]!.playerIds[0]!;
    const after = structuredClone(before);
    after.players[playerId]!.abilities.decision += 1;
    after.players[playerId]!.abilities.spike += 1;

    const growth = buildMatchGrowthPresentation(before, after);

    expect(growth.totalAbilityGrowth).toBe(2);
    expect(growth.players).toHaveLength(1);
    expect(growth.players[0]).toMatchObject({
      playerId,
      totalAbilityGrowth: 2,
      changes: expect.arrayContaining([
        expect.objectContaining({ ability: "decision", delta: 1 }),
        expect.objectContaining({ ability: "spike", delta: 1 }),
      ]),
    });
  });
});
