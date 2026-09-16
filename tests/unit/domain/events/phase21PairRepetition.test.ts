import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { resolveEventChoice } from "../../../../src/domain/events/resolveEventChoice";
import {
  eventActorPairKey,
  eventSelectionWeight,
} from "../../../../src/domain/events/selectEvent";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import { eventId, type PlayerId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import type { EventDefinition } from "../../../../src/domain/validation/gameDataSchema";

function neutralEvent(overrides: Partial<EventDefinition> = {}): EventDefinition {
  const base = [...gameData.events.values()][0]!;
  return {
    ...base,
    id: "event.phase21-pair-weight",
    category: "individual",
    tags: [],
    weight: 100,
    actorCount: 2,
    choices: [
      {
        id: "accept",
        label: "受け入れる",
        detail: "確認用",
        effects: [{ type: "trust-change", amount: 1 }],
      },
      {
        id: "decline",
        label: "見送る",
        detail: "確認用",
        effects: [{ type: "trust-change", amount: 0 }],
      },
    ],
    ...overrides,
  };
}

describe("Phase21 actor pair repetition", () => {
  it("creates a canonical key only for exactly two distinct actors", () => {
    const state = createDemoGame();
    const [left, right, third] = state.schools[state.userSchoolId]!.playerIds;
    expect(eventActorPairKey([right!, left!])).toBe(
      relationshipKey(left!, right!),
    );
    expect(eventActorPairKey([left!])).toBeNull();
    expect(eventActorPairKey([left!, left!])).toBeNull();
    expect(eventActorPairKey([left!, right!, third!])).toBeNull();
  });

  it("applies the exact recent-pair 0.20 penalty without bypassing existing penalties", () => {
    const state = structuredClone(createDemoGame());
    const actors = state.schools[state.userSchoolId]!.playerIds.slice(0, 2) as [
      PlayerId,
      PlayerId,
    ];
    const event = neutralEvent();

    state.eventMemory.recentActorPairKeys = [];
    expect(eventSelectionWeight(state, gameData, event, actors)).toBe(100);

    state.eventMemory.recentActorPairKeys = [relationshipKey(...actors)];
    expect(eventSelectionWeight(state, gameData, event, actors)).toBe(20);

    state.eventMemory.recentEventIds = [eventId(event.id)];
    state.eventMemory.recentCategoryIds = [event.category];
    expect(eventSelectionWeight(state, gameData, event, actors)).toBe(1);
  });

  it("records the resolved pair canonically and retains only the latest six", () => {
    const state = structuredClone(createDemoGame());
    const actors = state.schools[state.userSchoolId]!.playerIds.slice(0, 2) as [
      PlayerId,
      PlayerId,
    ];
    const event = neutralEvent();
    const data = {
      ...gameData,
      events: new Map([...gameData.events, [event.id, event] as const]),
    };
    state.eventMemory.recentActorPairKeys = [
      "a::b",
      "c::d",
      "e::f",
      "g::h",
      "i::j",
      "k::l",
    ];
    state.pendingEvent = {
      eventId: eventId(event.id),
      actorPlayerIds: [...actors],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: event.choices.map((choice) => choice.id),
      chainId: null,
      chainStage: null,
    };

    const resolved = resolveEventChoice(
      state,
      "accept",
      data,
      new SeededRandom(state.seed, state.randomCursor),
    );

    expect(resolved.state.eventMemory.recentActorPairKeys).toHaveLength(6);
    expect(resolved.state.eventMemory.recentActorPairKeys.at(-1)).toBe(
      relationshipKey(...actors),
    );
    expect(resolved.state.eventMemory.recentActorPairKeys).not.toContain("a::b");
  });

  it("does not append pair memory for a one-actor event", () => {
    const state = structuredClone(createDemoGame());
    const actor = state.schools[state.userSchoolId]!.playerIds[0]!;
    const event = neutralEvent({ actorCount: 1 });
    const data = {
      ...gameData,
      events: new Map([...gameData.events, [event.id, event] as const]),
    };
    state.eventMemory.recentActorPairKeys = ["a::b"];
    state.pendingEvent = {
      eventId: eventId(event.id),
      actorPlayerIds: [actor],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: event.choices.map((choice) => choice.id),
      chainId: null,
      chainStage: null,
    };

    const resolved = resolveEventChoice(
      state,
      "accept",
      data,
      new SeededRandom(state.seed, state.randomCursor),
    );

    expect(resolved.state.eventMemory.recentActorPairKeys).toEqual(["a::b"]);
  });
});
