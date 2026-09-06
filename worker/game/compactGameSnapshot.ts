import type { CloudGameSnapshot } from "../data/GameStore";

export function compactGameSnapshot(
  snapshot: CloudGameSnapshot,
): CloudGameSnapshot {
  const items = snapshot.state.notifications.items;
  if (items.length <= 1) {
    return snapshot;
  }

  const newest = items[items.length - 1];
  return {
    ...snapshot,
    state: {
      ...snapshot.state,
      notifications: {
        items: newest ? [newest] : [],
      },
    },
  };
}
