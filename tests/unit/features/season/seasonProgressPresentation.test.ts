import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { buildSeasonProgressPresentation } from "../../../../src/features/season/seasonProgressPresentation";

function tournamentGoalLabel(
  achievement: "prefectural-title" | "national-appearance" | "national-title",
): string {
  if (achievement === "national-title") return "全国大会優勝";
  if (achievement === "national-appearance") return "全国大会出場";
  return "県大会優勝";
}

describe("Phase17 season progress presentation", () => {
  it("presents all season goals and both authoritative rankings", () => {
    const state = createDemoGame();
    const seasonGoals = state.seasonGoals!;

    const presentation = buildSeasonProgressPresentation(state);

    expect(presentation).not.toBeNull();
    expect(presentation!.academicYear).toBe(state.calendar.academicYear);
    expect(presentation!.goalCount).toBe(3);
    expect(presentation!.goals).toHaveLength(3);

    const regionalGoal = seasonGoals.goals.find(
      (goal) => goal.kind === "regional-rank",
    )!;
    const winsGoal = seasonGoals.goals.find(
      (goal) => goal.kind === "official-wins",
    )!;
    const tournamentGoal = seasonGoals.goals.find(
      (goal) => goal.kind === "tournament-achievement",
    )!;

    expect(presentation!.goals.map((goal) => goal.label)).toEqual([
      `県内${regionalGoal.target}位以内`,
      `公式戦${winsGoal.target}勝`,
      tournamentGoalLabel(tournamentGoal.achievement),
    ]);
    expect(presentation!.regional.rank).toBeGreaterThan(0);
    expect(presentation!.regional.total).toBeGreaterThanOrEqual(
      presentation!.regional.rank,
    );
    expect(presentation!.national.rank).toBeGreaterThan(0);
    expect(presentation!.national.total).toBeGreaterThanOrEqual(
      presentation!.national.rank,
    );
    expect(presentation!.regional.nearby.some((row) => row.isUserSchool)).toBe(
      true,
    );
    expect(presentation!.national.nearby.some((row) => row.isUserSchool)).toBe(
      true,
    );
    expect(presentation!.regional.nearby.length).toBeLessThanOrEqual(5);
    expect(presentation!.national.nearby.length).toBeLessThanOrEqual(5);
  });

  it("calculates rank movement from the persisted season-start ranks", () => {
    const state = createDemoGame();
    const startingRanks = { ...state.seasonGoals!.startingRanks };
    state.schools[state.userSchoolId]!.reputationPoints = 10_000;

    const presentation = buildSeasonProgressPresentation(state)!;

    expect(presentation.regional.rank).toBe(1);
    expect(presentation.national.rank).toBe(1);
    expect(presentation.regional.startingRank).toBe(startingRanks.regional);
    expect(presentation.national.startingRank).toBe(startingRanks.national);
    expect(presentation.regional.movement).toBe(startingRanks.regional - 1);
    expect(presentation.national.movement).toBe(startingRanks.national - 1);
    expect(
      presentation.regional.nearby.find((row) => row.isUserSchool)?.rank,
    ).toBe(1);
    expect(
      presentation.national.nearby.find((row) => row.isUserSchool)?.rank,
    ).toBe(1);
  });

  it("returns null for a legacy state that has no season goals", () => {
    const state = createDemoGame();
    delete state.seasonGoals;

    expect(buildSeasonProgressPresentation(state)).toBeNull();
  });
});
