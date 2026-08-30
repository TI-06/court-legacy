import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { advanceOfficialTournamentsThroughWeek } from "../../../../src/domain/tournament/progressOfficialTournaments";
import { MatchOfficialEntry } from "../../../../src/features/match/MatchOfficialEntry";

function atWeek(weekOfYear: number) {
  const state = createDemoGame();
  return {
    ...state,
    calendar: {
      ...state.calendar,
      weekOfYear,
    },
  };
}

describe("MatchOfficialEntry", () => {
  it("shows the next official tournament before it becomes due", () => {
    const onOpen = vi.fn();

    render(<MatchOfficialEntry onOpen={onOpen} state={createDemoGame()} />);

    expect(screen.getByRole("heading", { name: "公式大会" })).toBeVisible();
    expect(screen.getByText("インターハイ 県大会")).toBeVisible();
    expect(screen.getByText("あと8週")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "大会表を見る" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("shows the authoritative opponent when the official match is due", () => {
    const state = advanceOfficialTournamentsThroughWeek(atWeek(9));

    render(<MatchOfficialEntry onOpen={vi.fn()} state={state} />);

    expect(screen.getByText("今週")).toBeVisible();
    expect(screen.getByText(/対戦:/)).toBeVisible();
  });
});
