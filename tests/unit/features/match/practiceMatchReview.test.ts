import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { simulateMatch } from "../../../../src/domain/match/simulateMatch";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { selectPracticeOpponent } from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { buildPracticeMatchReview } from "../../../../src/features/match/practiceMatchReview";

function completedMatch() {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  const homeSelection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const awaySelection = autoSelectTeam({
    state,
    schoolId: opponent.id,
  });
  const result = simulateMatch({
    state,
    id: matchId("phase29-3-review"),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponent.id,
    homeSelection,
    awaySelection,
    bestOfSets: 3,
    random: new SeededRandom("phase29-3-review"),
  });

  return { state, match: result.match };
}

describe("practiceMatchReview", () => {
  it("treats a bold win over a clearly stronger opponent as aligned challenge progress", () => {
    const { state, match } = completedMatch();
    state.seasonGoals = {
      ...state.seasonGoals!,
      ambition: "bold",
    };
    match.homeSetsWon = 2;
    match.awaySetsWon = 1;

    expect(
      buildPracticeMatchReview({
        state,
        match,
        homeStrength: 60,
        awayStrength: 75,
      }),
    ).toEqual({
      ambition: "bold",
      ambitionLabel: "野心",
      tier: "challenge",
      tierLabel: "強豪",
      alignmentLabel: "方針一致",
      headline: "強豪相手に成果",
      strengthDifferenceLabel: "戦力差 +15",
      nextRecommendation: "強豪戦を継続",
    });
  });

  it("flags an easier opponent than the challenge plan and recommends the next step after a loss", () => {
    const { state, match } = completedMatch();
    state.seasonGoals = {
      ...state.seasonGoals!,
      ambition: "challenge",
    };
    match.homeSetsWon = 0;
    match.awaySetsWon = 2;

    expect(
      buildPracticeMatchReview({
        state,
        match,
        homeStrength: 70,
        awayStrength: 68,
      }),
    ).toMatchObject({
      ambitionLabel: "挑戦",
      tier: "same",
      alignmentLabel: "方針より低負荷",
      headline: "基礎完成度に課題",
      strengthDifferenceLabel: "戦力差 -2",
      nextRecommendation: "同程度でもう一度確認",
    });
  });
});
