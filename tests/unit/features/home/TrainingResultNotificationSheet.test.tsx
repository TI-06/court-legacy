import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { TrainingResultNotification } from "../../../../src/domain/notifications/gameNotifications";
import { TrainingResultNotificationSheet } from "../../../../src/features/home/TrainingResultNotificationSheet";

function createNotification(): TrainingResultNotification {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const player = state.players[school.playerIds[0]!]!;

  return {
    id: "training-result:detail-sheet",
    type: "training-result",
    createdGameDate: state.date,
    academicYearIndex: state.yearIndex,
    weekOfYear: state.calendar.weekOfYear,
    readAtGameDate: null,
    payload: {
      teamTrainingMenuName: "スパイク練習",
      totalAbilityGrowth: 4,
      totalFatigueChange: 5,
      injuredCount: 1,
      players: [
        {
          playerId: player.id,
          displayName: `${player.lastName} ${player.firstName}`,
          grade: player.grade,
          preferredPosition: player.preferredPosition,
          totalAbilityGrowth: 4,
          fatigueChange: 5,
          conditionChange: -1,
          trustChange: 2,
          injured: true,
          abilityChanges: {
            spike: 2,
            jump: 1,
          },
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

describe("TrainingResultNotificationSheet", () => {
  it("shows the team summary and player-level training changes", () => {
    const notification = createNotification();
    const player = notification.payload.players[0]!;

    render(
      <TrainingResultNotificationSheet
        notification={notification}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "今週の練習結果",
    });
    expect(within(dialog).getByText("スパイク練習")).toBeVisible();
    expect(within(dialog).getByText(player.displayName)).toBeVisible();
    expect(
      within(dialog).getByText(
        `${player.grade}年・${player.preferredPosition}`,
      ),
    ).toBeVisible();
    expect(within(dialog).getByText("スパイク +2")).toBeVisible();
    expect(within(dialog).getByText("ジャンプ +1")).toBeVisible();
    expect(within(dialog).getByText("疲労 +5")).toBeVisible();
    expect(within(dialog).getByText("コンディション -1")).toBeVisible();
    expect(within(dialog).getByText("信頼 +2")).toBeVisible();
    expect(within(dialog).getByText("怪我あり")).toBeVisible();
    expect(within(dialog).getByText("能力成長").closest("div")).toHaveAttribute(
      "data-tone",
      "positive",
    );
    expect(within(dialog).getByText("疲労").closest("div")).toHaveAttribute(
      "data-tone",
      "warning",
    );
    expect(within(dialog).getByText("怪我").closest("div")).toHaveAttribute(
      "data-tone",
      "danger",
    );
  });
});

describe("Phase27-2 training rank-up presentation", () => {
  it("celebrates rank-ups above the normal weekly result details", () => {
    const notification = createNotification();
    notification.payload.players[0]!.rankUps = [
      {
        area: "jump",
        areaLabel: "跳躍",
        fromGrade: "E",
        toGrade: "D",
      },
    ];

    render(
      <TrainingResultNotificationSheet
        notification={notification}
        onClose={vi.fn()}
      />,
    );

    const rankUps = screen.getByRole("region", { name: "能力ランクアップ" });
    expect(within(rankUps).getByText("RANK UP")).toBeVisible();
    expect(within(rankUps).getByText("跳躍")).toBeVisible();
    expect(within(rankUps).getByText(/E/)).toBeVisible();
    expect(within(rankUps).getByText(/D/)).toBeVisible();
  });
});

describe("Phase21 social growth presentation", () => {
  it("shows contributor chips and the capped applied value", () => {
    const notification = createNotification();
    const player = notification.payload.players[0]!;
    const state = createDemoGame();
    const relatedPlayerId = state.schools[state.userSchoolId]!.playerIds[1]!;
    player.socialGrowth = {
      contributions: [
        {
          code: "relationship-partner",
          label: "相棒",
          percentPoints: 3,
          relatedPlayerId,
        },
        {
          code: "relationship-mentor",
          label: "師弟",
          percentPoints: 4,
          relatedPlayerId,
        },
      ],
      rawPercentPoints: 7,
      appliedPercentPoints: 5,
      capped: true,
    };
    render(
      <TrainingResultNotificationSheet
        notification={notification}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "今週の練習結果" });
    expect(within(dialog).getByText("相棒 +3%")).toBeVisible();
    expect(within(dialog).getByText("師弟 +4%")).toBeVisible();
    expect(within(dialog).getByText("関係性効果は上限 +5%")).toBeVisible();
  });
});
