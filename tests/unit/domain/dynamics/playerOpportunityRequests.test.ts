import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { derivePlayerOpportunityRequests } from "../../../../src/domain/dynamics/playerOpportunityRequests";
import { eventId } from "../../../../src/domain/model/identifiers";

describe("player opportunity requests", () => {
  it("surfaces playing-time concerns and keeps the strongest concern", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;

    state.teamDynamics.playerConcerns[playerId] = [
      { code: "role-mismatch", severity: 1 },
      { code: "playing-time", severity: 3 },
    ];

    expect(derivePlayerOpportunityRequests(state)).toContainEqual(
      expect.objectContaining({
        playerId,
        kind: "playing-time",
        severity: 3,
        title: "出場機会が欲しい",
      }),
    );
  });

  it("treats a promised appearance as the highest-priority request until the reserve chain resolves", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;

    state.eventMemory.history = [
      {
        eventId: eventId("event.reserve-role-review"),
        date: "2026-5-1",
        actorPlayerIds: [playerId],
        choiceId: "chance",
        visibleResultCodes: [],
      },
    ];

    expect(derivePlayerOpportunityRequests(state)[0]).toEqual(
      expect.objectContaining({
        playerId,
        kind: "promise",
        severity: 3,
        title: "出場機会を約束中",
      }),
    );

    state.eventMemory.history.push({
      eventId: eventId("event.reserve-breakthrough"),
      date: "2026-6-1",
      actorPlayerIds: [playerId],
      choiceId: "role",
      visibleResultCodes: [],
    });

    expect(
      derivePlayerOpportunityRequests(state).some(
        (request) => request.playerId === playerId && request.kind === "promise",
      ),
    ).toBe(false);
  });
});
