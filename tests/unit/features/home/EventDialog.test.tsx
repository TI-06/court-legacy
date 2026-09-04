import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { resolveEventChoice } from "../../../../src/domain/events/resolveEventChoice";
import { eventId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
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

  it("shows the concrete result immediately after the coach selects a response", async () => {
    const { state, player } = rivalActor();
    state.pendingEvent = {
      eventId: eventId("event.first-position-request"),
      actorPlayerIds: [player.id],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: ["try", "stay"],
      chainId: null,
      chainStage: null,
    };

    let currentState = state;
    let rerenderView: ReturnType<typeof render>["rerender"];
    const onChoose = vi.fn(async (choiceId: string) => {
      currentState = resolveEventChoice(
        currentState,
        choiceId,
        gameData,
        new SeededRandom("event-dialog-result"),
      ).state;
      rerenderView(
        <EventDialog data={gameData} onChoose={onChoose} state={currentState} />,
      );
    });
    const view = render(
      <EventDialog data={gameData} onChoose={onChoose} state={currentState} />,
    );
    rerenderView = view.rerender;

    const choices = within(screen.getByLabelText("対応を選択")).getAllByRole(
      "button",
    );
    fireEvent.click(choices[0]!);

    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "対応結果" })).toBeVisible(),
    );
    expect(screen.getByText("選んだ対応")).toBeVisible();
    expect(screen.getByRole("region", { name: "対応による変化" })).toBeVisible();
    expect(screen.getByRole("button", { name: "結果を確認した" })).toBeVisible();
    expect(currentState.eventMemory.history.at(-1)?.visibleResultCodes.length).toBeGreaterThan(0);
  });
});
