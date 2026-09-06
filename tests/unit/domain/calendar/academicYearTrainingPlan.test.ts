import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";

describe("academic-year training plan", () => {
  it("removes graduated players from the saved individual training plan", () => {
    const state = createDemoGame();
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;

    const school = state.schools[state.userSchoolId]!;
    const graduateId = school.playerIds.find(
      (playerId) => state.players[playerId]!.grade === 3,
    )!;
    const returnerId = school.playerIds.find(
      (playerId) => state.players[playerId]!.grade !== 3,
    )!;
    state.weeklySchedule.trainingPlan = {
      teamTrainingMenuId: "training.spike",
      individualAssignments: [
        { playerId: graduateId, instructionId: "instruction.attack" },
        { playerId: returnerId, instructionId: "instruction.defense" },
      ],
    };

    const result = advanceGameWeek(state, gameData);
    const nextSchool = result.state.schools[result.state.userSchoolId]!;
    const assignmentIds =
      result.state.weeklySchedule.trainingPlan.individualAssignments.map(
        (assignment) => assignment.playerId,
      );

    expect(result.academicYearTransition).not.toBeNull();
    expect(nextSchool.playerIds).not.toContain(graduateId);
    expect(assignmentIds).not.toContain(graduateId);
    expect(assignmentIds).toContain(returnerId);
    expect(
      assignmentIds.every((playerId) =>
        nextSchool.playerIds.includes(playerId),
      ),
    ).toBe(true);
  });
});
