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

  it("does not surface referenced follow-up stages as normal events", () => {
    const state = createDemoGame();
    const actor = state.schools[state.userSchoolId]!.playerIds[0]!;
    const baseEvent = gameData.events.get("event.position-trial-result")!;
    const followUpOnlyEvent = {
      ...baseEvent,
      id: "event.follow-up-only-test",
      trigger: {},
    };
    const sourceEvent = {
      ...baseEvent,
      id: "event.follow-up-source-test",
      trigger: {
        schoolReputationMin: Number.MAX_SAFE_INTEGER,
      },
      choices: baseEvent.choices.map((choice) => ({
        ...choice,
        followUp: {
          eventId: followUpOnlyEvent.id,
          afterWeeks: 1,
          probability: 100,
        },
      })),
    };
    const isolatedData = {
      ...gameData,
      events: new Map([
        [sourceEvent.id, sourceEvent],
        [followUpOnlyEvent.id, followUpOnlyEvent],
      ]),
    };

    const normalResult = selectNextEvent(
      state,
      isolatedData,
      new SeededRandom(state.seed, state.randomCursor),
    );
    expect(normalResult.pendingEvent).toBeNull();

    state.eventMemory.scheduledFollowUps = [
      {
        eventId: eventId(followUpOnlyEvent.id),
        eligibleDate: state.date,
        actorPlayerIds: [actor],
        chainId: "follow-up-only-chain",
        chainStage: 2,
      },
    ];
    const dueResult = selectNextEvent(
      state,
      isolatedData,
      new SeededRandom(state.seed, state.randomCursor),
    );
    expect(dueResult.pendingEvent?.eventId).toBe(
      eventId(followUpOnlyEvent.id),
    );
    expect(dueResult.pendingEvent?.chainId).toBe("follow-up-only-chain");
  });
});
