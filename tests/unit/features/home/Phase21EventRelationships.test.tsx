import { render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import { eventId } from "../../../../src/domain/model/identifiers";
import { addSpecialRelationship } from "../../../../src/domain/relationships/specialRelationships";
import { EventDialog } from "../../../../src/features/home/EventDialog";

describe("Phase21 fullscreen event relationships", () => {
  it("shows the current affinity label and special tags for a two-player event", () => {
    let state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const [left, right] = school.playerIds;
    if (!left || !right) throw new Error("players missing");
    state.playerRelationships[relationshipKey(left, right)] = 74;
    state = addSpecialRelationship(state, {
      playerIds: [left, right],
      kind: "rival",
      establishedDate: state.date,
    }).state;
    state.pendingEvent = {
      eventId: eventId("event.position-rivalry"),
      actorPlayerIds: [left, right],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: ["competition", "cooperate"],
      chainId: null,
      chainStage: null,
    };

    render(<EventDialog data={gameData} onChoose={vi.fn()} state={state} />);

    const region = screen.getByRole("region", { name: "選手間の関係" });
    expect(within(region).getByText("好相性")).toBeVisible();
    expect(within(region).getByText("ライバル")).toBeVisible();
    expect(
      within(region).getByRole("meter", { name: "関係値 74" }),
    ).toHaveAttribute("aria-valuenow", "74");
  });

  it("does not show a relationship badge for one-player events", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    state.pendingEvent = {
      eventId: eventId("event.first-position-request"),
      actorPlayerIds: [playerId],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: ["try", "stay"],
      chainId: null,
      chainStage: null,
    };

    render(<EventDialog data={gameData} onChoose={vi.fn()} state={state} />);

    expect(screen.queryByRole("region", { name: "選手間の関係" })).toBeNull();
  });
});
