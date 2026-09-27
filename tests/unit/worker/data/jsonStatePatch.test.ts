import { describe, expect, it } from "vitest";
import {
  applyJsonStatePatch,
  createJsonStatePatch,
} from "../../../../worker/data/jsonStatePatch";

describe("jsonStatePatch", () => {
  it("round-trips nested object, array, append, and removal changes", () => {
    const previous = {
      date: "2026-04-01",
      players: {
        a: { morale: 50, tags: ["starter"] },
        b: { morale: 60, tags: ["bench"] },
      },
      history: [{ week: 1 }],
      obsolete: true,
    };
    const next = {
      date: "2026-04-08",
      players: {
        a: { morale: 55, tags: ["starter", "captain"] },
        b: { morale: 60, tags: ["bench"] },
      },
      history: [{ week: 1 }, { week: 2 }],
    };

    const patch = createJsonStatePatch(previous, next);

    expect(applyJsonStatePatch(previous, patch)).toEqual(next);
    expect(patch).toContainEqual({
      op: "set",
      path: ["date"],
      value: "2026-04-08",
    });
    expect(patch).toContainEqual({
      op: "set",
      path: ["history", "1"],
      value: { week: 2 },
    });
    expect(patch).toContainEqual({
      op: "remove",
      path: ["obsolete"],
    });
  });

  it("does not resend a large unchanged object tree for a tiny mutation", () => {
    const players = Object.fromEntries(
      Array.from({ length: 700 }, (_, index) => [
        `player-${index}`,
        {
          morale: 50,
          abilities: {
            spike: 50,
            serve: 50,
            receive: 50,
            block: 50,
            jump: 50,
            stamina: 50,
          },
        },
      ]),
    );
    const previous = {
      revisionMarker: 1,
      players,
      history: Array.from({ length: 200 }, (_, index) => ({
        week: index,
        result: "steady",
      })),
    };
    const next = {
      ...previous,
      revisionMarker: 2,
    };

    const patch = createJsonStatePatch(previous, next);
    const fullBytes = JSON.stringify(next).length;
    const patchBytes = JSON.stringify(patch).length;

    expect(applyJsonStatePatch(previous, patch)).toEqual(next);
    expect(patch).toEqual([
      { op: "set", path: ["revisionMarker"], value: 2 },
    ]);
    expect(patchBytes).toBeLessThan(fullBytes * 0.01);
  });

  it("replaces a reordered array instead of producing unsafe index removals", () => {
    const previous = { values: ["a", "b", "c"] };
    const next = { values: ["b", "c", "d"] };

    const patch = createJsonStatePatch(previous, next);

    expect(applyJsonStatePatch(previous, patch)).toEqual(next);
    expect(patch).toEqual([
      { op: "set", path: ["values", "0"], value: "b" },
      { op: "set", path: ["values", "1"], value: "c" },
      { op: "set", path: ["values", "2"], value: "d" },
    ]);
  });

  it("removes truncated array entries from the end", () => {
    const previous = { values: ["a", "b", "c", "d"] };
    const next = { values: ["a", "b"] };

    const patch = createJsonStatePatch(previous, next);

    expect(applyJsonStatePatch(previous, patch)).toEqual(next);
    expect(patch).toEqual([
      { op: "remove", path: ["values", "3"] },
      { op: "remove", path: ["values", "2"] },
    ]);
  });
});
