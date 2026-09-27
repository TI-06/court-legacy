import { describe, expect, it } from "vitest";
import { createSoakSnapshot } from "../../../../src/dev/soak/runBalanceSoak";
import {
  buildJsonStatePatch,
  type JsonStatePatchOperation,
} from "../../../../worker/data/statePatch";

function applyPatch(
  input: unknown,
  operations: JsonStatePatchOperation[],
): unknown {
  const root = structuredClone(input);

  const setAtPath = (target: unknown, path: string[], value: unknown) => {
    if (path.length === 0) return structuredClone(value);
    let current = target as Record<string, unknown> | unknown[];
    for (let index = 0; index < path.length - 1; index += 1) {
      current = current[
        Number.isNaN(Number(path[index])) ? path[index]! : Number(path[index])
      ] as Record<string, unknown> | unknown[];
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
      current = current[
        Number.isNaN(Number(path[index])) ? path[index]! : Number(path[index])
      ] as Record<string, unknown> | unknown[];
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
