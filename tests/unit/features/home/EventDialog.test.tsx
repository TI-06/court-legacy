import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { eventId } from "../../../../src/domain/model/identifiers";
import { EventDialog } from "../../../../src/features/home/EventDialog";

function featuredRivalActor() {
  const state = createDemoGame();
  const school = Object.values(state.schools).find(
    (candidate) => candidate.name === "烏峰高校",
  );
  if (!school) {
    throw new Error("烏峰高校 must exist");
  }
  const player = school.playerIds
    .map((id) => state.players[id])
    .find(
      (candidate) =>
        candidate &&
        `${candidate.lastName} ${candidate.firstName}` === "黒羽 隼斗",
    );
  if (!player) {
    throw new Error("黒羽 隼斗 must exist");
  }
  return { state, school, player };
}

describe("EventDialog", () => {
  it("shows the involved rival using his own school identity", () => {
    const { state, school, player } = featuredRivalActor();
    state.pendingEvent = {
      eventId: eventId("event.first-position-request"),
      actorPlayerIds: [player.id],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: ["try", "stay"],
      chainId: null,
      chainStage: null,
    };

    render(<EventDialog data={gameData} onChoose={vi.fn()} state={state} />);

    const actorCard = screen
      .getByText(`${player.lastName} ${player.firstName}`)
      .closest("article");
    expect(actorCard).not.toBeNull();
    expect(within(actorCard!).getByText(school.name)).toBeVisible();
    expect(within(actorCard!).getByText("閃光のエース")).toBeVisible();
    expect(within(actorCard!).getByTestId("player-character")).toHaveAttribute(
      "data-character-id",
      "kuroba-hayato",
    );

    const emblems = within(actorCard!).getAllByTestId("school-emblem");
    expect(emblems).toHaveLength(2);
    for (const emblem of emblems) {
      expect(emblem).toHaveAttribute("data-school-motif", "wing");
    }
  });
});
