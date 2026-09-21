import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import {
  buildOpponentAnalysis,
  calculateOpponentAnalysisScore,
} from "../../../../src/features/match/opponentAnalysis";

function fixture() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const opponent = Object.values(state.schools).find(
    (candidate) => candidate.id !== state.userSchoolId,
  );
  if (!opponent) throw new Error("opponent fixture missing");

  return {
    state,
    school,
    opponent,
    opponentSelection: autoSelectTeam({
      state,
      schoolId: opponent.id,
    }),
  };
}

describe("opponentAnalysis", () => {
  it("improves analysis score from coach observation and analysis-room investment", () => {
    const { state, school } = fixture();
    school.coach.observation = 40;
    school.facilities.analysisRoom = 0;
    expect(calculateOpponentAnalysisScore(state)).toBe(40);

    school.facilities.analysisRoom = 15;
    expect(calculateOpponentAnalysisScore(state)).toBe(70);
  });

  it("recommends existing tactic counters without adding a hidden match bonus", () => {
    const { state, school, opponentSelection } = fixture();
    school.coach.observation = 80;
    school.facilities.analysisRoom = 5;

    const report = buildOpponentAnalysis({
      state,
      opponentSelection,
      opponentTactics: {
        serve: "aggressive",
        attack: "quick",
        block: "read",
      },
      basePlan: {
        serve: "balanced",
        attack: "balanced",
        block: "mixed",
      },
    });

    expect(report.tier).toBe("advanced");
    expect(report.recommendedPlan).toMatchObject({
      attack: "quick",
      block: "commit",
    });
    expect(report.observations.length).toBeGreaterThanOrEqual(3);
    expect(report.recommendedReasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("高速"),
        expect.stringContaining("コミット"),
      ]),
    );
  });
});
