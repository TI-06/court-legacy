import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { eventId } from "../../../../src/domain/model/identifiers";
import { EventDialog } from "../../../../src/features/home/EventDialog";

describe("EventDialog", () => {
  it("shows the involved players with their assembled characters", () => {
    const state = createDemoGame();
    const actor = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.pendingEvent = {
      eventId: eventId("event.first-position-request"),
      actorPlayerIds: [actor],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: ["try", "stay"],
      chainId: null,
      chainStage: null,
    };

    render(<EventDialog data={gameData} onChoose={vi.fn()} state={state} />);

    const player = state.players[actor]!;
    expect(screen.getByText(`${player.lastName} ${player.firstName}`)).toBeVisible();
    expect(screen.getAllByTestId("player-character")).toHaveLength(1);
  });
});
