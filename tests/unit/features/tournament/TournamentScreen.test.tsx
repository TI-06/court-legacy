import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import { advanceOfficialTournamentsThroughWeek } from "../../../../src/domain/tournament/progressOfficialTournaments";
import { TournamentScreen } from "../../../../src/features/tournament/TournamentScreen";

function atWeek(weekOfYear: number): GameState {
  const state = createDemoGame();
  return { ...state, calendar: { ...state.calendar, weekOfYear } };
}

function dueState(): GameState {
  return advanceOfficialTournamentsThroughWeek(atWeek(9));
}

describe("TournamentScreen", () => {
  it("shows one round at a time without a horizontally scrolling bracket", () => {
    const state = createDemoGame();
    const { container } = render(
      <TournamentScreen
        circuit="interhigh"
        level="prefectural"
        onBack={vi.fn()}
        state={state}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "インターハイ 県大会" }),
    ).toBeVisible();
    const firstRound = screen.getByRole("button", { name: "1回戦" });
    const quarterfinal = screen.getByRole("button", { name: "準々決勝" });
    expect(firstRound).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("tournament-bracket-match")).toHaveLength(8);
    expect(
      container.querySelector(".tournament-match-row--user .is-user"),
    ).toBeInTheDocument();
    fireEvent.click(quarterfinal);
    expect(quarterfinal).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("tournament-bracket-match")).toHaveLength(4);
  });

  it("keeps a due official match reference-only and points execution to Home", () => {
    render(
      <TournamentScreen
        circuit="interhigh"
        level="prefectural"
        onBack={vi.fn()}
        state={dueState()}
      />,
    );
    expect(screen.getAllByText("今週").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /公式戦を開始/ })).toBeNull();
    expect(
      screen.getByText(/ホームの「次の週へ進む」で試合を実施/),
    ).toBeVisible();
  });

  it("shows eliminated and champion states without an execution action", () => {
    const eliminated = createDemoGame();
    eliminated.officialSeason.interhigh.prefectural = {
      ...eliminated.officialSeason.interhigh.prefectural,
      userEliminated: true,
      userBestRound: "round-of-16",
    };
    const champion = createDemoGame();
    const userEntrant =
      champion.officialSeason.interhigh.prefectural.entrants.find(
        (entrant) =>
          entrant.source === "world-school" &&
          entrant.schoolId === champion.userSchoolId,
      );
    if (!userEntrant) throw new Error("user tournament entrant not found");
    champion.officialSeason.interhigh.prefectural = {
      ...champion.officialSeason.interhigh.prefectural,
      championEntrantId: userEntrant.entrantId,
      userBestRound: "final",
    };

    const { rerender } = render(
      <TournamentScreen
        circuit="interhigh"
        level="prefectural"
        onBack={vi.fn()}
        state={eliminated}
      />,
    );
    expect(screen.getAllByText("敗退").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /公式戦を開始/ })).toBeNull();

    rerender(
      <TournamentScreen
        circuit="interhigh"
        level="prefectural"
        onBack={vi.fn()}
        state={champion}
      />,
    );
    expect(screen.getAllByText("優勝").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /公式戦を開始/ })).toBeNull();
  });
});
