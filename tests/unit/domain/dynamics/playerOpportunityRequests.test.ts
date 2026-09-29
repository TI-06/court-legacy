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

  it("distinguishes starter, substitute, and next-match promises", () => {
    const state = createDemoGame();
    const playerIds = state.schools[state.userSchoolId]!.playerIds.slice(0, 3);
    const choices = ["starter", "chance", "next-match"] as const;
    const expectedModes = ["starter", "substitute", "next-match"] as const;

    state.eventMemory.history = choices.map((choiceId, index) => ({
      eventId: eventId("event.reserve-role-review"),
      date: `2026-5-${index + 1}`,
      actorPlayerIds: [playerIds[index]!],
      choiceId,
      visibleResultCodes: [],
    }));

    const requests = derivePlayerOpportunityRequests(state);
    for (let index = 0; index < expectedModes.length; index += 1) {
      expect(requests).toContainEqual(
        expect.objectContaining({
          playerId: playerIds[index],
          kind: "promise",
          promiseMode: expectedModes[index],
        }),
      );
    }
  });

  it("keeps a promised appearance active until an official match settles it", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;

    state.eventMemory.history = [
      {
        eventId: eventId("event.reserve-role-review"),
        date: "2026-5-1",
        actorPlayerIds: [playerId],
        choiceId: "starter",
        visibleResultCodes: [],
      },
    ];

    expect(derivePlayerOpportunityRequests(state)[0]).toEqual(
      expect.objectContaining({
        playerId,
        kind: "promise",
        severity: 3,
        title: "先発起用を約束中",
        promiseMode: "starter",
      }),
    );

    state.eventMemory.history.push({
      eventId: eventId("event.reserve-appearance-promise-result"),
      date: "2026-6-1",
      actorPlayerIds: [playerId],
      choiceId: "fulfilled",
      visibleResultCodes: [],
    });

    expect(
      derivePlayerOpportunityRequests(state).some(
        (request) =>
          request.playerId === playerId && request.kind === "promise",
      ),
    ).toBe(false);
  });
});
