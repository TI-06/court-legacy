import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { eventId } from "../../../../src/domain/model/identifiers";
import { EventDialog } from "../../../../src/features/home/EventDialog";

function rivalActor() {
  const state = createDemoGame();
  const school = Object.values(state.schools).find(
    (candidate) => candidate.id !== state.userSchoolId,
  );
  if (!school) {
    throw new Error("a rival school must exist");
  }
  const player = school.playerIds
    .map((id) => state.players[id])
    .find((candidate) => Boolean(candidate));
  if (!player) {
    throw new Error("the rival school must have a player");
  }
  return { state, school, player };
}

describe("EventDialog", () => {
  it("shows the involved rival using his own school identity without portrait art", () => {
    const { state, school, player } = rivalActor();
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

    const actorCard = screen
      .getByText(`${player.lastName} ${player.firstName}`)
      .closest("article");
    expect(actorCard).not.toBeNull();
    const actor = within(actorCard!);
    expect(actor.getByText(school.name)).toBeVisible();
    expect(
      actor.getByText(`${player.grade}年・${player.preferredPosition}`),
    ).toBeVisible();
    expect(container.querySelector("img")).toBeNull();

    const emblems = actor.getAllByTestId("school-emblem");
    expect(emblems).toHaveLength(1);
    expect(emblems[0]).toHaveAttribute("data-school-motif", "shield");
  });
});
