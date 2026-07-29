import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { selectNextEvent } from "../../../../src/domain/events/selectEvent";
import { eventId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";

describe("event selection", () => {
  it("surfaces a valid due follow-up before weighted normal events", () => {
    const state = createDemoGame();
    const actor = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.eventMemory.scheduledFollowUps = [
      {
        eventId: eventId("event.position-trial-result"),
        eligibleDate: state.date,
        actorPlayerIds: [actor],
        chainId: "position-chain",
        chainStage: 1,
      },
    ];

    const result = selectNextEvent(
      state,
      gameData,
      new SeededRandom(state.seed, state.randomCursor),
    );

    expect(result.pendingEvent?.eventId).toBe(
      eventId("event.position-trial-result"),
    );
    expect(result.pendingEvent?.chainId).toBe("position-chain");
    expect(result.state.eventMemory.scheduledFollowUps).toEqual([]);
  });

  it("drops a due chain when its actor no longer exists", () => {
    const state = createDemoGame();
    const actor = state.schools[state.userSchoolId]!.playerIds[0]!;
    state.eventMemory.scheduledFollowUps = [
      {
        eventId: eventId("event.position-trial-result"),
        eligibleDate: state.date,
        actorPlayerIds: [actor],
        chainId: "invalid-chain",
        chainStage: 1,
      },
    ];
    delete state.players[actor];

    const result = selectNextEvent(
      state,
      gameData,
      new SeededRandom(state.seed, state.randomCursor),
    );

    expect(result.state.eventMemory.scheduledFollowUps).toEqual([]);
    expect(result.pendingEvent?.chainId).not.toBe("invalid-chain");
  });
});
