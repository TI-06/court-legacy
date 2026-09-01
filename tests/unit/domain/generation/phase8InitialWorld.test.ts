import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { CURRENT_GAME_SCHEMA_VERSION } from "../../../../src/domain/model/GameState";
import {
  createDefaultWeeklyPlan,
  createInitialWeeklySchedule,
} from "../../../../src/domain/weekly/createWeeklySchedule";

describe("Phase 8 initial world", () => {
  it("initializes a deterministic weekly schedule for new games", () => {
    const first = createDemoGame();
    const second = createDemoGame();

    expect(first.schemaVersion).toBe(CURRENT_GAME_SCHEMA_VERSION);
    expect(first.weeklySchedule).toEqual(second.weeklySchedule);

    const roster = first.schools[first.userSchoolId]!.playerIds;
    const assignments = first.weeklySchedule.trainingPlan.individualAssignments;
    expect(assignments).toHaveLength(roster.length);
    expect(assignments.map((assignment) => assignment.playerId)).toEqual(roster);
    expect(
      new Set(assignments.map((assignment) => assignment.playerId)).size,
    ).toBe(roster.length);
    expect(
      assignments.every(
        (assignment) => assignment.instructionId === "instruction.overall",
      ),
    ).toBe(true);
    expect(first.weeklySchedule.practiceMatch.scheduledOpponentId).toBeNull();
    expect(first.weeklySchedule.practiceMatch.scheduledBy).toBeNull();
    expect(first.weeklySchedule.recentPracticeMatches).toEqual([]);
    expect(first.weeklySchedule.latestReport).toBeNull();
  });

  it("creates the default training plan without mutating state or consuming RNG", () => {
    const state = createDemoGame();
    const before = structuredClone(state);

    const plan = createDefaultWeeklyPlan(state);
    const roster = state.schools[state.userSchoolId]!.playerIds;

    expect(state).toEqual(before);
    expect(state.randomCursor).toBe(before.randomCursor);
    expect(plan.teamTrainingMenuId).toBe("training.spike");
    expect(plan.individualAssignments).toEqual(
      roster.map((playerId) => ({
        playerId,
        instructionId: "instruction.overall",
      })),
    );
  });

  it("creates the weekly schedule without mutating state or consuming RNG", () => {
    const state = createDemoGame();
    const before = structuredClone(state);

    const schedule = createInitialWeeklySchedule(state);

    expect(state).toEqual(before);
    expect(state.randomCursor).toBe(before.randomCursor);
    expect(schedule.trainingPlan).toEqual(createDefaultWeeklyPlan(state));
    expect(schedule.recentPracticeMatches).toEqual([]);
    expect(schedule.latestReport).toBeNull();
  });
});
