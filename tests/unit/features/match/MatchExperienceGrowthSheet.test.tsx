import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import type { MatchExperienceNotification } from "../../../../src/domain/notifications/gameNotifications";
import { matchId, playerId } from "../../../../src/domain/model/identifiers";
import { MatchExperienceGrowthSheet } from "../../../../src/features/match/MatchExperienceGrowthSheet";

describe("Phase46 match experience growth sheet", () => {
  it("shows exact numeric and grade changes after a match", () => {
    const notification: MatchExperienceNotification = {
      id: "match-experience:test-match",
      type: "match-experience",
      matchId: matchId("test-match"),
      createdGameDate: "2026-09-28",
      academicYearIndex: 1,
      weekOfYear: 10,
      readAtGameDate: null,
      payload: {
        players: [
          {
            playerId: playerId("player-1"),
            displayName: "山田 太郎",
            grade: 2,
            preferredPosition: "OH",
            abilityProgress: [
              {
                ability: "spike",
                before: 69,
                beforeGrade: "C",
                after: 70,
                afterGrade: "B",
                change: 1,
              },
              {
                ability: "decision",
                before: 61,
                beforeGrade: "C",
                after: 63,
                afterGrade: "C",
                change: 2,
              },
            ],
          },
        ],
      },
    };

    render(
      <MatchExperienceGrowthSheet
        notification={notification}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "試合後の成長" });
    expect(within(dialog).getByText("山田 太郎")).toBeVisible();
    expect(within(dialog).getByText("69 C")).toBeVisible();
    expect(within(dialog).getByText("70 B")).toBeVisible();
    expect(within(dialog).getByText("+1")).toBeVisible();
    expect(within(dialog).getByText("61 C")).toBeVisible();
    expect(within(dialog).getByText("63 C")).toBeVisible();
    expect(within(dialog).getByText("+2")).toBeVisible();
  });
});
