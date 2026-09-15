import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { CURRENT_GAME_SCHEMA_VERSION } from "../../../src/domain/model/GameState";
import { decodeGameState } from "../../../src/persistence/gameStateCodec";
import {
  hasPendingCharacterTraitDiscovery,
  stripCharacterTraitDiscoveryFieldsFromLegacyPlayers,
  withoutCharacterTraitDiscoveryFields,
} from "./phase21LegacyCharacterTraitTestHelpers";

describe("Phase 10 game-state migration", () => {
  it("migrates a schema-v5 save through v6 to the current schema", () => {
    const current = createDemoGame();
    const legacy = {
      ...structuredClone(current),
      schemaVersion: 5,
    } as Record<string, unknown>;
    stripCharacterTraitDiscoveryFieldsFromLegacyPlayers(legacy.players);
    delete legacy.notifications;
    delete legacy.schoolManagement;

    const migrated = decodeGameState(JSON.stringify(legacy));

    expect(migrated.schemaVersion).toBe(CURRENT_GAME_SCHEMA_VERSION);
    expect(migrated.notifications).toEqual({ items: [] });
    expect(migrated.schoolManagement).toEqual({
      assistantCoach: null,
      fundsHistory: [],
      lastAnnualBudgetYearIndex: current.yearIndex,
    });
    expect(withoutCharacterTraitDiscoveryFields(migrated.players)).toEqual(
      withoutCharacterTraitDiscoveryFields(current.players),
    );
    expect(hasPendingCharacterTraitDiscovery(migrated.players)).toBe(true);
    expect(migrated.schools).toEqual(current.schools);
    expect(migrated.weeklySchedule).toEqual(current.weeklySchedule);
  });
});
