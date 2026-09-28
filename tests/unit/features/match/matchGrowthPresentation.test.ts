import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { buildMatchGrowthSummary } from "../../../../src/features/match/matchGrowthPresentation";

describe("matchGrowthPresentation", () => {
  it("shows only changed user-school abilities with exact values and grades", () => {
    const before = createDemoGame();
    const playerId = before.schools[before.userSchoolId]!.playerIds[0]!;
    const player = before.players[playerId]!;
    const after = structuredClone(before);

    after.players[playerId] = {
      ...after.players[playerId]!,
      abilities: {
        ...after.players[playerId]!.abilities,
        spike: 70,
        decision: 81,
      },
    };
    before.players[playerId] = {
      ...player,
      abilities: {
        ...player.abilities,
        spike: 68,
        decision: 79,
      },
    };

    const summary = buildMatchGrowthSummary(before, after);

    expect(summary?.players).toHaveLength(1);
    expect(summary?.players[0]?.playerId).toBe(playerId);
    expect(summary?.players[0]?.abilities).toEqual([
      {
        ability: "spike",
        before: 68,
        after: 70,
        delta: 2,
        beforeGrade: "C",
        afterGrade: "B",
      },
      {
        ability: "decision",
        before: 79,
        after: 81,
        delta: 2,
        beforeGrade: "B",
        afterGrade: "A",
      },
    ]);
  });

  it("returns null when the match produced no ability growth", () => {
    const state = createDemoGame();
    expect(buildMatchGrowthSummary(state, structuredClone(state))).toBeNull();
  });
});
