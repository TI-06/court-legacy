import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { addWeeks } from "../../../../src/domain/events/eventDate";
import {
  resolveDueUniversityJointTraining,
  scheduleEliteExpedition,
  scheduleTopTeamClinic,
  scheduleUniversityJointTraining,
} from "../../../../src/domain/school/schoolSpecialProjectActivities";
import { purchaseSchoolSpecialProject } from "../../../../src/domain/school/schoolSpecialProjects";

function createReadyState() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  school.funds = 10_000;
  school.reputationPoints = 900;
  school.history.nationalTitles = 1;
  school.facilities = {
    gym: 50,
    trainingRoom: 50,
    analysisRoom: 50,
    recoveryRoom: 50,
    dormitory: 50,
    scoutingNetwork: 50,
    alumniAssociation: 50,
    studyRoom: 50,
  };
  return state;
}

describe("Phase51 experience project activities", () => {
  it("schedules a strong expedition opponent through the existing practice match slot", () => {
    const state = createReadyState();
    const opponent = Object.values(state.schools).find(
      (school) => school.id !== state.userSchoolId,
    )!;
    opponent.reputation = "elite";
    opponent.reputationPoints = 1000;

    const scheduled = scheduleEliteExpedition(state);

    expect(scheduled.opponentSchoolId).toBe(opponent.id);
    expect(
      scheduled.state.weeklySchedule.practiceMatch.scheduledOpponentId,
    ).toBe(opponent.id);
    expect(scheduled.state.weeklySchedule.practiceMatch.scheduledBy).toBe(
      "outgoing",
    );
  });

  it("stores one bounded university joint-training reservation and resolves it once", () => {
    const state = createReadyState();
    const purchased = purchaseSchoolSpecialProject(
      state,
      "university-joint-training",
    );
    const scheduled = scheduleUniversityJointTraining(purchased, "attack");
    const pending = scheduled.schoolManagement.specialProjects?.pendingActivity;

    expect(pending).toMatchObject({
      kind: "university-joint-training",
      focus: "attack",
      scheduledDate: addWeeks(state.date, 1),
    });

    const due = {
      ...scheduled,
      date: addWeeks(state.date, 1),
    };
    const beforePlayers = structuredClone(due.players);
    const resolved = resolveDueUniversityJointTraining(due, gameData);

    expect(resolved).not.toBeNull();
    expect(resolved?.result.focus).toBe("attack");
    expect(resolved?.result.participantCount).toBeGreaterThan(0);
    expect(
      resolved?.state.schoolManagement.specialProjects?.pendingActivity,
    ).toBeUndefined();
    expect(resolved?.state.players).not.toEqual(beforePlayers);
    expect(resolveDueUniversityJointTraining(resolved!.state, gameData)).toBeNull();
  });

  it("schedules a targeted top-team clinic as a next-week event", () => {
    const state = createReadyState();
    const targetPlayerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const purchased = purchaseSchoolSpecialProject(state, "top-team-clinic");

    const scheduled = scheduleTopTeamClinic(
      purchased,
      targetPlayerId,
      "defense",
    );

    expect(scheduled.eventMemory.scheduledFollowUps.at(-1)).toMatchObject({
      eventId: "event.phase51-top-team-clinic-defense",
      eligibleDate: addWeeks(state.date, 1),
      actorPlayerIds: [targetPlayerId],
      chainStage: 1,
    });
  });
});
