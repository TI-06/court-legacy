import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { advanceGameWeek } from "../../../../src/domain/calendar/academicYearProgression";
import { YearTransitionDialog } from "../../../../src/features/home/YearTransitionDialog";

describe("year transition dialog", () => {
  it("shows user-school graduates, intake, captain, and generational talent", () => {
    const state = createDemoGame();
    state.date = "2027-03-31";
    state.calendar.currentDate = state.date;
    state.world.nextGenerationalTalentYear = 2;
    const result = advanceGameWeek(state, gameData);
    const summary = result.academicYearTransition;
    if (!summary) {
      throw new Error("transition missing");
    }
    const onClose = vi.fn();

    render(
      <YearTransitionDialog
        onClose={onClose}
        state={result.state}
        summary={summary}
      />,
    );

    expect(screen.getByRole("dialog", { name: "2年目の新年度" })).toBeVisible();
    expect(screen.getByText("卒業 4名")).toBeVisible();
    expect(screen.getByText(/新入生 \d+名/)).toBeVisible();
    expect(screen.getByText("新主将")).toBeVisible();
    expect(screen.getByText("世代級選手が入学")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "新年度を始める" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
