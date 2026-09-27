import {
  compactLongTermArchives,
  MAX_ALUMNI_PER_SCHOOL,
  MAX_RIVAL_ALUMNI_PER_SCHOOL,
} from "../../src/domain/world/rivalWorldProgression";
import type { CloudGameSnapshot } from "../data/GameStore";

function needsLongTermArchiveCompaction(snapshot: CloudGameSnapshot): boolean {
  return Object.values(snapshot.state.schools).some((school) => {
    const limit =
      school.id === snapshot.state.userSchoolId
        ? MAX_ALUMNI_PER_SCHOOL
        : MAX_RIVAL_ALUMNI_PER_SCHOOL;
    return new Set(school.alumniPlayerIds).size > limit;
  });
}

export function compactGameSnapshot(
  snapshot: CloudGameSnapshot,
): CloudGameSnapshot {
  const compactedState = needsLongTermArchiveCompaction(snapshot)
    ? compactLongTermArchives(snapshot.state)
    : snapshot.state;
  const items = compactedState.notifications.items;
  if (items.length <= 1 && compactedState === snapshot.state) {
    return snapshot;
  }

  const newest = items[items.length - 1];
  return {
    ...snapshot,
    state: {
      ...compactedState,
      notifications: {
        items: newest ? [newest] : [],
      },
    },
  };
}
