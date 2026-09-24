import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";
import { SchoolScreen } from "../../../../src/features/school/SchoolScreen";
import {
  buildSeasonResultPresentation,
  type SeasonResultPresentation,
} from "../../../../src/features/season/seasonResultPresentation";
import { SchoolSeasonHistory } from "../../../../src/features/school/SchoolSeasonHistory";

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
    fireEvent.click(screen.getByRole("tab", { name: "歴史" }));

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
      `報酬 +${presentation.earnedRewardFunds}`,
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
        within(goalRow).getByText(
          (_content, element) =>
            element?.tagName === "SMALL" &&
            Boolean(element.textContent?.includes(goal.progressLabel)),
        ),
      ).toBeVisible();
    }
  });

  it("keeps long-run season history bounded and opens the full archive on demand", () => {
    const presentations: SeasonResultPresentation[] = Array.from(
      { length: 7 },
      (_, index) => ({
        academicYear: 2032 - index,
        achievedCount: 2,
        goalCount: 3,
        goals: [
          {
            id: `goal-${index}`,
            label: `目標${index}`,
            progressLabel: "達成",
            achieved: true,
            rewardFunds: 120,
          },
        ],
        regional: {
          startingRank: 12,
          finalRank: 7,
          movement: 5,
        },
        national: {
          startingRank: 128,
          finalRank: 80,
          movement: 48,
        },
        deltas: {
          officialWins: 4,
          prefecturalTitles: 1,
          nationalAppearances: 0,
          nationalTitles: 0,
        },
        earnedRewardFunds: 120,
      }),
    );

    render(<SchoolSeasonHistory presentations={presentations} />);

    const history = screen.getByRole("region", { name: "過去シーズン" });
    expect(
      within(history).getAllByTestId("school-season-history-card"),
    ).toHaveLength(3);
    expect(
      within(history).getByRole("button", { name: "過去7年分をすべて見る" }),
    ).toBeVisible();

    fireEvent.click(
      within(history).getByRole("button", { name: "過去7年分をすべて見る" }),
    );
    const dialog = screen.getByRole("dialog", { name: "過去シーズン一覧" });
    expect(
      within(dialog).getAllByTestId("school-season-history-card"),
    ).toHaveLength(7);
  });

  it("does not show archived-season UI before the first rollover", () => {
    const state = createDemoGame();

    render(<SchoolScreen onUpgradeFacility={vi.fn()} state={state} />);
    fireEvent.click(screen.getByRole("tab", { name: "記録" }));
    fireEvent.click(screen.getByRole("tab", { name: "歴史" }));

    expect(
      screen.queryByRole("region", { name: "過去シーズン" }),
    ).not.toBeInTheDocument();
  });
});
