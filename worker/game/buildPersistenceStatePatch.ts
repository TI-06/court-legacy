import type { GameState } from "../../src/domain/model/GameState";
import {
  buildJsonStatePatch,
  buildJsonStatePatchWithCollapsedRoot,
  collapseNoisyJsonStatePatchPaths,
  coalesceJsonStatePatchObjectRoots,
  type JsonStatePatchOperation,
} from "../data/statePatch";

const COALESCED_OBJECT_ROOTS = [
  "players",
  "schools",
  "playerRelationships",
  "playerRelationshipBonds",
] as const;

const NOISY_STATE_PATHS = [
  ["playerRelationships"],
  ["playerRelationshipBonds"],
  ["calendar"],
  ["eventMemory"],
  ["world"],
  ["officialSeason"],
  ["teamDynamics"],
  ["weeklySchedule"],
  ["notifications"],
  ["schoolManagement"],
  ["seasonGoals"],
  ["recruiting"],
  ["shopEffects"],
  ["history", "matches"],
  ["history", "graduates"],
  ["history", "nationalChampionSchoolIdsByYear"],
  ["history", "schoolRecordValues"],
  ["history", "officialTournaments"],
  ["history", "playerDevelopmentWeeks"],
  ["history", "relationshipLegacyHistory"],
  ["history", "seasonGoalSeasons"],
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

  const objectMapPatch = coalesceJsonStatePatchObjectRoots(
    after as unknown as Record<string, unknown>,
    rawPatch,
    COALESCED_OBJECT_ROOTS,
  );

  return collapseNoisyJsonStatePatchPaths(
    after as unknown as Record<string, unknown>,
    objectMapPatch,
    NOISY_STATE_PATHS,
  );
}
