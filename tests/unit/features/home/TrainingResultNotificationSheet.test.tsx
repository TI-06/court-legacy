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

    const dialog = screen.getByRole("dialog", { name: "今週の練習結果" });
    expect(within(dialog).getByText("スパイク練習")).toBeVisible();
    expect(within(dialog).getByText(player.displayName)).toBeVisible();
    expect(
      within(dialog).getByText(`${player.grade}年・${player.preferredPosition}`),
    ).toBeVisible();
    expect(within(dialog).getByText("スパイク +2")).toBeVisible();
    expect(within(dialog).getByText("ジャンプ +1")).toBeVisible();
    expect(within(dialog).getByText("疲労 +5")).toBeVisible();
    expect(within(dialog).getByText("コンディション -1")).toBeVisible();
    expect(within(dialog).getByText("信頼 +2")).toBeVisible();
    expect(within(dialog).getByText("怪我あり")).toBeVisible();
  });
});
