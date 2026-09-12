import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";
import { YearTransitionDialog } from "../../../../src/features/home/YearTransitionDialog";
import { buildSeasonResultPresentation } from "../../../../src/features/season/seasonResultPresentation";

describe("year transition dialog", () => {
  it("shows completed season goals before the new-year roster summary", () => {
    const state = createDemoGame();
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;
    state.world.nextGenerationalTalentYear = 2;
    const result = advanceGameWeek(state, gameData);
    const summary = result.academicYearTransition;
    const seasonSummary = result.state.history.seasonGoalSeasons?.at(-1);
    if (!summary || !seasonSummary) {
      throw new Error("transition missing");
    }
    const season = buildSeasonResultPresentation(seasonSummary);
    const onClose = vi.fn();

    render(
      <YearTransitionDialog
        onClose={onClose}
        state={result.state}
        summary={summary}
      />,
    );

    expect(screen.getByRole("dialog", { name: "2年目の新年度" })).toBeVisible();
    const seasonReview = screen.getByRole("region", {
      name: "シーズン振り返り",
    });
    expect(
      within(seasonReview).getByRole("heading", {
        name: `${season.academicYear}年目 シーズン結果`,
      }),
    ).toBeVisible();
    expect(seasonReview).toHaveTextContent(
      `${season.achievedCount}/${season.goalCount}目標達成`,
    );
    expect(seasonReview).toHaveTextContent(
      `県内 ${season.regional.startingRank}位 → ${season.regional.finalRank}位`,
    );
    expect(seasonReview).toHaveTextContent(
      `全国 ${season.national.startingRank}位 → ${season.national.finalRank}位`,
    );
    for (const goal of season.goals) {
      expect(within(seasonReview).getByText(goal.label)).toBeVisible();
      expect(within(seasonReview).getByText(goal.progressLabel)).toBeVisible();
    }

    const graduationMetric = screen
      .getByText("卒業", { selector: ".year-transition-metrics span" })
      .closest("div");
    const intakeMetric = screen
      .getByText("新入生", { selector: ".year-transition-metrics span" })
      .closest("div");
    expect(graduationMetric).not.toBeNull();
    expect(intakeMetric).not.toBeNull();
    expect(within(graduationMetric!).getByText("4名")).toBeVisible();
    expect(within(intakeMetric!).getByText(/\d+名/)).toBeVisible();
    expect(screen.getByText("新主将")).toBeVisible();
    expect(screen.getByText("世代級選手が入学")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "新年度を始める" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the year transition usable for legacy v8 state without an archived season", () => {
    const state = createDemoGame();
    state.seasonGoals = undefined;
    state.history.seasonGoalSeasons = undefined;
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;

    const result = advanceGameWeek(state, gameData);
    const summary = result.academicYearTransition;
    if (!summary) throw new Error("transition missing");

    render(
      <YearTransitionDialog
        onClose={vi.fn()}
        state={result.state}
        summary={summary}
      />,
    );

    expect(screen.getByRole("dialog", { name: "2年目の新年度" })).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "シーズン振り返り" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "新年度を始める" }),
    ).toBeVisible();
  });
});
