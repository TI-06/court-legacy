import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { simulateMatch } from "../../../../src/domain/match/simulateMatch";
import { matchId } from "../../../../src/domain/model/identifiers";
import type { TrainingResultNotification } from "../../../../src/domain/notifications/gameNotifications";
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
    onOpenSchool: vi.fn(),
    onAcceptPracticeOffer: vi.fn(),
    onDeclinePracticeOffer: vi.fn(),
    operationPending: false,
    onOpenTeam: vi.fn(),
    onOpenMatch: vi.fn(),
    onOpenOfficialTournament: vi.fn(),
    onAdvanceWeek: vi.fn(),
    onMarkNotificationRead: vi.fn(),
  };
}

function trainingNotification(
  props: ReturnType<typeof createProps>,
  id: string,
  menuName: string,
  read: boolean,
): TrainingResultNotification {
  return {
    id,
    type: "training-result",
    createdGameDate: props.state.date,
    academicYearIndex: props.state.yearIndex,
    weekOfYear: props.state.calendar.weekOfYear,
    readAtGameDate: read ? props.state.date : null,
    payload: {
      teamTrainingMenuName: menuName,
      totalAbilityGrowth: 8,
      totalFatigueChange: 12,
      injuredCount: 0,
      players: [],
    },
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
    expect(within(teamStatus).getByText("調子")).toBeVisible();
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
    expect(screen.getByText("1回戦")).toBeVisible();
    expect(screen.getByTitle("城南商業")).toHaveTextContent("城南");

    fireEvent.click(screen.getByRole("button", { name: "大会表を見る" }));
    expect(props.onOpenOfficialTournament).toHaveBeenCalledOnce();
  });

  it("shows both team strengths and keeps direct weekly actions available", () => {
    const props = createProps();
    const opponentStrength = calculateSelectionStrength(
      props.state,
      autoSelectTeam({ state: props.state, schoolId: props.opponent.id }),
    );

    render(<HomeScreen {...props} />);

    expect(
      screen.getByRole("heading", { name: "4/1・第1週" }),
    ).toBeInTheDocument();
    expect(screen.getByTitle(props.opponent.name)).toHaveTextContent(
      props.opponent.shortName,
    );

    const strength = screen.getByLabelText("対戦戦力");
    const homeStrengthLabel = within(strength).getByText("自校戦力");
    const homeStrengthBlock = homeStrengthLabel.closest<HTMLElement>(
      ".home-week-card__strength",
    );
    expect(homeStrengthBlock).not.toBeNull();
    expect(
      within(homeStrengthBlock!).getByText(String(props.homeStrength)),
    ).toBeVisible();

    const opponentStrengthLabel = within(strength).getByText("相手戦力");
    const opponentStrengthBlock = opponentStrengthLabel.closest<HTMLElement>(
      ".home-week-card__strength",
    );
    expect(opponentStrengthBlock).not.toBeNull();
    expect(
      within(opponentStrengthBlock!).getByText(String(opponentStrength)),
    ).toBeVisible();
    expect(screen.getByText("無名校")).toBeInTheDocument();

    const progress = screen.getByLabelText("今週の進行状況");
    expect(within(progress).getByText("設定済")).toBeVisible();
    expect(within(progress).getByText("未決定")).toBeVisible();

    const nextWeek = screen.getByRole("button", { name: "次の週へ進む" });
    expect(nextWeek).toBeEnabled();
    fireEvent.click(nextWeek);

    fireEvent.click(screen.getByRole("button", { name: /学校を確認/ }));
    fireEvent.click(screen.getByRole("button", { name: /選手を確認/ }));
    fireEvent.click(screen.getByRole("button", { name: /練習試合へ/ }));

    expect(props.onAdvanceWeek).toHaveBeenCalledOnce();
    expect(props.onOpenSchool).toHaveBeenCalledOnce();
    expect(props.onOpenTeam).toHaveBeenCalledOnce();
    expect(props.onOpenMatch).toHaveBeenCalledOnce();

    const decline = screen.getByRole("button", { name: "断る" });
    expect(decline).toHaveClass("home-practice-offer__decline");
    fireEvent.click(screen.getByRole("button", { name: "受ける" }));
    fireEvent.click(decline);
    expect(props.onAcceptPracticeOffer).toHaveBeenCalledOnce();
    expect(props.onDeclinePracticeOffer).toHaveBeenCalledOnce();
  });

  it("shows only the latest training notification", () => {
    const props = createProps();
    const oldRead = trainingNotification(props, "old-read", "旧練習", true);
    const unread = trainingNotification(props, "unread", "未読練習", false);
    const newestRead = trainingNotification(
      props,
      "newest-read",
      "最新練習",
      true,
    );
    props.state.notifications.items = [oldRead, unread, newestRead];

    render(<HomeScreen {...props} />);

    const rows = screen.getAllByRole("button", { name: /今週の練習結果/ });
    expect(rows).toHaveLength(1);
    expect(screen.getByText("最新練習")).toBeVisible();
    expect(screen.queryByText("未読練習")).toBeNull();
    expect(screen.queryByText("旧練習")).toBeNull();
    expect(screen.queryByText("NEW")).toBeNull();
  });

  it("opens an unread training notification and requests its read state after opening", () => {
    const props = createProps();
    const notification = trainingNotification(
      props,
      "training-unread",
      "スパイク練習",
      false,
    );
    props.state.notifications.items = [notification];

    render(<HomeScreen {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /今週の練習結果/ }));

    expect(
      screen.getByRole("dialog", { name: "今週の練習結果" }),
    ).toBeVisible();
    expect(props.onMarkNotificationRead).toHaveBeenCalledWith(notification.id);
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
