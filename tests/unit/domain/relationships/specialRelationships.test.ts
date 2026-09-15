import { describe, expect, it } from "vitest";
import type { GameState } from "../../../../src/domain/model/GameState";
import { eventId, playerId } from "../../../../src/domain/model/identifiers";
import {
  addSpecialRelationship,
  getRelationshipBond,
  removeSpecialRelationship,
} from "../../../../src/domain/relationships/specialRelationships";

function relationshipState(): GameState {
  return {
    playerRelationshipBonds: {},
  } as unknown as GameState;
}

const a = playerId("player-a");
const b = playerId("player-b");
const source = eventId("event.relationship-test");

describe("special relationship helpers", () => {
  it("stores pair IDs in canonical sorted order and emits one establishment transition", () => {
    const result = addSpecialRelationship(relationshipState(), {
      playerIds: [b, a],
      kind: "rival",
      establishedDate: "2026-4-1",
      sourceEventId: source,
    });

    expect(result.transition).toEqual({
      action: "established",
      kind: "rival",
      playerIds: [a, b],
    });
    expect(getRelationshipBond(result.state, a, b)?.playerIds).toEqual([a, b]);
  });

  it("rejects self-pairs", () => {
    expect(() =>
      addSpecialRelationship(relationshipState(), {
        playerIds: [a, a],
        kind: "rival",
        establishedDate: "2026-4-1",
        sourceEventId: source,
      }),
    ).toThrow(/same player|self/i);
  });

  it("reinforces an existing tag without emitting another establishment", () => {
    const first = addSpecialRelationship(relationshipState(), {
      playerIds: [a, b],
      kind: "partner",
      establishedDate: "2026-4-1",
      sourceEventId: source,
    });
    const reinforced = addSpecialRelationship(first.state, {
      playerIds: [b, a],
      kind: "partner",
      establishedDate: "2026-5-6",
      sourceEventId: source,
    });

    expect(reinforced.transition).toBeNull();
    const tag = getRelationshipBond(reinforced.state, a, b)?.tags[0];
    expect(tag?.establishedDate).toBe("2026-4-1");
    expect(tag?.lastReinforcedDate).toBe("2026-5-6");
    expect(tag?.belowThresholdSince).toBeNull();
  });

  it("stores mentor direction inside the canonical pair", () => {
    const result = addSpecialRelationship(relationshipState(), {
      playerIds: [b, a],
      kind: "mentor",
      establishedDate: "2026-4-1",
      sourceEventId: source,
      mentorPlayerId: b,
      protegePlayerId: a,
    });

    const tag = getRelationshipBond(result.state, a, b)?.tags[0];
    expect(tag).toMatchObject({
      kind: "mentor",
      mentorPlayerId: b,
      protegePlayerId: a,
    });
  });

  it("rejects a third distinct tag on the same pair", () => {
    const rival = addSpecialRelationship(relationshipState(), {
      playerIds: [a, b],
      kind: "rival",
      establishedDate: "2026-4-1",
      sourceEventId: source,
    });
    const partner = addSpecialRelationship(rival.state, {
      playerIds: [a, b],
      kind: "partner",
      establishedDate: "2026-4-8",
      sourceEventId: source,
    });

    expect(() =>
      addSpecialRelationship(partner.state, {
        playerIds: [a, b],
        kind: "mentor",
        establishedDate: "2026-4-15",
        sourceEventId: source,
        mentorPlayerId: a,
        protegePlayerId: b,
      }),
    ).toThrow(/two|2|maximum/i);
  });

  it("removes only the requested tag and deletes the bond after the final tag", () => {
    const rival = addSpecialRelationship(relationshipState(), {
      playerIds: [a, b],
      kind: "rival",
      establishedDate: "2026-4-1",
      sourceEventId: source,
    });
    const partner = addSpecialRelationship(rival.state, {
      playerIds: [a, b],
      kind: "partner",
      establishedDate: "2026-4-8",
      sourceEventId: source,
    });

    const firstRemoval = removeSpecialRelationship(partner.state, {
      playerIds: [b, a],
      kind: "rival",
    });
    expect(firstRemoval.transition).toEqual({
      action: "removed",
      kind: "rival",
      playerIds: [a, b],
    });
    expect(getRelationshipBond(firstRemoval.state, a, b)?.tags).toHaveLength(1);

    const finalRemoval = removeSpecialRelationship(firstRemoval.state, {
      playerIds: [a, b],
      kind: "partner",
    });
    expect(finalRemoval.transition).toEqual({
      action: "removed",
      kind: "partner",
      playerIds: [a, b],
    });
    expect(getRelationshipBond(finalRemoval.state, a, b)).toBeNull();
  });
});
