import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import {
  buildCharacterTraitDiscoveredNotification,
  type DevelopmentGoalAchievementNotification,
  type SeasonGoalAchievementNotification,
  type TrainingResultNotification,
} from "../../../../src/domain/notifications/gameNotifications";
import { HomeScreen } from "../../../../src/features/home/HomeScreen";

function createProps(state = createDemoGame()) {
  state.weeklySchedule.practiceMatch.incomingOffer = null;
  return {
    state,
    data: gameData,
    homeStrength: 8120,
    onCommand: vi.fn(),
    onAdvanceWeek: vi.fn(),
    onAcceptPracticeOffer: vi.fn(),
    onDeclinePracticeOffer: vi.fn(),
    operationPending: false,
    onMarkNotificationRead: vi.fn(),
  };
}

function otherSchool(state: GameState) {
  const school = Object.values(state.schools).find(
    (candidate) => candidate.id !== state.userSchoolId,
  );
  if (!school) throw new Error("opponent fixture missing");
  return school;
}

function trainingNotification(
  state: GameState,
  read = false,
): TrainingResultNotification {
  const player =
    state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;
  return {
    id: "home-screen-training",
    type: "training-result",
    createdGameDate: state.date,
    academicYearIndex: state.yearIndex,
    weekOfYear: state.calendar.weekOfYear,
    readAtGameDate: read ? state.date : null,
    payload: {
      teamTrainingMenuName: "スパイク練習",
      totalAbilityGrowth: 8,
      totalFatigueChange: 0,
      injuredCount: 0,
      players: [
        {
          playerId: player.id,
          displayName: `${player.lastName} ${player.firstName}`,
          grade: player.grade,
          preferredPosition: player.preferredPosition,
          totalAbilityGrowth: 8,
          fatigueChange: 0,
          conditionChange: 0,
          trustChange: 0,
          injured: false,
          abilityChanges: {},
          socialGrowth: {
            contributions: [],
            rawPercentPoints: 0,
            appliedPercentPoints: 0,
            capped: false,
          },
        },
      ],
    },
  };
}

