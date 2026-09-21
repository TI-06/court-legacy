import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { playerId } from "../../../../src/domain/model/identifiers";
import {
  applyRecruitmentAction,
  candidateEngagement,
  recruitmentInterestScore,
  recruitmentRecommendationAvailable,
  recruitmentVisitsRemaining,
} from "../../../../src/domain/scouting/recruitmentEngagement";

describe("recruitmentEngagement", () => {
  it("raises a candidate's interest deterministically through visits", () => {
    const state = createDemoGame();
    const candidateId = playerId("candidate-phase26-3");
    const before = recruitmentInterestScore(state, candidateId, 5);

    const first = applyRecruitmentAction(state, candidateId, "visit");
    expect(first.applied).toBe(true);
    expect(recruitmentInterestScore(first.state, candidateId, 5)).toBe(
      before + 12,
    );
    expect(candidateEngagement(first.state, candidateId)).toMatchObject({
      interestBonus: 12,
      visits: 1,
      recommendationUsed: false,
    });
    expect(recruitmentVisitsRemaining(first.state)).toBe(3);
  });

  it("limits school visits to four per recruiting year", () => {
    const candidateId = playerId("candidate-phase26-3");
    let state = createDemoGame();

    for (let index = 0; index < 4; index += 1) {
      const result = applyRecruitmentAction(state, candidateId, "visit");
      expect(result.applied).toBe(true);
      state = result.state;
    }

    expect(recruitmentVisitsRemaining(state)).toBe(0);
    expect(applyRecruitmentAction(state, candidateId, "visit")).toMatchObject({
      applied: false,
      reason: "visit-limit",
    });
  });

  it("allows only one recommendation slot across the recruiting year", () => {
    const firstCandidateId = playerId("candidate-a");
    const secondCandidateId = playerId("candidate-b");
    const state = createDemoGame();

    const first = applyRecruitmentAction(
      state,
      firstCandidateId,
      "recommendation",
    );
    expect(first.applied).toBe(true);
    expect(recruitmentRecommendationAvailable(first.state)).toBe(false);
    expect(candidateEngagement(first.state, firstCandidateId)).toMatchObject({
      interestBonus: 24,
      recommendationUsed: true,
    });

    expect(
      applyRecruitmentAction(first.state, secondCandidateId, "recommendation"),
    ).toMatchObject({
      applied: false,
      reason: "recommendation-limit",
    });
  });
});
