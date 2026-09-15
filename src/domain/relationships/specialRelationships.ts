import { relationshipKey } from "../model/GameState";
import type { EventId, GameDate, PlayerId } from "../model/identifiers";
import type {
  PlayerRelationshipBond,
  SpecialRelationshipKind,
  SpecialRelationshipTag,
  SpecialRelationshipTransition,
} from "./relationshipTypes";

interface RelationshipStateLike {
  playerRelationshipBonds: Record<string, PlayerRelationshipBond>;
}

interface AddSpecialRelationshipInput {
  playerIds: [PlayerId, PlayerId];
  kind: SpecialRelationshipKind;
  establishedDate: GameDate;
  sourceEventId?: EventId | null;
  mentorPlayerId?: PlayerId;
  protegePlayerId?: PlayerId;
}

interface RemoveSpecialRelationshipInput {
  playerIds: [PlayerId, PlayerId];
  kind: SpecialRelationshipKind;
}

function canonicalPair(left: PlayerId, right: PlayerId): [PlayerId, PlayerId] {
  if (left === right) {
    throw new Error("self relationship is not allowed");
  }
  return left < right ? [left, right] : [right, left];
}

function validateMentorDirection(
  pair: readonly [PlayerId, PlayerId],
  input: AddSpecialRelationshipInput,
): void {
  if (input.kind !== "mentor") return;
  if (!input.mentorPlayerId || !input.protegePlayerId) {
    throw new Error("mentor relationship requires mentor and protege players");
  }
  if (input.mentorPlayerId === input.protegePlayerId) {
    throw new Error("mentor and protege must be different players");
  }
  const pairIds = new Set(pair);
  if (
    !pairIds.has(input.mentorPlayerId) ||
    !pairIds.has(input.protegePlayerId)
  ) {
    throw new Error("mentor and protege must belong to the relationship pair");
  }
}

function replaceBond<T extends RelationshipStateLike>(
  state: T,
  key: string,
  bond: PlayerRelationshipBond | null,
): T {
  const nextBonds = { ...state.playerRelationshipBonds };
  if (bond) nextBonds[key] = bond;
  else delete nextBonds[key];
  return { ...state, playerRelationshipBonds: nextBonds };
}

export function getRelationshipBond(
  state: RelationshipStateLike,
  left: PlayerId,
  right: PlayerId,
): PlayerRelationshipBond | null {
  if (left === right) return null;
  return state.playerRelationshipBonds[relationshipKey(left, right)] ?? null;
}

export function addSpecialRelationship<T extends RelationshipStateLike>(
  state: T,
  input: AddSpecialRelationshipInput,
): { state: T; transition: SpecialRelationshipTransition | null } {
  const pair = canonicalPair(...input.playerIds);
  validateMentorDirection(pair, input);
  const key = relationshipKey(...pair);
  const existing = state.playerRelationshipBonds[key] ?? {
    playerIds: pair,
    tags: [],
  };
  const existingIndex = existing.tags.findIndex(
    (tag) => tag.kind === input.kind,
  );

  if (existingIndex >= 0) {
    const tags = existing.tags.map((tag, index) =>
      index === existingIndex
        ? {
            ...tag,
            lastReinforcedDate: input.establishedDate,
            belowThresholdSince: null,
            ...(input.kind === "mentor"
              ? {
                  mentorPlayerId: input.mentorPlayerId,
                  protegePlayerId: input.protegePlayerId,
                }
              : {}),
          }
        : tag,
    );
    return {
      state: replaceBond(state, key, { ...existing, playerIds: pair, tags }),
      transition: null,
    };
  }

  if (existing.tags.length >= 2) {
    throw new Error("maximum two special relationship tags per player pair");
  }

  const tag: SpecialRelationshipTag = {
    kind: input.kind,
    establishedDate: input.establishedDate,
    sourceEventId: input.sourceEventId ?? null,
    lastReinforcedDate: input.establishedDate,
    belowThresholdSince: null,
    ...(input.kind === "mentor"
      ? {
          mentorPlayerId: input.mentorPlayerId,
          protegePlayerId: input.protegePlayerId,
        }
      : {}),
  };
  return {
    state: replaceBond(state, key, {
      playerIds: pair,
      tags: [...existing.tags, tag],
    }),
    transition: { action: "established", kind: input.kind, playerIds: pair },
  };
}

export function removeSpecialRelationship<T extends RelationshipStateLike>(
  state: T,
  input: RemoveSpecialRelationshipInput,
): { state: T; transition: SpecialRelationshipTransition | null } {
  const pair = canonicalPair(...input.playerIds);
  const key = relationshipKey(...pair);
  const existing = state.playerRelationshipBonds[key];
  if (!existing || !existing.tags.some((tag) => tag.kind === input.kind)) {
    return { state, transition: null };
  }
  const tags = existing.tags.filter((tag) => tag.kind !== input.kind);
  return {
    state: replaceBond(
      state,
      key,
      tags.length > 0 ? { ...existing, playerIds: pair, tags } : null,
    ),
    transition: { action: "removed", kind: input.kind, playerIds: pair },
  };
}
