import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type { GameState } from "../../../src/domain/model/GameState";
import type { WeeklyScheduleState } from "../../../src/domain/weekly/weeklyScheduleTypes";
import { decodeGameState } from "../../../src/persistence/gameStateCodec";

type Phase8GameState = GameState & { weeklySchedule: WeeklyScheduleState };

describe("Phase 8 game-state migration", () => {
  it("migrates a Phase 7 schema-v4 save without rerolling persistent game data", () => {
    const current = createDemoGame();
    const originalPlayers = structuredClone(current.players);
    const originalSchools = structuredClone(current.schools);
    const originalWorld = structuredClone(current.world);
    const originalOfficialSeason = structuredClone(current.officialSeason);
    const originalTeamDynamics = structuredClone(current.teamDynamics);
    const originalHistory = structuredClone(current.history);

    const legacy = {
      ...structuredClone(current),
      schemaVersion: 4,
      randomCursor: current.randomCursor + 41,
      recruiting: {
        cycleKey: "phase7-cycle",
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
    delete legacy.weeklySchedule;
    delete legacy.notifications;

    const migrated = decodeGameState(JSON.stringify(legacy)) as Phase8GameState;

    expect(migrated.schemaVersion).toBe(current.schemaVersion);
    expect(migrated.notifications).toEqual({ items: [] });
    expect(migrated.randomCursor).toBe(current.randomCursor + 41);
    expect(migrated.players).toEqual(originalPlayers);
    expect(migrated.schools).toEqual(originalSchools);
    expect(migrated.world).toEqual(originalWorld);
    expect(migrated.officialSeason).toEqual(originalOfficialSeason);
    expect(migrated.teamDynamics).toEqual(originalTeamDynamics);
    expect(migrated.history).toEqual(originalHistory);
    expect(migrated.recruiting).toEqual({
      cycleKey: "phase7-cycle",
      committedCandidateIds: [],
    });
    expect(migrated.shopEffects?.nextTrainingGrowthBoost).toEqual({
      percent: 20,
      remainingUses: 1,
      sourceItemId: "training-efficiency-boost",
    });

    const userRoster = migrated.schools[migrated.userSchoolId]!.playerIds;
    const assignments =
      migrated.weeklySchedule.trainingPlan.individualAssignments;
    expect(assignments).toHaveLength(userRoster.length);
    expect(assignments.map((assignment) => assignment.playerId)).toEqual(
      userRoster,
    );
    expect(
      new Set(assignments.map((assignment) => assignment.playerId)).size,
    ).toBe(userRoster.length);
    expect(
      assignments.every(
        (assignment) => assignment.instructionId === "instruction.overall",
      ),
    ).toBe(true);
    expect(
      migrated.weeklySchedule.practiceMatch.scheduledOpponentId,
    ).toBeNull();
    expect(migrated.weeklySchedule.practiceMatch.scheduledBy).toBeNull();
    expect(migrated.weeklySchedule.recentPracticeMatches).toEqual([]);
    expect(migrated.weeklySchedule.latestReport).toBeNull();
  });

  it("creates the same weekly schedule every time the same v4 save is decoded", () => {
    const current = createDemoGame();
    const legacy = {
      ...structuredClone(current),
      schemaVersion: 4,
      randomCursor: current.randomCursor + 13,
    } as Record<string, unknown>;
    delete legacy.weeklySchedule;
    delete legacy.notifications;
    const serialized = JSON.stringify(legacy);

    const first = decodeGameState(serialized) as Phase8GameState;
    const second = decodeGameState(serialized) as Phase8GameState;

    expect(first.weeklySchedule).toEqual(second.weeklySchedule);
    expect(first.notifications).toEqual({ items: [] });
    expect(second.notifications).toEqual({ items: [] });
    expect(first.randomCursor).toBe(current.randomCursor + 13);
    expect(second.randomCursor).toBe(current.randomCursor + 13);
  });
});
