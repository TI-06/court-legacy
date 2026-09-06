import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type { GameDate } from "../../../src/domain/model/identifiers";
import { decodeGameStateValue } from "../../../src/persistence/gameStateCodec";

function notification(id: string, weekOfYear: number, date: string) {
  return {
    id,
    type: "training-result" as const,
    createdGameDate: date as GameDate,
    academicYearIndex: 1,
    weekOfYear,
    readAtGameDate: null,
    payload: {
      teamTrainingMenuName: "基礎練習",
      totalAbilityGrowth: 0,
      totalFatigueChange: 0,
      injuredCount: 0,
      players: [],
    },
  };
}

describe("cloud game state decoding", () => {
  it("decodes an already parsed Supabase JSON value without a string round-trip", () => {
    const state = createDemoGame();

    const decoded = decodeGameStateValue(structuredClone(state));

    expect(decoded).toEqual(state);
    expect(decoded).not.toBe(state);
  });

  it("compacts retained training notifications to the newest item while loading", () => {
    const state = createDemoGame();
    const older = notification("training-old", 1, "2026-04-01");
    const newest = notification("training-new", 2, "2026-04-08");

    const decoded = decodeGameStateValue({
      ...state,
      notifications: { items: [older, newest] },
    });

    expect(decoded.notifications.items.map((item) => item.id)).toEqual([
      "training-new",
    ]);
  });
});
