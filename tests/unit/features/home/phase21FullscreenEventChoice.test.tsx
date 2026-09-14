import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { eventId } from "../../../../src/domain/model/identifiers";
import { EventDialog } from "../../../../src/features/home/EventDialog";

describe("Phase21 fullscreen event choice experience", () => {
  it("uses the full event surface and shows actor personality", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;
    const personality = gameData.personalities.get(player.personalityId)!;
    const event = gameData.events.get(eventId("event.first-position-request"))!;

    state.pendingEvent = {
      eventId: eventId("event.first-position-request"),
      actorPlayerIds: [player.id],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: ["try", "stay"],
      chainId: null,
      chainStage: null,
    };

    const { container } = render(
      <EventDialog data={gameData} onChoose={vi.fn()} state={state} />,
    );

    const dialog = screen.getByRole("dialog", { name: event.title });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("fullscreen-event")).toHaveAttribute(
      "data-phase",
      "choice",
    );
    expect(container.querySelector(".ui-bottom-sheet")).toBeNull();
    expect(screen.queryByRole("button", { name: "閉じる" })).toBeNull();

    const actorCard = screen
      .getByText(`${player.lastName} ${player.firstName}`)
      .closest("article");
    expect(actorCard).not.toBeNull();
    expect(within(actorCard!).getByText(personality.name)).toBeVisible();
    expect(
      within(screen.getByLabelText("対応を選択")).getAllByRole("button"),
    ).toHaveLength(2);
  });
});
