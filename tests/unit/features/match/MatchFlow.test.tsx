import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { simulateMatch } from "../../../../src/domain/match/simulateMatch";
import { matchId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "../../../../src/domain/selectors/matchSelectors";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import { MatchScreen } from "../../../../src/features/match/MatchScreen";

function createMatchFixture() {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  state.weeklySchedule.practiceMatch.scheduledOpponentId = opponent.id;
  state.weeklySchedule.practiceMatch.scheduledBy = "outgoing";
  const homeSelection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const awaySelection = autoSelectTeam({ state, schoolId: opponent.id });
  const result = simulateMatch({
    state,
    id: matchId("ui-match"),
    homeSchoolId: state.userSchoolId,
    awaySchoolId: opponent.id,
    homeSelection,
    awaySelection,
    bestOfSets: 3,
    random: new SeededRandom("ui-match"),
  });

  return {
    state,
    opponent,
    homeSelection,
    awaySelection,
    homeStrength: calculateSelectionStrength(state, homeSelection),
    awayStrength: calculateSelectionStrength(state, awaySelection),
    result,
  };
}

describe("match flow", () => {
  it("shows Japanese preparation labels and starts a scheduled legal practice match", () => {
    const fixture = createMatchFixture();
    const onStart = vi.fn();

    render(
      <MatchScreen
        {...fixture}
        onReturnHome={vi.fn()}
        onStart={onStart}
        reducedMotion={false}
        result={null}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "練習試合" }),
    ).toBeInTheDocument();
    expect(screen.getByText(fixture.opponent.name)).toBeInTheDocument();

    const homeCard = screen.getByText("自校").closest("article");
    const awayCard = screen.getByText("相手").closest("article");
    expect(homeCard).not.toBeNull();
    expect(awayCard).not.toBeNull();
    expect(
      within(homeCard!).getByText(`戦力 ${fixture.homeStrength}`),
    ).toBeInTheDocument();
    expect(
      within(awayCard!).getByText(`戦力 ${fixture.awayStrength}`),
    ).toBeInTheDocument();
    for (const english of [
      "PRACTICE MATCH",
      "HOME",
      "VS",
      "AWAY",
      "LINEUP CHECK",
    ]) {
      expect(screen.queryByText(english)).toBeNull();
    }

    fireEvent.click(screen.getByRole("button", { name: "試合開始" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("reveals the immutable event log with Japanese headings and can jump to analysis", () => {
    const fixture = createMatchFixture();
    const resultBefore = JSON.stringify(fixture.result);

    render(
      <MatchScreen
        {...fixture}
        onReturnHome={vi.fn()}
        onStart={vi.fn()}
        reducedMotion={false}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "試合ダイジェスト" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("MATCH LIVE")).toBeNull();
    expect(screen.queryByText("PLAY LOG")).toBeNull();
    expect(screen.getByTestId("event-sequence")).toHaveTextContent(
      `1 / ${fixture.result.match.eventLog.length}`,
    );
    expect(screen.getAllByText("セット 0")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "次のプレー" }));
    expect(screen.getByTestId("event-sequence")).toHaveTextContent(
      `2 / ${fixture.result.match.eventLog.length}`,
    );

    fireEvent.click(screen.getByRole("button", { name: "2倍" }));
    expect(screen.getByRole("button", { name: "2倍" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(JSON.stringify(fixture.result)).toBe(resultBefore);

    fireEvent.click(screen.getByRole("button", { name: "結果まで進む" }));

    expect(
      screen.getByRole("heading", { name: "試合結果" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "勝敗を分けた要因" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "次戦への改善提案" }),
    ).toBeInTheDocument();
    for (const english of ["FULL TIME", "MATCH ANALYSIS", "NEXT PLAN"]) {
      expect(screen.queryByText(english)).toBeNull();
    }
    expect(fixture.result.analysis.principalFactors.length).toBeGreaterThan(0);
  });

  it("uses progression presentation names and continues weekly progression", () => {
    const fixture = createMatchFixture();
    const onContinue = vi.fn();
    render(
      <MatchScreen
        {...fixture}
        onReturnHome={onContinue}
        onStart={vi.fn()}
        presentation={{
          kind: "official",
          simulation: fixture.result,
          homeTeam: {
            schoolId: fixture.result.match.homeSchoolId,
            displayName: "青葉高校",
            shortName: "青葉",
          },
          awayTeam: {
            schoolId: fixture.result.match.awaySchoolId,
            displayName: "全国ゲスト代表",
            shortName: "ゲスト",
          },
          official: {
            tournamentId: "official:test",
            circuit: "interhigh",
            level: "national",
            round: "round-of-16",
          },
        }}
        reducedMotion={false}
        result={fixture.result}
      />,
    );
    expect(screen.getByText("ゲスト")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "結果まで進む" }));
    fireEvent.click(screen.getByRole("button", { name: "結果を確認して次へ" }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("plays and pauses without changing the calculated result", () => {
    vi.useFakeTimers();
    const fixture = createMatchFixture();
    const resultBefore = JSON.stringify(fixture.result);

    render(
      <MatchScreen
        {...fixture}
        onReturnHome={vi.fn()}
        onStart={vi.fn()}
        reducedMotion={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "再生" }));
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(screen.getByTestId("event-sequence")).toHaveTextContent(
      `2 / ${fixture.result.match.eventLog.length}`,
    );

    fireEvent.click(screen.getByRole("button", { name: "一時停止" }));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByTestId("event-sequence")).toHaveTextContent(
      `2 / ${fixture.result.match.eventLog.length}`,
    );
    expect(JSON.stringify(fixture.result)).toBe(resultBefore);

    vi.useRealTimers();
  });
});
