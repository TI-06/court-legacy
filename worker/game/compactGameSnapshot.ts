import { compactLongTermArchives } from "../../src/domain/world/rivalWorldProgression";
import type { CloudGameSnapshot } from "../data/GameStore";

export function compactGameSnapshot(
  snapshot: CloudGameSnapshot,
): CloudGameSnapshot {
  const compactedState = compactLongTermArchives(snapshot.state);
  const items = compactedState.notifications.items;
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
