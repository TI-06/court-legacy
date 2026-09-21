import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  buildCoachTrainingRecommendation,
  buildCoachTrainingRecommendations,
  coachRecommendationQuality,
} from "../../../../src/domain/training/coachTrainingRecommendations";

describe("coachTrainingRecommendations", () => {
  it("prioritizes recovery for injured or severely out-of-form players", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const injured = state.players[school.playerIds[0]!]!;
    const tired = state.players[school.playerIds[1]!]!;

    injured.injury = {
      injuryId: "injury.phase26-4",
      severity: "minor",
      remainingWeeks: 1,
      recurrenceRisk: 0,
    };
    tired.condition = 30;

    expect(buildCoachTrainingRecommendation(state, injured)).toMatchObject({
      instructionId: "instruction.rest",
      reason: "injury",
    });
    expect(buildCoachTrainingRecommendation(state, tired)).toMatchObject({
      instructionId: "instruction.rest",
      reason: "condition",
    });
  });

  it("prioritizes an active development goal over generic weakness training", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    state.teamPlanning.developmentGoalsByPlayerId = {
      [playerId]: {
        area: "defense",
        targetGrade: "A",
      },
    };

    expect(buildCoachTrainingRecommendation(state, player)).toMatchObject({
      playerId,
      instructionId: "instruction.defense",
      reason: "development-goal",
    });
  });

  it("uses an active assistant coach specialty only when it is near the player's weakness", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    player.abilities = {
      ...player.abilities,
      spike: 42,
      serve: 43,
      decision: 44,
      receive: 40,
      block: 41,
      speed: 42,
      jump: 70,
      stamina: 72,
      mental: 74,
      set: 70,
    };
    school.coach.development = 80;
    state.schoolManagement.assistantCoach = {
      rank: "advanced",
      specialty: "attack",
      contractYearIndex: state.yearIndex,
    };

    expect(buildCoachTrainingRecommendation(state, player)).toMatchObject({
      instructionId: "instruction.attack",
      reason: "assistant-specialty",
    });
  });

  it("uses balanced fundamentals for a basic coach and weakness training for a standard coach", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    player.condition = 80;
    player.abilities = {
      ...player.abilities,
      spike: 70,
      serve: 70,
      receive: 30,
      block: 30,
      jump: 70,
      stamina: 70,
      decision: 70,
      mental: 70,
    };

    school.coach.development = 40;
    expect(buildCoachTrainingRecommendation(state, player)).toMatchObject({
      instructionId: "instruction.overall",
      reason: "balanced",
    });

    school.coach.development = 60;
    expect(buildCoachTrainingRecommendation(state, player)).toMatchObject({
      instructionId: "instruction.defense",
      reason: "weakness",
    });
  });

  it("returns one deterministic proposal per roster player without changing game state", () => {
    const state = createDemoGame();
    const before = structuredClone(state);
    const proposals = buildCoachTrainingRecommendations(state);

    expect(proposals).toHaveLength(
      state.schools[state.userSchoolId]!.playerIds.length,
    );
    expect(new Set(proposals.map((proposal) => proposal.playerId)).size).toBe(
      proposals.length,
    );
    expect(state).toEqual(before);
  });

  it("labels recommendation quality from the head coach development rating", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;

    school.coach.development = 49;
    expect(coachRecommendationQuality(state)).toBe("basic");
    school.coach.development = 50;
    expect(coachRecommendationQuality(state)).toBe("standard");
    school.coach.development = 75;
    expect(coachRecommendationQuality(state)).toBe("detailed");
  });
});
