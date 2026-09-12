import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";
import { buildSeasonResultPresentation } from "../../../../src/features/season/seasonResultPresentation";

describe("season result presentation", () => {
  it("formats archived goals, rank movement, and season deltas", () => {
    const state = createDemoGame();
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;

    const result = advanceGameWeek(state, gameData);
    const summary = result.state.history.seasonGoalSeasons?.at(-1);
    if (!summary) throw new Error("season result missing");

    const presentation = buildSeasonResultPresentation(summary);

    expect(presentation.academicYear).toBe(summary.academicYear);
    expect(presentation.achievedCount).toBe(summary.achievedCount);
    expect(presentation.goalCount).toBe(summary.goalResults.length);
    expect(presentation.regional).toEqual({
      startingRank: summary.startingRanks.regional,
      finalRank: summary.finalRanks.regional,
      movement: summary.startingRanks.regional - summary.finalRanks.regional,
    });
    expect(presentation.national).toEqual({
      startingRank: summary.startingRanks.national,
      finalRank: summary.finalRanks.national,
      movement: summary.startingRanks.national - summary.finalRanks.national,
    });
    expect(presentation.deltas).toEqual(summary.deltas);
    expect(presentation.goals).toHaveLength(3);
    expect(presentation.goals[0]?.label).toMatch(/^県内\d+位以内$/);
    expect(presentation.goals[0]?.progressLabel).toMatch(/^最終 \d+位$/);
    expect(presentation.goals[1]?.label).toMatch(/^公式戦\d+勝$/);
    expect(presentation.goals[1]?.progressLabel).toMatch(/^\d+\/\d+勝$/);
    expect(["県大会優勝", "全国大会出場", "全国大会優勝"]).toContain(
      presentation.goals[2]?.label,
    );
    expect(["達成", "未達成"]).toContain(presentation.goals[2]?.progressLabel);
  });
});
