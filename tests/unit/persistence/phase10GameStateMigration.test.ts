import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { decodeGameState } from "../../../src/persistence/gameStateCodec";

describe("Phase 10 game-state migration", () => {
  it("migrates a schema-v5 save to v6 with empty notifications", () => {
    const current = createDemoGame();
    const legacy = {
      ...structuredClone(current),
      schemaVersion: 5,
    } as Record<string, unknown>;
    delete legacy.notifications;

    const migrated = decodeGameState(JSON.stringify(legacy));

    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.notifications).toEqual({ items: [] });
    expect(migrated.players).toEqual(current.players);
    expect(migrated.schools).toEqual(current.schools);
    expect(migrated.weeklySchedule).toEqual(current.weeklySchedule);
  });
});