describe("Phase 13 Home command center", () => {
  it("renders a compact weekly summary, coaching tasks and a sticky week action", () => {
    const props = createProps();
    const { container } = render(<HomeScreen {...props} />);

    expect(screen.getByTestId("home-command-summary")).toBeVisible();
    expect(screen.getByRole("heading", { name: "4/1・第1週" })).toBeVisible();
    expect(screen.getByText("青葉")).toBeVisible();

    const teamStatus = screen.getByRole("region", { name: "チーム状況" });
    expect(within(teamStatus).getByText("戦力")).toBeVisible();
    expect(within(teamStatus).getByText("調子")).toBeVisible();
    expect(within(teamStatus).getByText("結束")).toBeVisible();
    expect(within(teamStatus).queryByText("評判")).toBeNull();
    expect(within(teamStatus).queryByText("部員")).toBeNull();

    expect(screen.getByRole("heading", { name: "今週やること" })).toBeVisible();
    expect(
      screen.getAllByTestId("home-command-task").length,
    ).toBeLessThanOrEqual(5);
    expect(screen.getByRole("button", { name: "今週を進める" })).toBeVisible();
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps the official objective compact and emits the tournament command", () => {
    const props = createProps();
    render(<HomeScreen {...props} />);

    expect(screen.getByText("次の公式戦")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "大会表を見る" }));
    expect(props.onCommand).toHaveBeenCalledWith({ target: "tournament" });
  });

  it("shows the season goal and links directly to school records", () => {
    const props = createProps();
    const regionalGoal = props.state.seasonGoals!.goals.find(
      (goal) => goal.kind === "regional-rank",
    )!;
    render(<HomeScreen {...props} />);

    const season = screen.getByRole("region", { name: "今季目標" });
    expect(
      within(season).getByText(`県内${regionalGoal.target}位以内`),
    ).toBeVisible();
    expect(within(season).getByText("県内")).toBeVisible();
    expect(within(season).getByText("全国")).toBeVisible();

    fireEvent.click(
      within(season).getByRole("button", { name: "今季の記録を見る" }),
    );
    expect(props.onCommand).toHaveBeenCalledWith({
      target: "school",
      view: "records",
    });
  });

  it("opens school records from the compact featured-rival strip", () => {
    const props = createProps();
    const opponent = otherSchool(props.state);
    props.state.world.destinyRivalSchoolId = opponent.id;
    props.state.history.matches = [
      {
        matchId: "home-featured-rival" as never,
        date: "2026-04-10" as never,
        homeSchoolId: props.state.userSchoolId,
        awaySchoolId: opponent.id,
        winnerSchoolId: opponent.id,
        homeSetsWon: 1,
        awaySetsWon: 2,
        tournamentId: null,
      },
    ];

    render(<HomeScreen {...props} />);

    const rival = screen.getByRole("button", {
      name: `注目ライバル ${opponent.shortName} 0勝1敗`,
    });
    expect(rival).toHaveTextContent("宿敵");
    expect(rival).toHaveTextContent("前回敗戦・次は雪辱");

    fireEvent.click(rival);
    expect(props.onCommand).toHaveBeenCalledWith({
      target: "school",
      view: "records",
    });
  });

  it("emits a team command when individual training is unconfigured", () => {
    const props = createProps();
    const school = props.state.schools[props.state.userSchoolId]!;
    const unconfiguredPlayerId = school.playerIds.at(-1)!;
    props.state.weeklySchedule.trainingPlan.individualAssignments =
      props.state.weeklySchedule.trainingPlan.individualAssignments.filter(
        (assignment) => assignment.playerId !== unconfiguredPlayerId,
      );
    render(<HomeScreen {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /個人練習を設定/ }));
    expect(props.onCommand).toHaveBeenCalledWith({ target: "team" });
  });

  it("shows explicit practice-offer controls and warns before discarding the offer", () => {
    const state = createDemoGame();
    const opponent = otherSchool(state);
    state.weeklySchedule.practiceMatch = {
      ...state.weeklySchedule.practiceMatch,
      incomingOffer: {
        schoolId: opponent.id,
        growthRating: 4,
        loadRating: 3,
      },
      scheduledOpponentId: null,
      scheduledBy: null,
    };
    const props = createProps(state);
    props.state.weeklySchedule.practiceMatch.incomingOffer = {
      schoolId: opponent.id,
      growthRating: 4,
      loadRating: 3,
    };

    render(<HomeScreen {...props} />);

    const offer = screen.getByRole("article", {
      name: "練習試合の申し込み",
    });
    fireEvent.click(within(offer).getByRole("button", { name: "受ける" }));
    fireEvent.click(within(offer).getByRole("button", { name: "断る" }));
    expect(props.onAcceptPracticeOffer).toHaveBeenCalledOnce();
    expect(props.onDeclinePracticeOffer).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "今週を進める" }));
    expect(props.onAdvanceWeek).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", {
      name: "未回答の申し込みがあります",
    });
    expect(dialog).toHaveTextContent("このまま次週へ進みますか");

    fireEvent.click(within(dialog).getByRole("button", { name: "戻る" }));
    expect(
      screen.queryByRole("dialog", { name: "未回答の申し込みがあります" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "今週を進める" }));
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "未回答の申し込みがあります" }),
      ).getByRole("button", { name: "そのまま進む" }),
    );
    expect(props.onAdvanceWeek).toHaveBeenCalledOnce();
  });

  it("advances immediately when no expiring practice offer exists", () => {
    const props = createProps();
    render(<HomeScreen {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "今週を進める" }));
    expect(props.onAdvanceWeek).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("dialog", { name: "未回答の申し込みがあります" }),
    ).toBeNull();
  });

  it("opens the newest training result and marks an unread notification read", () => {
    const props = createProps();
    const notification = trainingNotification(props.state);
    props.state.notifications.items = [notification];
    render(<HomeScreen {...props} />);

    expect(
      screen.getAllByTestId("home-command-news").length,
    ).toBeLessThanOrEqual(3);
    fireEvent.click(
      screen.getByRole("button", { name: /今週の練習結果 スパイク練習/ }),
    );

    expect(
      screen.getByRole("dialog", { name: "今週の練習結果" }),
    ).toBeVisible();
    expect(props.onMarkNotificationRead).toHaveBeenCalledWith(notification.id);
  });

  it("promotes a training rank-up in Home news and the result sheet", () => {
    const props = createProps();
    const notification = trainingNotification(props.state);
    notification.payload.players[0]!.rankUps = [
      {
        area: "jump",
        areaLabel: "跳躍",
        fromGrade: "E",
        toGrade: "D",
      },
    ];
    props.state.notifications.items = [notification];

    render(<HomeScreen {...props} />);

    expect(screen.getByText("NEW 能力ランクアップ！")).toBeVisible();
    expect(screen.getByText(/跳躍 E→D/)).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: /今週の練習結果 スパイク練習/ }),
    );

    const dialog = screen.getByRole("dialog", { name: "今週の練習結果" });
    expect(
      within(dialog).getByRole("region", { name: "能力ランクアップ" }),
    ).toBeVisible();
  });

  it("opens season goal achievement news, marks it read, and jumps to school records", () => {
    const props = createProps();
    const notification: SeasonGoalAchievementNotification = {
      id: "season-goal-achieved:home",
      type: "season-goal-achieved",
      createdGameDate: props.state.date,
      academicYearIndex: props.state.yearIndex,
      weekOfYear: props.state.calendar.weekOfYear,
      readAtGameDate: null,
      payload: {
        items: [
          {
            goalId: "season:1:official-wins",
            label: "公式戦2勝",
            rewardFunds: 100,
          },
        ],
        totalRewardFunds: 100,
      },
    };
    props.state.notifications.items = [notification];

    render(<HomeScreen {...props} />);

    expect(screen.getByText("NEW シーズン目標達成！")).toBeVisible();
    expect(screen.getByText("公式戦2勝・年度末 +100")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", {
        name: /シーズン目標達成！/,
      }),
    );

    expect(props.onMarkNotificationRead).toHaveBeenCalledWith(notification.id);
    expect(props.onCommand).toHaveBeenCalledWith({
      target: "school",
      view: "records",
    });
  });

  it("opens development goal achievements and deep-links to the player's growth tab", () => {
    const props = createProps();
    const playerId =
      props.state.schools[props.state.userSchoolId]!.playerIds[0]!;
    const player = props.state.players[playerId]!;
    const notification: DevelopmentGoalAchievementNotification = {
      id: "development-goal-achieved:home",
      type: "development-goal-achieved",
      createdGameDate: props.state.date,
      academicYearIndex: props.state.yearIndex,
      weekOfYear: props.state.calendar.weekOfYear,
      readAtGameDate: null,
      payload: {
        items: [
          {
            playerId,
            displayName: `${player.lastName} ${player.firstName}`,
            area: "jump",
            areaLabel: "跳躍",
            targetGrade: "D",
            achievedGrade: "D",
          },
        ],
      },
    };
    props.state.notifications.items = [notification];

    render(<HomeScreen {...props} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /育成目標達成！/,
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "育成目標達成" });
    expect(dialog).toHaveTextContent("GOAL COMPLETE");
    expect(props.onMarkNotificationRead).toHaveBeenCalledWith(notification.id);

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: `${player.lastName} ${player.firstName}の成長画面を開く`,
      }),
    );

    expect(props.onCommand).toHaveBeenCalledWith({
      target: "player",
      playerId,
      detail: "growth",
    });
  });

  it("shows a compact character trait discovery without opening a fullscreen event", () => {
    const props = createProps();
    const playerId =
      props.state.schools[props.state.userSchoolId]!.playerIds[0]!;
    const notification = buildCharacterTraitDiscoveredNotification(
      props.state,
      { playerId, traitId: "character.training-lover" },
      gameData,
    );
    props.state.notifications.items = [notification];
    render(<HomeScreen {...props} />);
    expect(screen.getByText("新しい個性を発見！")).toBeInTheDocument();
    expect(screen.queryByTestId("fullscreen-event")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /新しい個性を発見！/ }));
    expect(props.onMarkNotificationRead).toHaveBeenCalledWith(notification.id);
  });

  it("disables conflicting actions while an authoritative operation is pending", () => {
    const props = createProps();
    props.operationPending = true;
    render(<HomeScreen {...props} />);

    expect(screen.getByRole("button", { name: "今週を進める" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "大会表を見る" })).toBeDisabled();
  });
});
