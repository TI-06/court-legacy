import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { playerId, type GameDate } from "../../../src/domain/model/identifiers";
import type { TrainingResultNotification } from "../../../src/domain/notifications/gameNotifications";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import { MAX_RIVAL_ALUMNI_PER_SCHOOL } from "../../../src/domain/world/rivalWorldProgression";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { applyGameAction } from "../../../worker/game/applyGameAction";
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

  it("self-heals an existing save with oversized rival full-player alumni", () => {
    const snapshot = snapshotWithNotifications();
    snapshot.state.notifications.items = [];
    const rival = Object.values(snapshot.state.schools).find(
      (school) => school.id !== snapshot.state.userSchoolId,
    )!;
    const template = snapshot.state.players[rival.playerIds[0]!]!;
    const alumniIds = Array.from(
      { length: MAX_RIVAL_ALUMNI_PER_SCHOOL + 5 },
      (_, index) => playerId(`legacy-rival-alumni-${index}`),
    );

    for (const id of alumniIds) {
      snapshot.state.players[id] = {
        ...structuredClone(template),
        id,
        career: { ...template.career, schoolId: rival.id },
      };
    }
    snapshot.state.schools[rival.id] = {
      ...rival,
      alumniPlayerIds: alumniIds,
    };

    const compacted = compactGameSnapshot(snapshot);

    expect(compacted.state.schools[rival.id]!.alumniPlayerIds).toEqual(
      alumniIds.slice(-MAX_RIVAL_ALUMNI_PER_SCHOOL),
    );
    for (const id of alumniIds.slice(0, -MAX_RIVAL_ALUMNI_PER_SCHOOL)) {
      expect(compacted.state.players[id]).toBeUndefined();
    }
    for (const id of rival.playerIds) {
      expect(compacted.state.players[id]).toBeDefined();
    }
  });

  it("removes stale orphaned retired players even when alumni ids are already bounded", () => {
    const snapshot = snapshotWithNotifications();
    snapshot.state.notifications.items = [];
    const rival = Object.values(snapshot.state.schools).find(
      (school) => school.id !== snapshot.state.userSchoolId,
    )!;
    const template = snapshot.state.players[rival.playerIds[0]!]!;
    const orphanId = playerId("legacy-orphaned-rival-alumni");

    snapshot.state.players[orphanId] = {
      ...structuredClone(template),
      id: orphanId,
      career: { ...template.career, schoolId: rival.id },
    };
    expect(rival.alumniPlayerIds).not.toContain(orphanId);

    const compacted = compactGameSnapshot(snapshot);

    expect(compacted.state.players[orphanId]).toBeUndefined();
    for (const id of rival.playerIds) {
      expect(compacted.state.players[id]).toBeDefined();
    }
  });

  it("self-heals a completed match by dropping its large live event log", () => {
    const snapshot = snapshotWithNotifications();
    snapshot.state.notifications.items = [];
    const opponent = Object.values(snapshot.state.schools).find(
      (school) => school.id !== snapshot.state.userSchoolId,
    );
    if (!opponent) throw new Error("practice opponent fixture missing");

    snapshot.state.weeklySchedule.practiceMatch.scheduledOpponentId =
      opponent.id;
    snapshot.state.weeklySchedule.practiceMatch.scheduledBy = "outgoing";
    const started = applyGameAction(snapshot, { type: "advance-week" });
    const activeMatch = started.state.activeMatch;
    if (!activeMatch) throw new Error("practice match did not start");

    const completedMatch = {
      ...activeMatch,
      phase: "match-complete" as const,
      eventLog:
        activeMatch.eventLog.length > 0
          ? activeMatch.eventLog
          : [
              {
                sequence: 1,
                type: "point" as const,
                setNumber: 1,
                homeScore: 1,
                awayScore: 0,
                winnerSchoolId: activeMatch.homeSchoolId,
                detailCode: "test-point",
              },
            ],
    };
    const loaded: CloudGameSnapshot = {
      ...snapshot,
      state: {
        ...started.state,
        activeMatch: completedMatch,
      },
      teamSelection: started.teamSelection,
    };

    const compacted = compactGameSnapshot(loaded);

    expect(loaded.state.activeMatch?.eventLog.length).toBeGreaterThan(0);
    expect(compacted.state.activeMatch?.phase).toBe("match-complete");
    expect(compacted.state.activeMatch?.eventLog).toEqual([]);
  });

  it("returns the original snapshot when it is already compact", () => {
    const snapshot = snapshotWithNotifications();
    snapshot.state.notifications.items =
      snapshot.state.notifications.items.slice(-1);

    expect(compactGameSnapshot(snapshot)).toBe(snapshot);
  });
});
