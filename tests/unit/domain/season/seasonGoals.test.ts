import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  createSeasonGoals,
  evaluateSeasonGoals,
} from "../../../../src/domain/season/seasonGoals";

describe("Phase17 season goals", () => {
  it("creates deterministic goals from the season-start state", () => {
    const state = createDemoGame();

    const first = createSeasonGoals(state);
    const second = createSeasonGoals(structuredClone(state));

    expect(first).toEqual(second);
    expect(first.yearIndex).toBe(state.yearIndex);
    expect(first.academicYear).toBe(state.calendar.academicYear);
    expect(first.startingRanks.regional).toBeGreaterThan(0);
    expect(first.startingRanks.national).toBeGreaterThan(0);
    expect(first.goals.map((goal) => goal.kind)).toEqual([
      "regional-rank",
      "official-wins",
      "tournament-achievement",
    ]);
  });

  it("uses season-start cumulative history as a baseline", () => {
    const state = createDemoGame();
    const user = state.schools[state.userSchoolId]!;
    user.history.officialWins = 12;
    user.history.prefecturalTitles = 2;
    user.history.nationalAppearances = 1;
    user.history.nationalTitles = 0;

    const goals = createSeasonGoals(state);
    const progressed = structuredClone(state);
    const progressedUser = progressed.schools[progressed.userSchoolId]!;
    progressedUser.history.officialWins = 16;
    progressedUser.history.prefecturalTitles = 3;
    progressedUser.history.nationalAppearances = 2;

    const result = evaluateSeasonGoals(progressed, goals);

    expect(result.deltas.officialWins).toBe(4);
    expect(result.deltas.prefecturalTitles).toBe(1);
    expect(result.deltas.nationalAppearances).toBe(1);
    expect(result.deltas.nationalTitles).toBe(0);
    expect(result.goalResults).toHaveLength(goals.goals.length);
  });

  it("evaluates final regional and national ranks against persisted targets", () => {
    const state = createDemoGame();
    const goals = createSeasonGoals(state);
    const progressed = structuredClone(state);
    const user = progressed.schools[progressed.userSchoolId]!;
    user.reputationPoints = 1400;
    user.history.nationalTitles += 2;

    const result = evaluateSeasonGoals(progressed, goals);
    const rankGoal = result.goalResults.find(
      (goal) => goal.kind === "regional-rank",
    )!;

    expect(result.finalRanks.regional).toBe(1);
    expect(result.finalRanks.national).toBe(1);
    expect(rankGoal.progress).toBe(1);
    expect(rankGoal.achieved).toBe(true);
    expect(result.achievedCount).toBe(
      result.goalResults.filter((goal) => goal.achieved).length,
    );
  });
});
