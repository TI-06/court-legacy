import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../src/domain/calendar/academicYearProgression";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { applyGameAction } from "../../../worker/game/applyGameAction";

describe("academic-year training recovery", () => {
  it("advances an existing new-year save whose training plan still references a graduate", () => {
    const previous = createDemoGame();
    previous.date = "2027-03-31";
    previous.calendar.currentDate = previous.date;
    previous.calendar.weekOfYear = 52;
    const previousSchool = previous.schools[previous.userSchoolId]!;
    const graduateId = previousSchool.playerIds.find(
      (playerId) => previous.players[playerId]!.grade === 3,
    )!;

    const rolled = advanceGameWeek(previous, gameData).state;
    rolled.weeklySchedule.trainingPlan = {
      ...rolled.weeklySchedule.trainingPlan,
      individualAssignments: [
        ...rolled.weeklySchedule.trainingPlan.individualAssignments,
        { playerId: graduateId, instructionId: "instruction.attack" },
      ],
    };
    const snapshot: CloudGameSnapshot = {
      userId: "user-rollover-recovery",
      schoolDbId: "00000000-0000-4000-8000-000000000001",
      revision: 182,
      state: rolled,
      teamSelection: autoSelectTeam({
        state: rolled,
        schoolId: rolled.userSchoolId,
      }),
    };

    const advanced = applyGameAction(snapshot, { type: "advance-week" });

    expect(advanced.state.date).not.toBe(rolled.date);
    expect(advanced.outcome).toMatchObject({
      weekAdvanced: true,
      trainingResult: {
        teamTrainingMenuId:
          rolled.weeklySchedule.trainingPlan.teamTrainingMenuId,
      },
    });
    expect(
      advanced.state.weeklySchedule.trainingPlan.individualAssignments.some(
        (assignment) => assignment.playerId === graduateId,
      ),
    ).toBe(false);
  });
});
