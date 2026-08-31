import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import { advanceOfficialTournamentsThroughWeek } from "../../../../src/domain/tournament/progressOfficialTournaments";
import { TournamentScreen } from "../../../../src/features/tournament/TournamentScreen";

function atWeek(weekOfYear: number): GameState {
  const state = createDemoGame();
  return {
    ...state,
    calendar: {
      ...state.calendar,
      weekOfYear,
    },
  };
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
        onStartOfficialMatch={vi.fn()}
        pending={false}
        state={state}
        trainingCompleted={false}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "インターハイ 県大会" }),
    ).toBeVisible();
    expect(screen.getAllByText("あと8週").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("城南商業").length).toBeGreaterThan(0);

    const firstRound = screen.getByRole("button", { name: "1回戦" });
    const quarterfinal = screen.getByRole("button", { name: "準々決勝" });
    expect(firstRound).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("tournament-bracket-match")).toHaveLength(8);
    expect(
      container.querySelector(".tournament-match-row--user .is-user"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("tournament-bracket-scroll")).toBeNull();

    fireEvent.click(quarterfinal);
    expect(quarterfinal).toHaveAttribute("aria-pressed", "true");
    expect(firstRound).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByTestId("tournament-bracket-match")).toHaveLength(4);

    expect(screen.queryByText("OFFICIAL TOURNAMENT")).toBeNull();
    expect(screen.queryByText("BRACKET")).toBeNull();
    expect(screen.queryByText("NEXT MATCH")).toBeNull();
  });

  it("keeps a due official match blocked until weekly training is complete", () => {
    const state = dueState();

    render(
      <TournamentScreen
        circuit="interhigh"
        level="prefectural"
        onBack={vi.fn()}
        onStartOfficialMatch={vi.fn()}
        pending={false}
        state={state}
        trainingCompleted={false}
      />,
    );

    expect(screen.getAllByText("今週").length).toBeGreaterThan(0);
    expect(
      screen.getByText("今週の練習を完了すると開始できます"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "公式戦を開始" })).toBeDisabled();
  });

  it("asks for confirmation before starting when the setting is enabled", () => {
    const state = dueState();
    const onStartOfficialMatch = vi.fn();

    render(
      <TournamentScreen
        circuit="interhigh"
        level="prefectural"
        onBack={vi.fn()}
        onStartOfficialMatch={onStartOfficialMatch}
        pending={false}
        state={state}
        trainingCompleted
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "公式戦を開始" }));
    expect(onStartOfficialMatch).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog", { name: "公式戦を開始しますか" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "この試合を開始" }),
    );

    expect(onStartOfficialMatch).toHaveBeenCalledOnce();
  });

  it("starts immediately when confirmation is disabled", () => {
    const state = dueState();
    state.settings = {
      ...state.settings,
      confirmBeforeOfficialMatch: false,
    };
    const onStartOfficialMatch = vi.fn();

    render(
      <TournamentScreen
        circuit="interhigh"
        level="prefectural"
        onBack={vi.fn()}
        onStartOfficialMatch={onStartOfficialMatch}
        pending={false}
        state={state}
        trainingCompleted
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "公式戦を開始" }));

    expect(onStartOfficialMatch).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("dialog", { name: "公式戦を開始しますか" }),
    ).toBeNull();
  });

  it("shows eliminated and champion states without an active start action", () => {
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
    if (!userEntrant) {
      throw new Error("user tournament entrant not found");
    }
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
        onStartOfficialMatch={vi.fn()}
        pending={false}
        state={eliminated}
        trainingCompleted
      />,
    );

    expect(screen.getAllByText("敗退").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "公式戦を開始" })).toBeNull();

    rerender(
      <TournamentScreen
        circuit="interhigh"
        level="prefectural"
        onBack={vi.fn()}
        onStartOfficialMatch={vi.fn()}
        pending={false}
        state={champion}
        trainingCompleted
      />,
    );

    expect(screen.getAllByText("優勝").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "公式戦を開始" })).toBeNull();
  });

  it("keeps official match progress visibly labeled while submitting", () => {
    const state = dueState();

    render(
      <TournamentScreen
        circuit="interhigh"
        level="prefectural"
        onBack={vi.fn()}
        onStartOfficialMatch={vi.fn()}
        pending
        state={state}
        trainingCompleted
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "公式戦を開始しています…",
    );
    expect(
      screen.getByRole("button", { name: "公式戦を開始しています…" }),
    ).toBeDisabled();
  });
});
