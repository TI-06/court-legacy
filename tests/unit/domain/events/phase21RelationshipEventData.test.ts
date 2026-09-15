import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { resolveEventChoice } from "../../../../src/domain/events/resolveEventChoice";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import { eventId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { getRelationshipBond } from "../../../../src/domain/relationships/specialRelationships";

function eventById(id: string) {
  const event = gameData.events.get(id);
  if (!event) throw new Error(`missing event: ${id}`);
  return event;
}

function preparedPair() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const [left, right] = school.playerIds;
  if (!left || !right) throw new Error("players missing");
  return { state, left, right };
}

function resolve(
  eventIdValue: string,
  choiceId: string,
  setup: (args: ReturnType<typeof preparedPair>) => void,
) {
  const pair = preparedPair();
  setup(pair);
  pair.state.pendingEvent = {
    eventId: eventId(eventIdValue),
    actorPlayerIds: [pair.left, pair.right],
    targetSchoolId: null,
    surfacedDate: pair.state.date,
    choiceIds: [choiceId],
    chainId: null,
    chainStage: null,
  };
  return {
    ...pair,
    result: resolveEventChoice(
      pair.state,
      choiceId,
      gameData,
      new SeededRandom(pair.state.seed, pair.state.randomCursor),
    ),
  };
}

describe("Phase21 authored relationship events", () => {
  it("forms a rival from the same-position competition choice", () => {
    const event = eventById("event.position-rivalry");
    expect(event.trigger.samePreferredPosition).toBe(true);
    expect(
      event.choices
        .find((choice) => choice.id === "competition")
        ?.effects.at(-1),
    ).toEqual({
      type: "special-relationship-add",
      kind: "rival",
    });

    const { result, left, right } = resolve(
      event.id,
      "competition",
      ({ state, left: leftId, right: rightId }) => {
        state.players[leftId] = {
          ...state.players[leftId]!,
          preferredPosition: "OH",
        };
        state.players[rightId] = {
          ...state.players[rightId]!,
          preferredPosition: "OH",
        };
        state.playerRelationships[relationshipKey(leftId, rightId)] = 50;
      },
    );

    expect(result.state.playerRelationships[relationshipKey(left, right)]).toBe(
      45,
    );
    expect(
      getRelationshipBond(result.state, left, right)?.tags.map(
        (tag) => tag.kind,
      ),
    ).toContain("rival");
  });

  it("forms a mentor bond exactly from affinity 54 plus the authored +6", () => {
    const event = eventById("event.senior-junior-serve");
    expect(event.trigger.differentGrades).toBe(true);
    expect(event.trigger.relationship?.min).toBe(54);
    expect(
      event.choices.find((choice) => choice.id === "encourage")?.effects.at(-1),
    ).toEqual({
      type: "special-relationship-add",
      kind: "mentor",
      mentor: "higher-grade",
    });

    const { result, left, right } = resolve(
      event.id,
      "encourage",
      ({ state, left: leftId, right: rightId }) => {
        state.players[leftId] = { ...state.players[leftId]!, grade: 1 };
        state.players[rightId] = { ...state.players[rightId]!, grade: 3 };
        state.playerRelationships[relationshipKey(leftId, rightId)] = 54;
      },
    );

    expect(result.state.playerRelationships[relationshipKey(left, right)]).toBe(
      60,
    );
    expect(getRelationshipBond(result.state, left, right)?.tags).toContainEqual(
      expect.objectContaining({
        kind: "mentor",
        mentorPlayerId: right,
        protegePlayerId: left,
      }),
    );
  });

  it("forms a partner bond exactly from affinity 75 plus the authored +5", () => {
    const event = eventById("event.shared-video-review");
    expect(event.trigger.relationship?.min).toBe(75);
    expect(
      event.choices.find((choice) => choice.id === "formalize")?.effects.at(-1),
    ).toEqual({
      type: "special-relationship-add",
      kind: "partner",
    });

    const { result, left, right } = resolve(
      event.id,
      "formalize",
      ({ state, left: leftId, right: rightId }) => {
        state.playerRelationships[relationshipKey(leftId, rightId)] = 75;
      },
    );

    expect(result.state.playerRelationships[relationshipKey(left, right)]).toBe(
      80,
    );
    expect(
      getRelationshipBond(result.state, left, right)?.tags.map(
        (tag) => tag.kind,
      ),
    ).toContain("partner");
  });
});
