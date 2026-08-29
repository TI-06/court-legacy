import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type { TeamDynamicsState } from "../../../src/domain/dynamics/teamDynamicsTypes";
import type { GameState } from "../../../src/domain/model/GameState";
import { decodeGameState } from "../../../src/persistence/gameStateCodec";

type Phase7GameState = GameState & { teamDynamics: TeamDynamicsState };

describe("Phase 7 game-state migration", () => {
  it("migrates a Phase 6 schema-v3 save without rerolling persistent game data", () => {
    const current = createDemoGame();
    const originalPlayers = structuredClone(current.players);
    const originalSchools = structuredClone(current.schools);
    const originalWorld = structuredClone(current.world);
    const originalOfficialSeason = structuredClone(current.officialSeason);
    const originalHistory = structuredClone(current.history);

    const legacy = {
      ...structuredClone(current),
      schemaVersion: 3,
      randomCursor: current.randomCursor + 37,
      recruiting: {
        cycleKey: "phase6-cycle",
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
    delete legacy.teamDynamics;

    const migrated = decodeGameState(
      JSON.stringify(legacy),
    ) as Phase7GameState;

    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.randomCursor).toBe(current.randomCursor + 37);
    expect(migrated.players).toEqual(originalPlayers);
    expect(migrated.schools).toEqual(originalSchools);
    expect(migrated.world).toEqual(originalWorld);
    expect(migrated.officialSeason).toEqual(originalOfficialSeason);
    expect(migrated.history).toEqual(originalHistory);
    expect(migrated.recruiting).toEqual({
      cycleKey: "phase6-cycle",
      committedCandidateIds: [],
    });
    expect(migrated.shopEffects?.nextTrainingGrowthBoost).toEqual({
      percent: 20,
      remainingUses: 1,
      sourceItemId: "training-efficiency-boost",
    });
    expect(migrated.teamDynamics.cohesion).toBeGreaterThanOrEqual(0);
    expect(migrated.teamDynamics.cohesion).toBeLessThanOrEqual(100);
    expect(migrated.teamDynamics.recentOfficialMatchesTracked).toBe(0);
  });
});
