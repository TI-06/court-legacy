import { describe, expect, it } from "vitest";
import { createSoakSnapshot } from "../../../../src/dev/soak/runBalanceSoak";
import {
  applyJsonStatePatch,
  buildJsonStatePatch,
} from "../../../../worker/data/statePatch";

describe("buildJsonStatePatch", () => {
  it("reconstructs nested object and array changes exactly", () => {
    const before = {
      players: {
        a: { morale: 50, tags: ["x", "y"] },
        b: { morale: 70 },
      },
      history: [{ id: 1 }],
      optional: "remove-me",
    };
    const after = {
      players: {
        a: { morale: 56, tags: ["x", "z", "new"] },
        b: { morale: 70 },
      },
      history: [{ id: 1 }, { id: 2 }],
      added: { value: true },
    };

    const patch = buildJsonStatePatch(before, after);

    expect(applyJsonStatePatch(before, patch)).toEqual(after);
    expect(patch).toContainEqual({
      op: "set",
      path: ["players", "a", "morale"],
      value: 56,
    });
    expect(patch).toContainEqual({
      op: "remove",
      path: ["optional"],
    });
  });

  it("keeps a realistic player update far smaller than the full save", () => {
    const snapshot = createSoakSnapshot("phase36-delta-size");
    const before = snapshot.state;
    const after = structuredClone(before);
    const school = after.schools[after.userSchoolId]!;
    const player = after.players[school.playerIds[0]!]!;
    player.morale = Math.min(100, player.morale + 1);
    player.trust = Math.min(100, player.trust + 2);

    const patch = buildJsonStatePatch(before, after);

    expect(applyJsonStatePatch(before, patch)).toEqual(after);
    expect(JSON.stringify(patch).length).toBeLessThan(
      JSON.stringify(after).length / 20,
    );
  });
});
