import { fireEvent, render, screen, within } from "@testing-library/react";
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
    onOpenOfficialTournament: vi.fn(),
    onAdvanceWeek: vi.fn(),
  };
}

describe("home action dashboard", () => {
  it("renders the information-first dashboard without a featured-player hero", () => {
    const props = createProps();
    props.state.teamDynamics = {
      ...props.state.teamDynamics,
      cohesion: 68,
      cohesionTrend: "rising",
    };

    const { container } = render(<HomeScreen {...props} />);

    expect(screen.queryByRole("region", { name: "チームフェイス" })).toBeNull();
    expect(container.querySelector("img")).toBeNull();

    const teamStatus = screen.getByRole("region", { name: "チーム状況" });
    expect(within(teamStatus).getByText("評判")).toBeVisible();
    expect(within(teamStatus).getByText("疲労")).toBeVisible();
    expect(within(teamStatus).getByText("部員")).toBeVisible();
    expect(within(teamStatus).getByText("結束")).toBeVisible();
    expect(within(teamStatus).getByText("68")).toBeVisible();
    expect(within(teamStatus).getByText("上向き")).toBeVisible();
  });

  it("shows the next official tournament card and opens its bracket", () => {
    const props = createProps();

    render(<HomeScreen {...props} />);

    expect(
      screen.getByRole("heading", { name: "インターハイ 県大会" }),
    ).toBeVisible();
    expect(screen.getByText("あと8週")).toBeVisible();
    expect(screen.getByText("9週目")).toBeVisible();
    expect(screen.getByText("開幕")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "大会表を見る" }));
    expect(props.onOpenOfficialTournament).toHaveBeenCalledOnce();
  });

  it("shows the current week, selected rival, direct weekly actions, and immediate week advance", () => {
    const props = createProps();

    render(<HomeScreen {...props} />);

    expect(
      screen.getByRole("heading", { name: "4/1・第1週" }),
    ).toBeInTheDocument();
    expect(screen.getByTitle(props.opponent.name)).toHaveTextContent(
      props.opponent.shortName,
    );

    const strength = screen.getByText("自校戦力").closest("div");
    expect(strength).not.toBeNull();
    expect(within(strength!).getByText(String(props.homeStrength))).toBeVisible();
    expect(screen.getByText("無名校")).toBeInTheDocument();

    const progress = screen.getByLabelText("今週の進行状況");
    expect(within(progress).getByText("設定済")).toBeVisible();
    expect(within(progress).getByText("未決定")).toBeVisible();

    const nextWeek = screen.getByRole("button", { name: "次の週へ進む" });
    expect(nextWeek).toBeEnabled();
    fireEvent.click(nextWeek);

    fireEvent.click(screen.getByRole("button", { name: /育成を決める/ }));
    fireEvent.click(screen.getByRole("button", { name: /チーム編成を確認/ }));
    fireEvent.click(screen.getByRole("button", { name: /練習試合へ/ }));

    expect(props.onAdvanceWeek).toHaveBeenCalledOnce();
    expect(props.onOpenTraining).toHaveBeenCalledOnce();
    expect(props.onOpenTeam).toHaveBeenCalledOnce();
    expect(props.onOpenMatch).toHaveBeenCalledOnce();
  });

  it("keeps the next week action enabled after training resolves", () => {
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

    const recent = screen.getByRole("region", { name: "最近の状況" });
    expect(recent).toHaveTextContent(`${winner.shortName}勝利`);
    expect(recent).toHaveTextContent(
      `${props.latestMatch!.match.homeSetsWon} - ${props.latestMatch!.match.awaySetsWon}`,
    );
  });
});
