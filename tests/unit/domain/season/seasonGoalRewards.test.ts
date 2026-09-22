import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  grantCompletedSeasonGoalRewards,
  seasonGoalEarnedFunds,
  seasonGoalFundReward,
} from "../../../../src/domain/season/seasonGoalRewards";
import type {
  SeasonGoalResult,
  SeasonGoalSeasonSummary,
} from "../../../../src/domain/season/seasonGoalTypes";

function summary(goals: SeasonGoalResult[]): SeasonGoalSeasonSummary {
  return {
    yearIndex: 1,
    academicYear: 1,
    startingRanks: { regional: 8, national: 120 },
    finalRanks: { regional: 4, national: 80 },
    deltas: {
      officialWins: 4,
      prefecturalTitles: 1,
      nationalAppearances: 1,
      nationalTitles: 0,
    },
    goalResults: goals,
    achievedCount: goals.filter((goal) => goal.achieved).length,
  };
}

describe("season goal rewards", () => {
  it("scales rewards by goal difficulty without overtaking tournament rewards", () => {
    expect(
      seasonGoalFundReward({
        id: "rank",
        kind: "regional-rank",
        target: 4,
      }),
    ).toBe(120);
    expect(
      seasonGoalFundReward({
        id: "wins-2",
        kind: "official-wins",
        target: 2,
      }),
    ).toBe(100);
    expect(
      seasonGoalFundReward({
        id: "wins-7",
        kind: "official-wins",
        target: 7,
      }),
    ).toBe(245);
    expect(
      seasonGoalFundReward({
        id: "pref",
        kind: "tournament-achievement",
        target: 1,
        achievement: "prefectural-title",
      }),
    ).toBe(200);
    expect(
      seasonGoalFundReward({
        id: "national",
        kind: "tournament-achievement",
        target: 1,
        achievement: "national-title",
      }),
    ).toBe(500);
  });

  it("grants only achieved goals and never grants the same goal twice", () => {
    const state = createDemoGame();
    const beforeFunds = state.schools[state.userSchoolId]!.funds;
    const goals: SeasonGoalResult[] = [
      {
        id: "season:1:regional-rank",
        kind: "regional-rank",
        target: 4,
        progress: 3,
        achieved: true,
      },
      {
        id: "season:1:official-wins",
        kind: "official-wins",
        target: 4,
        progress: 3,
        achieved: false,
      },
      {
        id: "season:1:tournament-achievement",
        kind: "tournament-achievement",
        target: 1,
        achievement: "prefectural-title",
        progress: 1,
        achieved: true,
      },
    ];

    const first = grantCompletedSeasonGoalRewards(state, summary(goals));
    const expected = seasonGoalEarnedFunds(goals);
    expect(first.schools[first.userSchoolId]!.funds).toBe(
      beforeFunds + expected,
    );
    expect(
      first.schoolManagement.fundsHistory.filter(
        (entry) => entry.kind === "season-goal-reward",
      ),
    ).toHaveLength(2);

    const second = grantCompletedSeasonGoalRewards(first, summary(goals));
    expect(second.schools[second.userSchoolId]!.funds).toBe(
      beforeFunds + expected,
    );
    expect(
      second.schoolManagement.fundsHistory.filter(
        (entry) => entry.kind === "season-goal-reward",
      ),
    ).toHaveLength(2);
  });
});
