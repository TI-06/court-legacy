import { describe, expect, it } from "vitest";
import {
  applyJsonStateDelta,
  buildJsonStateDelta,
} from "../../../../worker/data/stateDelta";

describe("section-level state delta", () => {
  it("reconstructs nested map changes, removals, and top-level replacements", () => {
    const before = {
      date: "2026-04-01",
      activeMatch: { id: "match-1" },
      players: {
        "player-1": { name: "A", score: 10 },
        "player-2": { name: "B", score: 20 },
      },
      history: {
        matches: ["m1"],
        graduates: [],
      },
      optional: { enabled: true },
    };
    const after = {
      date: "2026-04-08",
      activeMatch: null,
      players: {
        "player-1": { name: "A", score: 11 },
        "player-3": { name: "C", score: 30 },
      },
      history: {
        matches: ["m1", "m2"],
        graduates: [],
      },
    };

    const delta = buildJsonStateDelta(before, after);

    expect(delta.set).toMatchObject({
      date: "2026-04-08",
      activeMatch: null,
    });
    expect(delta.merge.players).toEqual({
      "player-1": { name: "A", score: 11 },
      "player-3": { name: "C", score: 30 },
    });
    expect(delta.removeKeys.players).toEqual(["player-2"]);
    expect(delta.merge.history).toEqual({
      matches: ["m1", "m2"],
    });
    expect(delta.remove).toEqual(["optional"]);
    expect(applyJsonStateDelta(before, delta)).toEqual(after);
  });

  it("omits structurally equal object children even when references differ", () => {
    const before = {
      players: {
        "player-1": {
          abilities: { spike: 50, receive: 40 },
          tags: ["a", "b"],
        },
      },
    };
    const after = structuredClone(before);

    expect(buildJsonStateDelta(before, after)).toEqual({
      set: {},
      merge: {},
      remove: [],
      removeKeys: {},
    });
  });
});
