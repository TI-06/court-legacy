import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { decodeGameState } from "../../../src/persistence/gameStateCodec";

describe("Phase 6 game-state migration", () => {
  it("migrates a Phase 5 schema-v2 save without rerolling persistent game data", () => {
    const current = createDemoGame();
    const originalPlayers = structuredClone(current.players);
    const originalSchools = structuredClone(current.schools);
    const originalWorld = structuredClone(current.world);
    const legacyHistory = structuredClone(current.history) as unknown as Record<
      string,
      unknown
    >;
    delete legacyHistory.officialTournaments;

    const legacy = {
      ...structuredClone(current),
      schemaVersion: 2,
      randomCursor: current.randomCursor + 37,
      history: legacyHistory,
      recruiting: {
        cycleKey: "phase5-cycle",
        committedCandidateIds: [],
      },
      shopEffects: {
        nextTrainingGrowthBoost: {
          percent: 20,
          remainingUses: 1,
          sourceItemId: "training-efficiency-boost",
        },
      },
    } as Record<string, unknown>;
    delete legacy.officialSeason;
    delete legacy.teamDynamics;
    delete legacy.weeklySchedule;

    const migrated = decodeGameState(JSON.stringify(legacy));

    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.randomCursor).toBe(current.randomCursor + 37);
    expect(migrated.players).toEqual(originalPlayers);
    expect(migrated.schools).toEqual(originalSchools);
    expect(migrated.world).toEqual(originalWorld);
    expect(migrated.recruiting).toEqual({
      cycleKey: "phase5-cycle",
      committedCandidateIds: [],
    });
    expect(migrated.shopEffects?.nextTrainingGrowthBoost).toEqual({
      percent: 20,
      remainingUses: 1,
      sourceItemId: "training-efficiency-boost",
    });
    expect(migrated.officialSeason.academicYear).toBe(
      migrated.calendar.academicYear,
    );
    expect(migrated.officialSeason.interhigh.prefectural.entrants).toHaveLength(
      16,
    );
    expect(migrated.history.officialTournaments).toEqual([]);
    expect(migrated.teamDynamics.recentOfficialMatchesTracked).toBe(0);
    expect(migrated.weeklySchedule.latestReport).toBeNull();
  });
});
