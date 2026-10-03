import { MAX_PLAYER_DEVELOPMENT_WEEKS } from "../../src/domain/player/playerDevelopmentHistory";
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
    const alumniPlayerIds =
      limit === 0 ? [] : [...new Set(school.alumniPlayerIds)].slice(-limit);
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
  const developmentWeeks =
    archiveCompactedState.history.playerDevelopmentWeeks.length >
    MAX_PLAYER_DEVELOPMENT_WEEKS
      ? archiveCompactedState.history.playerDevelopmentWeeks.slice(
          -MAX_PLAYER_DEVELOPMENT_WEEKS,
        )
      : archiveCompactedState.history.playerDevelopmentWeeks;
  const developmentCompactedState =
    developmentWeeks === archiveCompactedState.history.playerDevelopmentWeeks
      ? archiveCompactedState
      : {
          ...archiveCompactedState,
          history: {
            ...archiveCompactedState.history,
            playerDevelopmentWeeks: developmentWeeks,
          },
        };
  const completedMatch = developmentCompactedState.activeMatch;
  const matchCompactedState =
    completedMatch?.phase === "match-complete" &&
    completedMatch.eventLog.length > 0
      ? {
          ...developmentCompactedState,
          activeMatch: {
            ...completedMatch,
            eventLog: [],
          },
        }
      : developmentCompactedState;
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
