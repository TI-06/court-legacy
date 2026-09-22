import { describe, expect, it } from "vitest";
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import type { GameDate } from "../../../../src/domain/model/identifiers";
import type { TrainingResult } from "../../../../src/domain/training/resolveWeeklyTraining";
import {
  appendNotification,
  buildDevelopmentGoalAchievementNotification,
  buildSeasonGoalAchievementNotification,
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
          socialGrowth: {
            contributions: [],
            rawPercentPoints: 0,
            appliedPercentPoints: 0,
            capped: false,
          },
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

  it("captures five-category grade transitions from exact training ability changes", () => {
    const state = createDemoGame();
    const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
    const player = state.players[playerId]!;
    player.abilities.jump = 49;
    const result: TrainingResult = {
      schoolId: state.userSchoolId,
      teamTrainingMenuId: state.weeklySchedule.trainingPlan.teamTrainingMenuId,
      individualAssignments:
        state.weeklySchedule.trainingPlan.individualAssignments,
      playerLogs: [
        {
          playerId,
          abilityChanges: { jump: 1 },
          totalAbilityGrowth: 1,
          fatigueChange: 0,
          conditionChange: 0,
          trustChange: 0,
          academicRestricted: false,
          injuryRisk: 0,
          injury: null,
          skippedReason: null,
          modifiers: [],
          socialGrowth: {
            contributions: [],
            rawPercentPoints: 0,
            appliedPercentPoints: 0,
            capped: false,
          },
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

    expect(notification.payload.players[0]?.rankUps).toEqual([
      {
        area: "jump",
        areaLabel: "跳躍",
        fromGrade: "E",
        toGrade: "D",
      },
    ]);
  });

  it("emits one notification only when development goals cross their target grades", () => {
    const before = createDemoGame();
    const school = before.schools[before.userSchoolId]!;
    const firstId = school.playerIds[0]!;
    const secondId = school.playerIds[1]!;
    before.teamPlanning.developmentGoalsByPlayerId = {
      [firstId]: { area: "jump", targetGrade: "D" },
      [secondId]: { area: "stamina", targetGrade: "E" },
    };
    before.players[firstId]!.abilities.jump = 49;
    before.players[secondId]!.abilities.stamina = 39;

    const after = structuredClone(before);
    after.players[firstId]!.abilities.jump = 50;
    after.players[secondId]!.abilities.stamina = 40;

    const notification = buildDevelopmentGoalAchievementNotification({
      stateBeforeTraining: before,
      stateAfterTraining: after,
    });

    expect(notification?.type).toBe("development-goal-achieved");
    expect(notification?.payload.items).toHaveLength(2);
    expect(notification?.payload.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: firstId,
          area: "jump",
          targetGrade: "D",
          achievedGrade: "D",
        }),
        expect.objectContaining({
          playerId: secondId,
          area: "stamina",
          targetGrade: "E",
          achievedGrade: "E",
        }),
      ]),
    );

    const alreadyAchieved = structuredClone(before);
    alreadyAchieved.players[firstId]!.abilities.jump = 50;
    const later = structuredClone(alreadyAchieved);
    later.players[firstId]!.abilities.jump = 51;
    alreadyAchieved.teamPlanning.developmentGoalsByPlayerId = {
      [firstId]: { area: "jump", targetGrade: "D" },
    };
    later.teamPlanning.developmentGoalsByPlayerId = {
      [firstId]: { area: "jump", targetGrade: "D" },
    };

    expect(
      buildDevelopmentGoalAchievementNotification({
        stateBeforeTraining: alreadyAchieved,
        stateAfterTraining: later,
      }),
    ).toBeNull();
  });

  it("notifies only when season goals cross from unmet to achieved", () => {
    const before = createDemoGame();
    const goals = before.seasonGoals!;
    const school = before.schools[before.userSchoolId]!;
    const winGoal = goals.goals.find((goal) => goal.kind === "official-wins")!;
    const tournamentGoal = goals.goals.find(
      (goal) => goal.kind === "tournament-achievement",
    )!;
    tournamentGoal.achievement = "prefectural-title";

    school.history.officialWins =
      goals.baseline.officialWins + Math.max(0, winGoal.target - 1);
    school.history.prefecturalTitles = goals.baseline.prefecturalTitles;

    const after = structuredClone(before);
    after.schools[after.userSchoolId]!.history.officialWins =
      goals.baseline.officialWins + winGoal.target;
    after.schools[after.userSchoolId]!.history.prefecturalTitles =
      goals.baseline.prefecturalTitles + 1;

    const notification = buildSeasonGoalAchievementNotification({
      stateBeforeAction: before,
      stateAfterAction: after,
    });

    expect(notification?.type).toBe("season-goal-achieved");
    expect(notification?.payload.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          goalId: winGoal.id,
          label: `公式戦${winGoal.target}勝`,
        }),
        expect.objectContaining({
          goalId: tournamentGoal.id,
          label: "県大会優勝",
        }),
      ]),
    );
    expect(notification?.payload.totalRewardFunds).toBe(
      notification?.payload.items.reduce(
        (total, item) => total + item.rewardFunds,
        0,
      ),
    );

    expect(
      buildSeasonGoalAchievementNotification({
        stateBeforeAction: after,
        stateAfterAction: structuredClone(after),
      }),
    ).toBeNull();
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

describe("Phase21 social growth notification snapshot", () => {
  it("copies the resolved social growth summary instead of retaining mutable references", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const relatedPlayerId = school.playerIds[1]!;
    const result: TrainingResult = {
      schoolId: state.userSchoolId,
      teamTrainingMenuId: state.weeklySchedule.trainingPlan.teamTrainingMenuId,
      individualAssignments:
        state.weeklySchedule.trainingPlan.individualAssignments,
      playerLogs: [
        {
          playerId,
          abilityChanges: {},
          totalAbilityGrowth: 0,
          fatigueChange: 0,
          conditionChange: 0,
          trustChange: 0,
          academicRestricted: false,
          injuryRisk: 0,
          injury: null,
          skippedReason: null,
          modifiers: [],
          socialGrowth: {
            contributions: [
              {
                code: "relationship-partner",
                label: "相棒",
                percentPoints: 3,
                relatedPlayerId,
              },
              {
                code: "relationship-mentor",
                label: "師弟",
                percentPoints: 4,
                relatedPlayerId,
              },
            ],
            rawPercentPoints: 7,
            appliedPercentPoints: 5,
            capped: true,
          },
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
    expect(notification.payload.players[0]).toMatchObject({
      socialGrowth: {
        rawPercentPoints: 7,
        appliedPercentPoints: 5,
        capped: true,
        contributions: [
          { code: "relationship-partner", label: "相棒", percentPoints: 3 },
          { code: "relationship-mentor", label: "師弟", percentPoints: 4 },
        ],
      },
    });
    result.playerLogs[0]!.socialGrowth.contributions[0]!.relatedPlayerId =
      playerId;
    expect(
      notification.payload.players[0]!.socialGrowth.contributions[0]!
        .relatedPlayerId,
    ).toBe(relatedPlayerId);
  });
});
