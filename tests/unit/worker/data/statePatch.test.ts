import { describe, expect, it } from "vitest";
import { createSoakSnapshot } from "../../../../src/dev/soak/runBalanceSoak";
import {
  buildJsonStatePatch,
  buildJsonStatePatchWithCollapsedRoot,
  collapseJsonStatePatchRoot,
  compactJsonStatePatchForPersistence,
  type JsonStatePatchOperation,
} from "../../../../worker/data/statePatch";

function childAt(
  current: Record<string, unknown> | unknown[],
  segment: string,
): Record<string, unknown> | unknown[] {
  const value = Array.isArray(current)
    ? current[Number(segment)]
    : current[segment];
  return value as Record<string, unknown> | unknown[];
}

function applyPatch(
  input: unknown,
  operations: JsonStatePatchOperation[],
): unknown {
  const root = structuredClone(input);

  const setAtPath = (target: unknown, path: string[], value: unknown) => {
    if (path.length === 0) return structuredClone(value);
    let current = target as Record<string, unknown> | unknown[];
    for (let index = 0; index < path.length - 1; index += 1) {
      current = childAt(current, path[index]!);
    }
    const key = path[path.length - 1]!;
    if (Array.isArray(current)) {
      current[Number(key)] = structuredClone(value);
    } else {
      current[key] = structuredClone(value);
    }
    return target;
  };

  const removeAtPath = (target: unknown, path: string[]) => {
    let current = target as Record<string, unknown> | unknown[];
    for (let index = 0; index < path.length - 1; index += 1) {
      current = childAt(current, path[index]!);
    }
    const key = path[path.length - 1]!;
    if (Array.isArray(current)) {
      current.splice(Number(key), 1);
    } else {
      delete current[key];
    }
    return target;
  };

  let result = root;
  for (const operation of operations) {
    result =
      operation.op === "set"
        ? setAtPath(result, operation.path, operation.value)
        : removeAtPath(result, operation.path);
  }
  return result;
}

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

    expect(applyPatch(before, patch)).toEqual(after);
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

  it("collapses an active match into one atomic root patch", () => {
    const before = {
      activeMatch: {
        eventLog: Array.from({ length: 80 }, (_, index) => ({
          sequence: index + 1,
        })),
        runtime: { homeScore: 12, awayScore: 10 },
      },
      randomCursor: 20,
    };
    const after = structuredClone(before);
    after.activeMatch.eventLog.push(
      ...Array.from({ length: 40 }, (_, index) => ({
        sequence: index + 81,
      })),
    );
    after.activeMatch.runtime.homeScore = 18;
    after.randomCursor = 42;

    const raw = buildJsonStatePatch(before, after);
    const compact = collapseJsonStatePatchRoot(
      after as unknown as Record<string, unknown>,
      raw,
      "activeMatch",
    );

    expect(raw.length).toBeGreaterThan(40);
    expect(
      compact.filter((operation) => operation.path[0] === "activeMatch"),
    ).toEqual([
      {
        op: "set",
        path: ["activeMatch"],
        value: after.activeMatch,
      },
    ]);
    expect(applyPatch(before, compact)).toEqual(after);
  });

  it("replaces a large active-match root without recursively diffing its event log", () => {
    const before = {
      activeMatch: {
        eventLog: Array.from({ length: 800 }, (_, index) => ({
          sequence: index + 1,
          detail: `event-${index + 1}`,
        })),
        runtime: { homeScore: 18, awayScore: 17 },
      },
      randomCursor: 20,
    };
    const after = structuredClone(before);
    after.activeMatch.eventLog.push(
      ...Array.from({ length: 120 }, (_, index) => ({
        sequence: index + 801,
        detail: `event-${index + 801}`,
      })),
    );
    after.activeMatch.runtime.homeScore = 25;
    after.randomCursor = 42;

    const patch = buildJsonStatePatchWithCollapsedRoot(
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
      "activeMatch",
    );

    expect(
      patch.filter((operation) => operation.path[0] === "activeMatch"),
    ).toEqual([
      {
        op: "set",
        path: ["activeMatch"],
        value: after.activeMatch,
      },
    ]);
    expect(patch).toContainEqual({
      op: "set",
      path: ["randomCursor"],
      value: 42,
    });
    expect(applyPatch(before, patch)).toEqual(after);
  });

  it("compacts many player-field changes into bounded player-root delta operations", () => {
    const snapshot = createSoakSnapshot("save-delta-compaction-many-players");
    const before = snapshot.state;
    const after = structuredClone(before);
    const school = after.schools[after.userSchoolId]!;

    for (const [index, playerId] of school.playerIds.entries()) {
      const player = after.players[playerId]!;
      player.morale = Math.max(0, Math.min(100, player.morale + 1));
      player.trust = Math.max(0, Math.min(100, player.trust + 2));
      player.fatigue = Math.max(0, Math.min(100, player.fatigue + index + 1));
    }

    const raw = buildJsonStatePatch(before, after);
    expect(raw.length).toBeGreaterThan(16);

    const compact = compactJsonStatePatchForPersistence(
      after as unknown as Record<string, unknown>,
      raw,
      16,
    );

    expect(compact.length).toBeLessThanOrEqual(16);
    expect(applyPatch(before, compact)).toEqual(after);
    expect(JSON.stringify(compact).length).toBeLessThan(
      JSON.stringify(after).length / 2,
    );
    expect(
      compact.every(
        (operation) =>
          operation.path[0] !== "players" || operation.path.length === 2,
      ),
    ).toBe(true);
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

    expect(applyPatch(before, patch)).toEqual(after);
    expect(JSON.stringify(patch).length).toBeLessThan(
      JSON.stringify(after).length / 20,
    );
  });
});
