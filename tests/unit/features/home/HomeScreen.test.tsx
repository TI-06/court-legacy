import { fireEvent, render, screen } from "@testing-library/react";
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
import { HomeScreen } from "../../../../src/features/home/HomeScreen";

function createProps(withLatestMatch = false) {
  const state = createDemoGame();
  const opponent = selectPracticeOpponent(state);
  const homeSelection = autoSelectTeam({
    state,
    schoolId: state.userSchoolId,
  });
  const awaySelection = autoSelectTeam({ state, schoolId: opponent.id });
  const latestMatch = withLatestMatch
    ? simulateMatch({
        state,
        id: matchId("home-latest-match"),
        homeSchoolId: state.userSchoolId,
        awaySchoolId: opponent.id,
        homeSelection,
        awaySelection,
        bestOfSets: 3,
        random: new SeededRandom("home-latest-match"),
      })
    : null;

  return {
    state,
    opponent,
    latestMatch,
    homeStrength: calculateSelectionStrength(state, homeSelection),
    trainingCompleted: false,
    practiceMatchCompleted: false,
    onOpenTraining: vi.fn(),
    onOpenTeam: vi.fn(),
    onOpenMatch: vi.fn(),
    onAdvanceWeek: vi.fn(),
  };
}

describe("home action dashboard", () => {
  it("shows the real date, selected rival, and direct weekly actions", () => {
    const props = createProps();

    render(<HomeScreen {...props} />);

    expect(
      screen.getByRole("heading", { name: "監督ホーム" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2026年4月1日")).toBeInTheDocument();
    expect(screen.getByText(props.opponent.name)).toBeInTheDocument();
    expect(screen.getByText(`戦力 ${props.homeStrength}`)).toBeInTheDocument();
    expect(screen.getByText("無名校")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次の週へ進む" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /育成を決める/ }));
    fireEvent.click(screen.getByRole("button", { name: /チーム編成を確認/ }));
    fireEvent.click(screen.getByRole("button", { name: /練習試合へ/ }));

    expect(props.onOpenTraining).toHaveBeenCalledOnce();
    expect(props.onOpenTeam).toHaveBeenCalledOnce();
    expect(props.onOpenMatch).toHaveBeenCalledOnce();
  });

  it("enables the next week action after training", () => {
    const props = createProps();
    props.trainingCompleted = true;

    render(<HomeScreen {...props} />);

    const nextWeek = screen.getByRole("button", { name: "次の週へ進む" });
    expect(nextWeek).toBeEnabled();
    fireEvent.click(nextWeek);
    expect(props.onAdvanceWeek).toHaveBeenCalledOnce();
  });

  it("shows the latest completed match result when one exists", () => {
    const props = createProps(true);
    const winner =
      props.state.schools[props.latestMatch!.analysis.winnerSchoolId]!;

    render(<HomeScreen {...props} />);

    expect(
      screen.getByRole("heading", { name: "直近の試合" }),
    ).toBeInTheDocument();
    expect(screen.getByText(`${winner.name} 勝利`)).toBeInTheDocument();
    expect(
      screen.getByText(
        `${props.latestMatch!.match.homeSetsWon} - ${props.latestMatch!.match.awaySetsWon}`,
      ),
    ).toBeInTheDocument();
  });
});
