import {
  compactLongTermArchives,
  MAX_ALUMNI_PER_SCHOOL,
  MAX_RIVAL_ALUMNI_PER_SCHOOL,
} from "../../src/domain/world/rivalWorldProgression";
import type { PlayerId } from "../../src/domain/model/identifiers";
import type { CloudGameSnapshot } from "../data/GameStore";

function needsLongTermArchiveCompaction(snapshot: CloudGameSnapshot): boolean {
  const retainedPlayerIds = new Set<PlayerId>();

  for (const school of Object.values(snapshot.state.schools)) {
    const limit =
      school.id === snapshot.state.userSchoolId
        ? MAX_ALUMNI_PER_SCHOOL
        : MAX_RIVAL_ALUMNI_PER_SCHOOL;
    const alumniPlayerIds = [...new Set(school.alumniPlayerIds)].slice(-limit);
    if (new Set(school.alumniPlayerIds).size > limit) {
      return true;
    }
    for (const playerId of [...school.playerIds, ...alumniPlayerIds]) {
      retainedPlayerIds.add(playerId);
    }
  }

  // Older saves can already have bounded alumni id lists while stale retired
  // Player objects remain in the global map. Those orphans still inflate every
  // save payload, so detect them independently of alumniPlayerIds length.
  return Object.keys(snapshot.state.players).some(
    (id) => !retainedPlayerIds.has(id as PlayerId),
  );
}

export function compactGameSnapshot(
  snapshot: CloudGameSnapshot,
): CloudGameSnapshot {
  const archiveCompactedState = needsLongTermArchiveCompaction(snapshot)
    ? compactLongTermArchives(snapshot.state)
    : snapshot.state;
  const completedMatch = archiveCompactedState.activeMatch;
  const matchCompactedState =
    completedMatch?.phase === "match-complete" &&
    completedMatch.eventLog.length > 0
      ? {
          ...archiveCompactedState,
          activeMatch: {
            ...completedMatch,
            eventLog: [],
          },
        }
      : archiveCompactedState;
  const items = matchCompactedState.notifications.items;
  if (items.length <= 1 && matchCompactedState === snapshot.state) {
    return snapshot;
  }

  const newest = items[items.length - 1];
  return {
    ...snapshot,
    state: {
      ...matchCompactedState,
      notifications: {
        items: newest ? [newest] : [],
      },
    },
  };
}
