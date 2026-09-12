import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";
import { SchoolScreen } from "../../../../src/features/school/SchoolScreen";
import { buildSeasonResultPresentation } from "../../../../src/features/season/seasonResultPresentation";

describe("school archived season history", () => {
  it("shows the latest archived season in records after an academic-year rollover", () => {
    const state = createDemoGame();
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.calendar.weekOfYear = 52;

    const result = advanceGameWeek(state, gameData);
    const archived = result.state.history.seasonGoalSeasons?.at(-1);
    if (!archived) throw new Error("season result missing");
    const presentation = buildSeasonResultPresentation(archived);

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={result.state} />);
    fireEvent.click(screen.getByRole("tab", { name: "記録" }));

    const history = screen.getByRole("region", { name: "過去シーズン" });
    expect(history).toBeVisible();
    expect(
      within(history).getByRole("heading", {
        name: `${presentation.academicYear}年目`,
      }),
    ).toBeVisible();
    expect(history).toHaveTextContent(
      `${presentation.achievedCount}/${presentation.goalCount}目標達成`,
    );
    expect(history).toHaveTextContent(
      `県内 ${presentation.regional.finalRank}位`,
    );
    expect(history).toHaveTextContent(
      `全国 ${presentation.national.finalRank}位`,
    );
    for (const goal of presentation.goals) {
      const goalRow = within(history).getByTestId(
        `school-season-history-goal-${goal.id}`,
      );
      expect(within(goalRow).getByText(goal.label)).toBeVisible();
      expect(
        within(goalRow).getByText(goal.progressLabel, { selector: "small" }),
      ).toBeVisible();
    }
  });

  it("does not show archived-season UI before the first rollover", () => {
    const state = createDemoGame();

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);
    fireEvent.click(screen.getByRole("tab", { name: "記録" }));

    expect(
      screen.queryByRole("region", { name: "過去シーズン" }),
    ).not.toBeInTheDocument();
  });
});
