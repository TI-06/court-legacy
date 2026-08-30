import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  createDefaultWeeklyPlan,
  createInitialWeeklySchedule,
} from "../../../../src/domain/weekly/createWeeklySchedule";

describe("Phase 8 initial world", () => {
  it("initializes a deterministic weekly schedule for new games", () => {
    const first = createDemoGame();
    const second = createDemoGame();

    expect(first.schemaVersion).toBe(5);
    expect(first.weeklySchedule).toEqual(second.weeklySchedule);

    const roster = first.schools[first.userSchoolId]!.playerIds;
    const assignments = first.weeklySchedule.trainingPlan.individualAssignments;
    expect(assignments).toHaveLength(2);
    expect(assignments.map((assignment) => assignment.playerId)).toEqual(
      roster.slice(0, 2),
    );
    expect(
      new Set(assignments.map((assignment) => assignment.playerId)).size,
    ).toBe(2);
    expect(first.weeklySchedule.practiceMatch.scheduledOpponentId).toBeNull();
    expect(first.weeklySchedule.practiceMatch.scheduledBy).toBeNull();
    expect(first.weeklySchedule.recentPracticeMatches).toEqual([]);
    expect(first.weeklySchedule.latestReport).toBeNull();
  });

  it("creates the default training plan without mutating state or consuming RNG", () => {
    const state = createDemoGame();
    const before = structuredClone(state);

    const plan = createDefaultWeeklyPlan(state);

    expect(state).toEqual(before);
    expect(state.randomCursor).toBe(before.randomCursor);
    expect(plan.teamTrainingMenuId).toBe("training.spike");
    expect(plan.individualAssignments).toEqual([
      {
        playerId: state.schools[state.userSchoolId]!.playerIds[0],
        instructionId: "instruction.serve",
      },
      {
        playerId: state.schools[state.userSchoolId]!.playerIds[1],
        instructionId: "instruction.receive",
      },
    ]);
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
