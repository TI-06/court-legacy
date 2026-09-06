import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type { GameDate } from "../../../src/domain/model/identifiers";
import type { TrainingResultNotification } from "../../../src/domain/notifications/gameNotifications";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { compactGameSnapshot } from "../../../worker/game/compactGameSnapshot";

function notification(
  id: string,
  weekOfYear: number,
  date: string,
): TrainingResultNotification {
  return {
    id,
    type: "training-result",
    createdGameDate: date as GameDate,
    academicYearIndex: 1,
    weekOfYear,
    readAtGameDate: null,
    payload: {
      teamTrainingMenuName: "基礎練習",
      totalAbilityGrowth: 0,
      totalFatigueChange: 0,
      injuredCount: 0,
      players: [],
    },
  };
}

function snapshotWithNotifications(): CloudGameSnapshot {
  const state = createDemoGame();
  state.notifications = {
    items: [
      notification("training-old", 1, "2026-04-01"),
      notification("training-new", 2, "2026-04-08"),
    ],
  };

  return {
    userId: "user-compact",
    schoolDbId: "00000000-0000-4000-8000-000000000777",
    revision: 12,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

describe("compactGameSnapshot", () => {
  it("keeps only the newest training notification before expensive game processing", () => {
    const snapshot = snapshotWithNotifications();

    const compacted = compactGameSnapshot(snapshot);

    expect(compacted.state.notifications.items.map((item) => item.id)).toEqual([
      "training-new",
    ]);
    expect(snapshot.state.notifications.items).toHaveLength(2);
  });

  it("returns the original snapshot when it is already compact", () => {
    const snapshot = snapshotWithNotifications();
    snapshot.state.notifications.items = snapshot.state.notifications.items.slice(-1);

    expect(compactGameSnapshot(snapshot)).toBe(snapshot);
  });
});
