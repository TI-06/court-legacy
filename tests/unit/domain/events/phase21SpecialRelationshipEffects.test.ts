import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { isEventEligibleForActors } from "../../../../src/domain/events/eventEligibility";
import { resolveEventChoice } from "../../../../src/domain/events/resolveEventChoice";
import { relationshipKey } from "../../../../src/domain/model/GameState";
import { eventId } from "../../../../src/domain/model/identifiers";
import { SeededRandom } from "../../../../src/domain/random/SeededRandom";
import { getRelationshipBond } from "../../../../src/domain/relationships/specialRelationships";
import type { GameDataRegistry } from "../../../../src/data/dataRegistry";
import {
  eventDefinitionSchema,
  type EventDefinition,
} from "../../../../src/domain/validation/gameDataSchema";

const phase21EventInput = {
  id: "event.phase21-special-relationship",
  version: 1,
  category: "relationship",
  title: "関係性テスト",
  bodyTemplate: "{{player}}と{{player2}}の関係。",
  tags: ["test"],
  trigger: {
    samePreferredPosition: true,
    differentGrades: true,
  },
  weight: 1,
  cooldownWeeks: 0,
  oncePerCareer: false,
  actorCount: 2,
  choices: [
    {
      id: "rival",
      label: "競わせる",
      detail: "二人を競わせる。",
      effects: [
        { type: "relationship-change", amount: 15 },
        { type: "special-relationship-add", kind: "rival" },
      ],
    },
    {
      id: "mentor",
      label: "指導を促す",
      detail: "上級生から後輩へ指導する。",
      effects: [
        {
          type: "special-relationship-add",
          kind: "mentor",
          mentor: "higher-grade",
        },
      ],
    },
    {
      id: "remove-rival",
      label: "競争を終える",
      detail: "ライバル関係を解消する。",
      effects: [{ type: "special-relationship-remove", kind: "rival" }],
    },
  ],
} as const;

function parsedEvent(): EventDefinition {
  return eventDefinitionSchema.parse(phase21EventInput);
}

function registryWith(event: EventDefinition): GameDataRegistry {
  return {
    ...gameData,
    events: new Map([...gameData.events, [event.id, event]]),
  };
}

function firstTwoPlayers() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const [left, right] = school.playerIds;
  if (!left || !right) throw new Error("players missing");
  return { state, left, right };
}

describe("Phase21 special relationship event effects", () => {
  it("accepts the pair-aware trigger and special relationship effect schema", () => {
    expect(eventDefinitionSchema.safeParse(phase21EventInput).success).toBe(true);
  });

  it("requires same preferred position and different grades when requested", () => {
    const event = phase21EventInput as unknown as EventDefinition;
    const { state, left, right } = firstTwoPlayers();
    state.players[left] = {
      ...state.players[left]!,
      grade: 1,
      preferredPosition: "OH",
    };
    state.players[right] = {
      ...state.players[right]!,
      grade: 2,
      preferredPosition: "OH",
    };

    expect(isEventEligibleForActors(state, event, [left, right])).toBe(true);

    state.players[right] = { ...state.players[right]!, grade: 1 };
    expect(isEventEligibleForActors(state, event, [left, right])).toBe(false);

    state.players[right] = {
      ...state.players[right]!,
      grade: 2,
      preferredPosition: "MB",
    };
    expect(isEventEligibleForActors(state, event, [left, right])).toBe(false);
  });

  it("shows affinity band transition and emits an establishment transition in effect order", () => {
    const event = phase21EventInput as unknown as EventDefinition;
    const { state, left, right } = firstTwoPlayers();
    state.playerRelationships[relationshipKey(left, right)] = 50;
    state.pendingEvent = {
      eventId: eventId(event.id),
      actorPlayerIds: [left, right],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: ["rival"],
      chainId: null,
      chainStage: null,
    };

    const result = resolveEventChoice(
      state,
      "rival",
      registryWith(event),
      new SeededRandom(state.seed, state.randomCursor),
    );

    expect(result.occurrence.visibleResultCodes).toEqual([
      "連携 +15（普通 → 好相性）",
      "特殊関係 ライバル成立",
    ]);
    expect(result.specialRelationshipTransitions).toEqual([
      { action: "established", kind: "rival", playerIds: [left, right].sort() },
    ]);
    expect(getRelationshipBond(result.state, left, right)?.tags[0]?.kind).toBe(
      "rival",
    );
  });

  it("resolves higher-grade mentor direction and removal transitions", () => {
    const event = phase21EventInput as unknown as EventDefinition;
    const { state, left, right } = firstTwoPlayers();
    state.players[left] = { ...state.players[left]!, grade: 1 };
    state.players[right] = { ...state.players[right]!, grade: 3 };
    state.pendingEvent = {
      eventId: eventId(event.id),
      actorPlayerIds: [left, right],
      targetSchoolId: null,
      surfacedDate: state.date,
      choiceIds: ["mentor"],
      chainId: null,
      chainStage: null,
    };

    const mentored = resolveEventChoice(
      state,
      "mentor",
      registryWith(event),
      new SeededRandom(state.seed, state.randomCursor),
    );
    const mentorTag = getRelationshipBond(mentored.state, left, right)?.tags[0];
    expect(mentorTag).toMatchObject({
      kind: "mentor",
      mentorPlayerId: right,
      protegePlayerId: left,
    });
    expect(mentored.specialRelationshipTransitions).toHaveLength(1);

    const rivalState = {
      ...mentored.state,
      pendingEvent: {
        eventId: eventId(event.id),
        actorPlayerIds: [left, right],
        targetSchoolId: null,
        surfacedDate: state.date,
        choiceIds: ["rival"],
        chainId: null,
        chainStage: null,
      },
    };
    const withRival = resolveEventChoice(
      rivalState,
      "rival",
      registryWith(event),
      new SeededRandom(rivalState.seed, rivalState.randomCursor),
    );
    const removalState = {
      ...withRival.state,
      pendingEvent: {
        eventId: eventId(event.id),
        actorPlayerIds: [left, right],
        targetSchoolId: null,
        surfacedDate: state.date,
        choiceIds: ["remove-rival"],
        chainId: null,
        chainStage: null,
      },
    };
    const removed = resolveEventChoice(
      removalState,
      "remove-rival",
      registryWith(event),
      new SeededRandom(removalState.seed, removalState.randomCursor),
    );

    expect(removed.specialRelationshipTransitions).toEqual([
      { action: "removed", kind: "rival", playerIds: [left, right].sort() },
    ]);
    expect(removed.occurrence.visibleResultCodes).toContain(
      "特殊関係 ライバル解消",
    );
    expect(
      getRelationshipBond(removed.state, left, right)?.tags.map((tag) => tag.kind),
    ).toEqual(["mentor"]);
  });
});
