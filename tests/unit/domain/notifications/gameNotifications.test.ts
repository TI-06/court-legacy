import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import type { GameDate } from "../../../../src/domain/model/identifiers";
import type { TrainingResult } from "../../../../src/domain/training/resolveWeeklyTraining";
import {
  appendNotification,
  buildTrainingResultNotification,
  markNotificationRead,
  selectHomeTrainingNotifications,
  type GameNotificationState,
  type TrainingResultNotification,
} from "../../../../src/domain/notifications/gameNotifications";

function trainingNotification(
  overrides: Partial<TrainingResultNotification> = {},
): TrainingResultNotification {
  return {
    id: "training-result:school-user:1:1:2026-04-01",
    type: "training-result",
    createdGameDate: "2026-04-01" as GameDate,
    academicYearIndex: 1,
    weekOfYear: 1,
    readAtGameDate: null,
    payload: {
      teamTrainingMenuName: "基礎練習",
      totalAbilityGrowth: 3,
      totalFatigueChange: 5,
      injuredCount: 0,
      players: [],
    },
    ...overrides,
  };
}

describe("game notifications", () => {
  it("builds a presentation-safe training result snapshot", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    const result: TrainingResult = {
      schoolId: state.userSchoolId,
      teamTrainingMenuId: state.weeklySchedule.trainingPlan.teamTrainingMenuId,
      individualAssignments:
        state.weeklySchedule.trainingPlan.individualAssignments,
      playerLogs: [
        {
          playerId,
          abilityChanges: { serve: 2, jump: 1 },
          totalAbilityGrowth: 3,
          fatigueChange: 5,
          conditionChange: -2,
          trustChange: 1,
          academicRestricted: false,
          injuryRisk: 4,
          injury: null,
          skippedReason: null,
          modifiers: [],
        },
      ],
      injuredPlayerIds: [],
      randomCursor: state.randomCursor,
    };

    const notification = buildTrainingResultNotification({
      stateBeforeTraining: state,
      result,
      data: gameData,
    });

    expect(notification.id).toBe(
      `training-result:${state.userSchoolId}:1:1:2026-04-01`,
    );
    expect(notification.payload.totalAbilityGrowth).toBe(3);
    expect(notification.payload.totalFatigueChange).toBe(5);
    expect(notification.payload.players[0]).toMatchObject({
      playerId,
      displayName: `${player.lastName} ${player.firstName}`,
      grade: player.grade,
      preferredPosition: player.preferredPosition,
      totalAbilityGrowth: 3,
      fatigueChange: 5,
      conditionChange: -2,
      trustChange: 1,
      injured: false,
      abilityChanges: { serve: 2, jump: 1 },
    });
  });

  it("deduplicates the same deterministic training notification", () => {
    const notification = trainingNotification();
    const first = appendNotification({ items: [] }, notification);
    const second = appendNotification(first, notification);

    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.id).toBe(notification.id);
  });

  it("keeps only the newest training notification", () => {
    const older = trainingNotification({
      id: "training-old",
      weekOfYear: 1,
      createdGameDate: "2026-04-01" as GameDate,
    });
    const newest = trainingNotification({
      id: "training-new",
      weekOfYear: 2,
      createdGameDate: "2026-04-08" as GameDate,
    });

    const next = appendNotification({ items: [older] }, newest);

    expect(next.items).toEqual([newest]);
  });

  it("marks an existing notification read and treats unknown ids as no-ops", () => {
    const item = trainingNotification();
    const state: GameNotificationState = { items: [item] };
    const read = markNotificationRead(state, item.id, "2026-04-08" as GameDate);

    expect(read.items[0]?.readAtGameDate).toBe("2026-04-08");
    expect(
      markNotificationRead(read, "missing", "2026-04-08" as GameDate),
    ).toEqual(read);
  });

  it("shows only the newest training result regardless of older unread state", () => {
    const olderRead = trainingNotification({
      id: "older-read",
      createdGameDate: "2026-04-01" as GameDate,
      weekOfYear: 1,
      readAtGameDate: "2026-04-02" as GameDate,
    });
    const olderUnread = trainingNotification({
      id: "older-unread",
      createdGameDate: "2026-04-08" as GameDate,
      weekOfYear: 2,
    });
    const newestRead = trainingNotification({
      id: "newest-read",
      createdGameDate: "2026-04-15" as GameDate,
      weekOfYear: 3,
      readAtGameDate: "2026-04-15" as GameDate,
    });

    expect(
      selectHomeTrainingNotifications({
        items: [olderRead, olderUnread, newestRead],
      }).map((item) => item.id),
    ).toEqual(["newest-read"]);
  });

  it("creates new games with an empty notification state", () => {
    expect(createDemoGame().notifications).toEqual({ items: [] });
  });
});
