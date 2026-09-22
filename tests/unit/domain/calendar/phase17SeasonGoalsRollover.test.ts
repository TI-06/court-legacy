import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";
import { seasonGoalEarnedFunds } from "../../../../src/domain/season/seasonGoalRewards";

describe("Phase17 season goal rollover", () => {
  it("archives the completed season and creates next-year goals", () => {
    const state = createDemoGame();
    expect(state.seasonGoals?.yearIndex).toBe(1);
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;
    const completedGoals = structuredClone(state.seasonGoals!);

    const result = advanceGameWeek(state, gameData);
    const archived = result.state.history.seasonGoalSeasons?.at(-1);
    const nextGoals = result.state.seasonGoals;
    const nextUserSchool = result.state.schools[result.state.userSchoolId]!;

    expect(result.academicYearTransition).not.toBeNull();
    expect(archived?.yearIndex).toBe(completedGoals.yearIndex);
    expect(archived?.academicYear).toBe(completedGoals.academicYear);
    expect(nextGoals?.yearIndex).toBe(2);
    expect(nextGoals?.academicYear).toBe(2);
    expect(nextGoals?.baseline).toMatchObject({
      officialWins: nextUserSchool.history.officialWins,
      prefecturalTitles: nextUserSchool.history.prefecturalTitles,
      nationalAppearances: nextUserSchool.history.nationalAppearances,
      nationalTitles: nextUserSchool.history.nationalTitles,
    });
  });

  it("grants achieved season goal rewards before the new annual budget", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const goals = state.seasonGoals!;
    const regional = goals.goals.find((goal) => goal.kind === "regional-rank")!;
    const wins = goals.goals.find((goal) => goal.kind === "official-wins")!;
    const tournament = goals.goals.find(
      (goal) => goal.kind === "tournament-achievement",
    )!;

    regional.target = Math.max(regional.target, goals.rankingTotals.regional);
    wins.target = 1;
    tournament.achievement = "prefectural-title";
    school.history.officialWins = goals.baseline.officialWins + 1;
    school.history.prefecturalTitles = goals.baseline.prefecturalTitles + 1;

    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;

    const result = advanceGameWeek(state, gameData);
    const archived = result.state.history.seasonGoalSeasons?.at(-1);
    if (!archived) throw new Error("season result missing");

    expect(archived.achievedCount).toBe(3);
    const rewardEntries = result.state.schoolManagement.fundsHistory.filter(
      (entry) => entry.kind === "season-goal-reward",
    );
    expect(rewardEntries).toHaveLength(3);
    expect(
      rewardEntries.reduce((total, entry) => total + entry.amount, 0),
    ).toBe(seasonGoalEarnedFunds(archived.goalResults));

    const annualBudgetIndex = result.state.schoolManagement.fundsHistory.findIndex(
      (entry) => entry.id === "annual-budget:year-2",
    );
    const lastRewardIndex = result.state.schoolManagement.fundsHistory.reduce(
      (latest, entry, index) =>
        entry.kind === "season-goal-reward" ? index : latest,
      -1,
    );
    expect(lastRewardIndex).toBeGreaterThanOrEqual(0);
    expect(annualBudgetIndex).toBeGreaterThan(lastRewardIndex);
  });

  it("starts Phase17 cleanly when an old v8 save had no season goals", () => {
    const state = createDemoGame();
    state.seasonGoals = undefined;
    state.history.seasonGoalSeasons = undefined;
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;

    const result = advanceGameWeek(state, gameData);

    expect(result.academicYearTransition).not.toBeNull();
    expect(result.state.history.seasonGoalSeasons).toBeUndefined();
    expect(result.state.seasonGoals?.yearIndex).toBe(2);
  });
});
