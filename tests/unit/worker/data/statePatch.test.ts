import { describe, expect, it } from "vitest";
import { createSoakSnapshot } from "../../../../src/dev/soak/runBalanceSoak";
import {
  applyJsonStatePatch,
  buildJsonStatePatch,
  buildJsonStatePatchWithCollapsedRoot,
  coalesceJsonStatePatchObjectRoots,
  collapseJsonStatePatchRoot,
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
  it("coalesces high-churn object maps into shallow merge operations", () => {
    const before = {
      players: {
        a: { morale: 50, trust: 40 },
        b: { morale: 60, trust: 50 },
        c: { morale: 70, trust: 60 },
      },
      schools: {
        user: { funds: 100, reputation: 20 },
        rival: { funds: 200, reputation: 40 },
      },
      history: { matches: [{ id: 1 }] },
    };
    const after = structuredClone(before);
    after.players.a.morale = 51;
    after.players.b.trust = 55;
    after.schools.user.funds = 120;
    after.history.matches.push({ id: 2 });

    const raw = buildJsonStatePatch(before, after);
    const compact = coalesceJsonStatePatchObjectRoots(
      after as unknown as Record<string, unknown>,
      raw,
      ["players", "schools"],
    );

    expect(compact.filter((operation) => operation.op === "merge")).toEqual([
      {
        op: "merge",
        path: ["players"],
        value: {
          a: after.players.a,
          b: after.players.b,
        },
      },
      {
        op: "merge",
        path: ["schools"],
        value: {
          user: after.schools.user,
        },
      },
    ]);
    expect(compact.length).toBeLessThan(raw.length);
    expect(applyJsonStatePatch(before, compact)).toEqual(after);
  });

  it("keeps removals explicit while batching object-map updates", () => {
    const before = {
      players: {
        a: { morale: 50 },
        b: { morale: 60 },
      },
    };
    const after = {
      players: {
        a: { morale: 55 },
      },
    };

    const compact = coalesceJsonStatePatchObjectRoots(
      after as unknown as Record<string, unknown>,
      buildJsonStatePatch(before, after),
      ["players"],
    );

    expect(compact).toEqual([
      {
        op: "merge",
        path: ["players"],
        value: { a: after.players.a },
      },
      {
        op: "remove",
        path: ["players", "b"],
      },
    ]);
    expect(applyJsonStatePatch(before, compact)).toEqual(after);
  });

  it("applies shallow merge patches without replacing untouched map entries", () => {
    const before = {
      players: {
        a: { morale: 50 },
        b: { morale: 60 },
      },
    };

    const result = applyJsonStatePatch(before, [
      {
        op: "merge",
        path: ["players"],
        value: {
          a: { morale: 80 },
        },
      },
    ]);

    expect(result).toEqual({
      players: {
        a: { morale: 80 },
        b: { morale: 60 },
      },
    });
  });
});
