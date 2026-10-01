import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { selectNextEvent } from "../../../../src/domain/events/selectEvent";
import { eventId } from "../../../../src/domain/model/identifiers";
import { addWeeks } from "../../../../src/domain/events/eventDate";
import {
  SeededRandom,
  type RandomSource,
} from "../../../../src/domain/random/SeededRandom";

function fixedRollRandom(roll: number): RandomSource {
  let cursor = 0;
  return {
    get cursor() {
      return cursor;
    },
    next() {
      cursor += 1;
      return (roll - 1) / 100;
    },
    int(minimum, maximum) {
      cursor += 1;
      return Math.max(minimum, Math.min(maximum, roll));
    },
    pick(items) {
      const first = items[0];
      if (first === undefined) {
        throw new Error("cannot pick from an empty collection");
      }
      return first;
    },
    fork() {
      return fixedRollRandom(roll);
    },
    snapshot() {
      return { seed: `fixed-${roll}`, cursor };
    },
  };
}

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

  it("prioritizes an eligible Rare awakening before normal events", () => {
    const state = createDemoGame();
    const actor = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[actor]!;
    state.players[actor] = {
      ...player,
      abilities: {
        ...player.abilities,
        spike: 80,
        decision: 78,
      },
      specialAbilityIds: ["attack_course", "attack_blockout"],
    };

    const awakening = gameData.events.get("event.awaken-court-hitter")!;
    const normalBase = gameData.events.get("event.position-trial-result")!;
    const normal = {
      ...normalBase,
      id: "event.normal-fallback-test",
      tags: ["test-normal"],
      trigger: {},
      actorCount: 1,
    };
    const isolatedData = {
      ...gameData,
      events: new Map([
        [normal.id, normal],
        [awakening.id, awakening],
      ]),
    };

    const prioritized = selectNextEvent(
      state,
      isolatedData,
      fixedRollRandom(1),
    );
    expect(prioritized.pendingEvent?.eventId).toBe(eventId(awakening.id));

    const fallback = selectNextEvent(
      { ...state, pendingEvent: null },
      isolatedData,
      fixedRollRandom(41),
    );
    expect(fallback.pendingEvent?.eventId).toBe(eventId(normal.id));
  });

  it("blocks another Super Rare event for 104 weeks after an actual awakening", () => {
    const state = createDemoGame();
    const actor = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[actor]!;
    state.players[actor] = {
      ...player,
      abilities: {
        ...player.abilities,
        spike: 92,
        mental: 85,
      },
      specialAbilityIds: ["elite_court_hitter", "elite_block_crusher"],
    };

    const gold = gameData.events.get("event.gold-absolute-ace")!;
    const normalBase = gameData.events.get("event.position-trial-result")!;
    const normal = {
      ...normalBase,
      id: "event.normal-super-rare-cooldown-test",
      tags: ["test-normal"],
      trigger: {},
      actorCount: 1,
    };
    const isolatedData = {
      ...gameData,
      events: new Map([
        [normal.id, normal],
        [gold.id, gold],
      ]),
    };

    state.eventMemory.history = [
      {
        eventId: eventId(gold.id),
        date: state.date,
        actorPlayerIds: [actor],
        choiceId: "awaken",
        visibleResultCodes: ["絶対的エース 習得"],
      },
    ];

    const blocked = selectNextEvent(state, isolatedData, fixedRollRandom(1));
    expect(blocked.pendingEvent?.eventId).toBe(eventId(normal.id));

    state.eventMemory.history = [
      {
        ...state.eventMemory.history[0]!,
        date: addWeeks(state.date, -104),
      },
    ];
    const availableAgain = selectNextEvent(
      { ...state, pendingEvent: null },
      isolatedData,
      fixedRollRandom(1),
    );
    expect(availableAgain.pendingEvent?.eventId).toBe(eventId(gold.id));
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
    expect(dueResult.pendingEvent?.eventId).toBe(eventId(followUpOnlyEvent.id));
    expect(dueResult.pendingEvent?.chainId).toBe("follow-up-only-chain");
  });
});
