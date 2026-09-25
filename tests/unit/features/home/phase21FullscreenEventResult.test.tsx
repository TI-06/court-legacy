import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { resolveEventChoice } from "../../../../src/domain/events/resolveEventChoice";
import { eventId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { EventDialog } from "../../../../src/features/home/EventDialog";

function eventState() {
  const state = createDemoGame();
  const player =
    state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;
  state.settings.reducedMotion = true;
  state.pendingEvent = {
    eventId: eventId("event.first-position-request"),
    actorPlayerIds: [player.id],
    targetSchoolId: null,
    surfacedDate: state.date,
    choiceIds: ["try", "stay"],
    chainId: null,
    chainStage: null,
  };
  return state;
}

describe("Phase21 fullscreen event result experience", () => {
  it("keeps the resolved outcome fullscreen and manages focus/background access", async () => {
    let currentState = eventState();
    const rerenderView: {
      current: ReturnType<typeof render>["rerender"] | null;
    } = { current: null };
    const onChoose = vi.fn(async (choiceId: string) => {
      currentState = resolveEventChoice(
        currentState,
        choiceId,
        gameData,
        new SeededRandom("phase21-fullscreen-result"),
      ).state;
      rerenderView.current?.(
        <EventDialog
          data={gameData}
          onChoose={onChoose}
          state={currentState}
        />,
      );
    });

    const view = render(
      <EventDialog data={gameData} onChoose={onChoose} state={currentState} />,
    );
    rerenderView.current = view.rerender;

    const choiceSurface = screen.getByTestId("fullscreen-event");
    expect(choiceSurface).toHaveClass("fullscreen-event--reduced-motion");
    const firstChoice = within(
      screen.getByLabelText("対応を選択"),
    ).getAllByRole("button")[0]!;
    await waitFor(() => expect(firstChoice).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(firstChoice);

    await waitFor(() =>
      expect(screen.getByTestId("fullscreen-event")).toHaveAttribute(
        "data-phase",
        "result",
      ),
    );
    expect(screen.getByRole("dialog", { name: "対応結果" })).toBeVisible();
    expect(screen.queryByText("選んだ対応")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "対応による変化" }),
    ).toBeVisible();
    expect(view.container.querySelector(".ui-bottom-sheet")).toBeNull();

    const confirm = screen.getByRole("button", { name: "結果を確認した" });
    await waitFor(() => expect(confirm).toHaveFocus());
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(screen.queryByTestId("fullscreen-event")).toBeNull(),
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("highlights special ability tips, acquisition, and recovery in event results", async () => {
    const state = eventState();
    const pending = state.pendingEvent!;
    const resolved = structuredClone(state);
    resolved.pendingEvent = null;
    resolved.eventMemory.history = [
      {
        eventId: pending.eventId,
        date: state.date,
        actorPlayerIds: [...pending.actorPlayerIds],
        choiceId: "try",
        visibleResultCodes: [
          "コース打ち○ コツ +1",
          "サーブ職人 習得",
          "サーブ不安定 克服",
          "mental +2",
        ],
      },
    ];

    const rerenderView: {
      current: ReturnType<typeof render>["rerender"] | null;
    } = { current: null };
    const onChoose = vi.fn(async () => {
      rerenderView.current?.(
        <EventDialog data={gameData} onChoose={onChoose} state={resolved} />,
      );
    });
    const view = render(
      <EventDialog data={gameData} onChoose={onChoose} state={state} />,
    );
    rerenderView.current = view.rerender;

    fireEvent.click(
      within(screen.getByLabelText("対応を選択")).getAllByRole("button")[0]!,
    );

    const changes = await screen.findByRole("region", {
      name: "対応による変化",
    });
    const tip = within(changes).getByText("コツ").closest("li")!;
    const acquired = within(changes).getByText("習得").closest("li")!;
    const overcome = within(changes).getByText("克服").closest("li")!;

    expect(tip).toHaveAttribute("data-result-kind", "special-tip");
    expect(tip).toHaveTextContent("コース打ち○ +1");
    expect(acquired).toHaveAttribute("data-result-kind", "special-acquired");
    expect(acquired).toHaveTextContent("サーブ職人");
    expect(overcome).toHaveAttribute("data-result-kind", "special-overcome");
    expect(overcome).toHaveTextContent("サーブ不安定");
    expect(within(changes).getByText("メンタル +2")).toBeVisible();
  });

  it("does not present an unrelated occurrence as the selected result", async () => {
    const state = eventState();
    const initialPending = state.pendingEvent!;
    const unrelated = structuredClone(state);
    unrelated.pendingEvent = null;
    unrelated.eventMemory.history = [
      {
        eventId: eventId("event.roommate-tension"),
        date: state.date,
        actorPlayerIds: [...initialPending.actorPlayerIds],
        choiceId: "mediate",
        visibleResultCodes: ["士気 +1"],
      },
    ];

    const rerenderView: {
      current: ReturnType<typeof render>["rerender"] | null;
    } = { current: null };
    const onChoose = vi.fn(async () => {
      rerenderView.current?.(
        <EventDialog data={gameData} onChoose={onChoose} state={unrelated} />,
      );
    });
    const view = render(
      <EventDialog data={gameData} onChoose={onChoose} state={state} />,
    );
    rerenderView.current = view.rerender;

    fireEvent.click(
      within(screen.getByLabelText("対応を選択")).getAllByRole("button")[0]!,
    );

    await waitFor(() =>
      expect(screen.queryByTestId("fullscreen-event")).toBeNull(),
    );
    expect(screen.queryByRole("dialog", { name: "対応結果" })).toBeNull();
  });
});
