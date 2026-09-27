import { describe, expect, it } from "vitest";
import { createSoakSnapshot } from "../../../../src/dev/soak/runBalanceSoak";
import { buildJsonStatePatchOperations } from "../../../../worker/data/jsonStatePatch";

describe("jsonStatePatch", () => {
  it("emits set, delete, and append operations without replacing unchanged state", () => {
    const before = {
      date: "2026-04-01",
      nested: { keep: 1, change: 2, remove: true },
      history: [{ id: 1 }],
    };
    const after = {
      date: "2026-04-08",
      nested: { keep: 1, change: 3, add: "new" },
      history: [{ id: 1 }, { id: 2 }],
    };

    expect(buildJsonStatePatchOperations(before, after)).toEqual([
      { op: "set", path: ["date"], value: "2026-04-08" },
      { op: "delete", path: ["nested", "remove"] },
      { op: "set", path: ["nested", "change"], value: 3 },
      { op: "set", path: ["nested", "add"], value: "new" },
      { op: "append", path: ["history"], value: [{ id: 2 }] },
    ]);
  });

  it("keeps a small mutation far below the full long-running state payload", () => {
    const snapshot = createSoakSnapshot("phase36-delta-save");
    const before = snapshot.state as unknown as Record<string, unknown>;
    const after = structuredClone(snapshot.state);
    const playerId = after.schools[after.userSchoolId]!.playerIds[0]!;
    after.players[playerId] = {
      ...after.players[playerId]!,
      morale: after.players[playerId]!.morale + 1,
    };

    const operations = buildJsonStatePatchOperations(
      before,
      after as unknown as Record<string, unknown>,
    );
    const fullBytes = JSON.stringify(after).length;
    const patchBytes = JSON.stringify(operations).length;

    expect(operations).toEqual([
      {
        op: "set",
        path: ["players", playerId, "morale"],
        value: after.players[playerId]!.morale,
      },
    ]);
    expect(patchBytes).toBeLessThan(fullBytes * 0.02);
  });
});
