import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { HomeScreen } from "../../../../src/features/home/HomeScreen";

describe("Phase21 Home relationship notice", () => {
  it("shows the compact notice and acknowledges it without opening a fullscreen event", () => {
    const state = createDemoGame();
    state.weeklySchedule.practiceMatch.incomingOffer = null;
    const school = state.schools[state.userSchoolId]!;
    const [left, right] = school.playerIds;
    if (!left || !right) throw new Error("players missing");
    const leftPlayer = state.players[left]!;
    const rightPlayer = state.players[right]!;
    state.notifications.items = [
      {
        id: "special-relationship:fixture",
        type: "special-relationship",
        createdGameDate: state.date,
        academicYearIndex: state.yearIndex,
        weekOfYear: state.calendar.weekOfYear,
        readAtGameDate: null,
        payload: {
          action: "established",
          kind: "partner",
          kindLabel: "相棒",
          playerIds: [left, right].sort(),
          displayNames: [
            `${leftPlayer.lastName} ${leftPlayer.firstName}`,
            `${rightPlayer.lastName} ${rightPlayer.firstName}`,
          ],
        },
      } as never,
    ];
    const onMarkNotificationRead = vi.fn();

    render(
      <HomeScreen
        state={state}
        data={gameData}
        homeStrength={8120}
        onAdvanceWeek={vi.fn()}
        onMarkNotificationRead={onMarkNotificationRead}
      />,
    );

    expect(screen.getByText("相棒関係が成立")).toBeVisible();
    expect(
      screen.getByText(
        `${leftPlayer.lastName} ${leftPlayer.firstName} × ${rightPlayer.lastName} ${rightPlayer.firstName}`,
      ),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /相棒関係が成立/ }));

    expect(onMarkNotificationRead).toHaveBeenCalledWith(
      "special-relationship:fixture",
    );
    expect(screen.queryByTestId("fullscreen-event")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
