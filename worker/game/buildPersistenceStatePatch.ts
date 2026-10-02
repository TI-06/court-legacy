import type { GameState } from "../../src/domain/model/GameState";
import {
  buildJsonStatePatch,
  buildJsonStatePatchWithCollapsedRoot,
  coalesceJsonStatePatchObjectRoots,
  type JsonStatePatchOperation,
} from "../data/statePatch";

const COALESCED_OBJECT_ROOTS = [
  "players",
  "schools",
  "playerRelationships",
  "playerRelationshipBonds",
] as const;

export function buildPersistenceStatePatch(
  before: GameState,
  after: GameState,
): JsonStatePatchOperation[] {
  const activeMatchChanged = before.activeMatch !== after.activeMatch;
  const rawPatch = activeMatchChanged
    ? buildJsonStatePatchWithCollapsedRoot(
        before as unknown as Record<string, unknown>,
        after as unknown as Record<string, unknown>,
        "activeMatch",
      )
    : buildJsonStatePatch(before, after);

  return coalesceJsonStatePatchObjectRoots(
    after as unknown as Record<string, unknown>,
    rawPatch,
    COALESCED_OBJECT_ROOTS,
  );
}
