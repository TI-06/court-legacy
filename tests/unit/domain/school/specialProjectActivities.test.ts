import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { gameDataBootstrap } from "../../../../src/data/gameData";
import { addWeeks } from "../../../../src/domain/events/eventDate";
import {
  resolveDueUniversityJointTraining,
  scheduleEliteExpedition,
  scheduleTopTeamClinic,
  scheduleUniversityJointTraining,
  selectEliteExpeditionOpponent,
} from "../../../../src/domain/school/specialProjectActivities";

if (!gameDataBootstrap.ok) {
  throw new Error(gameDataBootstrap.message);
}
const gameData = gameDataBootstrap.data;

describe("Phase51 special project activities", () => {
  it("selects a strong non-recent national opponent deterministically", () => {
    const state = createDemoGame();
    const rivals = Object.values(state.schools).filter(
      (school) => school.id !== state.userSchoolId,
    );
    const stronger = rivals[0]!;
    const recent = rivals[1]!;

    stronger.reputation = "elite";
    recent.reputation = "elite";
    for (const playerId of stronger.playerIds) {
      const player = state.players[playerId];
      if (!player) continue;
      for (const ability of Object.keys(player.abilities) as Array<
        keyof typeof player.abilities
      >) {
        player.abilities[ability] = 95;
      }
    }
    for (const playerId of recent.playerIds) {
      const player = state.players[playerId];
      if (!player) continue;
      for (const ability of Object.keys(player.abilities) as Array<
        keyof typeof player.abilities
      >) {
        player.abilities[ability] = 99;
      }
    }
    state.weeklySchedule.recentPracticeMatches = [
      { opponentSchoolId: recent.id, date: state.date },
    ];

    expect(selectEliteExpeditionOpponent(state)).toBe(stronger.id);

    const scheduled = scheduleEliteExpedition(state, stronger.id);
    expect(scheduled.weeklySchedule.practiceMatch.scheduledOpponentId).toBe(
      stronger.id,
    );
    expect(scheduled.weeklySchedule.practiceMatch.scheduledBy).toBe("outgoing");
  });

  it("resolves scheduled university joint training once and clears the bounded reservation", () => {
    const state = createDemoGame();
    state.schoolManagement.specialProjects = {
      yearIndex: state.yearIndex,
      purchasedProjectIds: ["university-joint-training"],
    };
    const scheduled = scheduleUniversityJointTraining(state, "attack");
    const eligibleDate =
      scheduled.schoolManagement.specialProjects
        ?.pendingUniversityJointTraining?.eligibleDate;
    expect(eligibleDate).toBe(addWeeks(state.date, 1));

    scheduled.date = eligibleDate!;

    const resolved = resolveDueUniversityJointTraining(scheduled, gameData);
    expect(resolved).not.toBeNull();
    expect(resolved?.result.focus).toBe("attack");
    expect(resolved?.result.participantCount).toBeGreaterThan(0);
    expect(resolved?.result.grewPlayerCount).toBeGreaterThan(0);
    expect(resolved?.result.totalAbilityGrowth).toBeGreaterThan(0);
    expect(
      resolved?.state.schoolManagement.specialProjects
        ?.pendingUniversityJointTraining,
    ).toBeUndefined();

    expect(
      resolveDueUniversityJointTraining(resolved!.state, gameData),
    ).toBeNull();
  });

  it("schedules a clinic follow-up for the chosen healthy player and focus", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const scheduled = scheduleTopTeamClinic(state, playerId, "serve");
    const followUp = scheduled.eventMemory.scheduledFollowUps.at(-1);

    expect(followUp).toMatchObject({
      eventId: "event.phase51-clinic-serve",
      eligibleDate: addWeeks(state.date, 1),
      actorPlayerIds: [playerId],
      chainStage: 1,
    });
  });

  it("does not schedule a clinic for an injured player", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.players[playerId]!.injury = {
      injuryId: "phase51-test-injury",
      severity: "minor",
      remainingWeeks: 1,
      recurrenceRisk: 0,
    };

    expect(scheduleTopTeamClinic(state, playerId, "attack")).toBe(state);
  });
});
