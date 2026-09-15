import { createDemoGame } from "../../../src/app/createDemoGame";
import { relationshipKey } from "../../../src/domain/model/GameState";
import { eventId } from "../../../src/domain/model/identifiers";
import { buildSpecialRelationshipNotification } from "../../../src/domain/notifications/gameNotifications";
import { addSpecialRelationship } from "../../../src/domain/relationships/specialRelationships";
import {
  decodeGameState,
  encodeGameState,
} from "../../../src/persistence/gameStateCodec";

function asMutableRecord(value: unknown): Record<string, any> {
  return value as Record<string, any>;
}

describe("Phase21 schema v9 migration", () => {
  it("migrates a real v8-shaped save with Phase21 defaults while preserving existing state", () => {
    const current = structuredClone(createDemoGame());
    const school = current.schools[current.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const teammateId = school.playerIds[1]!;
    const player = current.players[playerId]!;
    const pairKey = relationshipKey(playerId, teammateId);

    current.playerRelationships[pairKey] = 73;
    player.personalityId = "personality.competitive";
    player.hiddenTraitIds = ["character.caretaker"];
    player.potential = 88;
    player.trainingEfficiency = 109;
    player.matchConsistency = 81;
    current.pendingEvent = {
      eventId: eventId("event.position-rivalry"),
      actorPlayerIds: [playerId, teammateId],
      targetSchoolId: null,
      surfacedDate: current.date,
      choiceIds: ["competition"],
      chainId: null,
      chainStage: null,
    };
    current.eventMemory.history.push({
      eventId: eventId("event.position-rivalry"),
      date: current.date,
      actorPlayerIds: [playerId, teammateId],
      choiceId: "competition",
      visibleResultCodes: ["連携 +1"],
    });

    const legacy = asMutableRecord(structuredClone(current));
    legacy.schemaVersion = 8;
    delete legacy.playerRelationshipBonds;
    delete legacy.history.relationshipLegacyHistory;
    delete legacy.eventMemory.recentActorPairKeys;
    for (const legacyPlayer of Object.values(legacy.players) as Record<
      string,
      any
    >[]) {
      delete legacyPlayer.revealedHiddenTraitIds;
      delete legacyPlayer.hiddenTraitAssignmentInitialized;
    }

    const migrated = decodeGameState(JSON.stringify(legacy));
    const migratedPlayer = migrated.players[playerId]!;

    expect(migrated.schemaVersion).toBe(9);
    expect(migrated.playerRelationshipBonds).toEqual({});
    expect(migrated.history.relationshipLegacyHistory).toEqual([]);
    expect(migrated.eventMemory.recentActorPairKeys).toEqual([]);
    expect(migratedPlayer.revealedHiddenTraitIds).toEqual([]);
    expect(migratedPlayer.hiddenTraitAssignmentInitialized).toBe(false);
    expect(migrated.playerRelationships[pairKey]).toBe(73);
    expect(migrated.pendingEvent).toEqual(current.pendingEvent);
    expect(migrated.eventMemory.history).toEqual(current.eventMemory.history);
    expect(migratedPlayer.personalityId).toBe("personality.competitive");
    expect(migratedPlayer.hiddenTraitIds).toEqual(["character.caretaker"]);
    expect(migratedPlayer.potential).toBe(88);
    expect(migratedPlayer.trainingEfficiency).toBe(109);
    expect(migratedPlayer.matchConsistency).toBe(81);
  });

  it("round-trips complete v9 relationship state, legacy, recent pair memory, and notification", () => {
    let state = structuredClone(createDemoGame());
    const school = state.schools[state.userSchoolId]!;
    const leftId = school.playerIds[0]!;
    const rightId = school.playerIds[1]!;
    const pairKey = relationshipKey(leftId, rightId);
    state.playerRelationships[pairKey] = 64;
    state = addSpecialRelationship(state, {
      playerIds: [leftId, rightId],
      kind: "rival",
      establishedDate: state.date,
      sourceEventId: eventId("event.position-rivalry"),
    }).state;
    state = addSpecialRelationship(state, {
      playerIds: [leftId, rightId],
      kind: "mentor",
      establishedDate: state.date,
      sourceEventId: eventId("event.senior-junior-serve"),
      mentorPlayerId: leftId,
      protegePlayerId: rightId,
    }).state;
    state.playerRelationshipBonds[pairKey]!.tags.find(
      (tag) => tag.kind === "mentor",
    )!.belowThresholdSince = state.date;
    state.eventMemory.recentActorPairKeys = [pairKey];
    state.history.relationshipLegacyHistory = [
      {
        playerIds: [leftId, rightId].sort() as [typeof leftId, typeof rightId],
        displayNames: [
          `${state.players[leftId]!.lastName} ${state.players[leftId]!.firstName}`,
          `${state.players[rightId]!.lastName} ${state.players[rightId]!.firstName}`,
        ],
        tags: state.playerRelationshipBonds[pairKey]!.tags.map((tag) => ({
          ...tag,
        })),
        finalRelationshipScore: 64,
        archivedDate: state.date,
      },
    ];
    state.notifications = {
      items: [
        buildSpecialRelationshipNotification({
          state,
          transition: {
            action: "established",
            kind: "mentor",
            playerIds: [leftId, rightId].sort() as [
              typeof leftId,
              typeof rightId,
            ],
          },
        }),
      ],
    };

    const decoded = decodeGameState(encodeGameState(state));

    expect(decoded.playerRelationshipBonds).toEqual(state.playerRelationshipBonds);
    expect(decoded.history.relationshipLegacyHistory).toEqual(
      state.history.relationshipLegacyHistory,
    );
    expect(decoded.eventMemory.recentActorPairKeys).toEqual([pairKey]);
    expect(decoded.notifications).toEqual(state.notifications);
  });

  it("rejects a v9 bond with more than two special tags", () => {
    const state = structuredClone(createDemoGame());
    const school = state.schools[state.userSchoolId]!;
    const leftId = school.playerIds[0]!;
    const rightId = school.playerIds[1]!;
    const pairKey = relationshipKey(leftId, rightId);
    const baseTag = {
      establishedDate: state.date,
      sourceEventId: null,
      lastReinforcedDate: state.date,
      belowThresholdSince: null,
    };
    asMutableRecord(state).playerRelationshipBonds[pairKey] = {
      playerIds: [leftId, rightId].sort(),
      tags: [
        { ...baseTag, kind: "rival" },
        { ...baseTag, kind: "partner" },
        {
          ...baseTag,
          kind: "mentor",
          mentorPlayerId: leftId,
          protegePlayerId: rightId,
        },
      ],
    };

    expect(() => encodeGameState(state)).toThrow(
      "保存対象のゲーム状態が正しくありません",
    );
  });

  it("rejects a mentor direction that references a player outside the pair", () => {
    const state = structuredClone(createDemoGame());
    const school = state.schools[state.userSchoolId]!;
    const leftId = school.playerIds[0]!;
    const rightId = school.playerIds[1]!;
    const outsiderId = school.playerIds[2]!;
    const pairKey = relationshipKey(leftId, rightId);
    asMutableRecord(state).playerRelationshipBonds[pairKey] = {
      playerIds: [leftId, rightId].sort(),
      tags: [
        {
          kind: "mentor",
          establishedDate: state.date,
          sourceEventId: null,
          lastReinforcedDate: state.date,
          belowThresholdSince: null,
          mentorPlayerId: outsiderId,
          protegePlayerId: rightId,
        },
      ],
    };

    expect(() => encodeGameState(state)).toThrow(
      "保存対象のゲーム状態が正しくありません",
    );
  });

  it("rejects more than six recent actor-pair keys and more than 200 legacy records", () => {
    const state = structuredClone(createDemoGame());
    state.eventMemory.recentActorPairKeys = Array.from(
      { length: 7 },
      (_, index) => `player-a-${index}::player-b-${index}`,
    );

    expect(() => encodeGameState(state)).toThrow(
      "保存対象のゲーム状態が正しくありません",
    );

    state.eventMemory.recentActorPairKeys = [];
    const school = state.schools[state.userSchoolId]!;
    const leftId = school.playerIds[0]!;
    const rightId = school.playerIds[1]!;
    state.history.relationshipLegacyHistory = Array.from(
      { length: 201 },
      () => ({
        playerIds: [leftId, rightId].sort() as [typeof leftId, typeof rightId],
        displayNames: ["A", "B"] as [string, string],
        tags: [],
        finalRelationshipScore: 50,
        archivedDate: state.date,
      }),
    );

    expect(() => encodeGameState(state)).toThrow(
      "保存対象のゲーム状態が正しくありません",
    );
  });
});
