import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { TrainingResult } from "../../../src/domain/training/resolveWeeklyTraining";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { gameActionRequestSchema } from "../../../worker/game/actionSchema";
import {
  applyGameAction,
  GameRuleConflictError,
} from "../../../worker/game/applyGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase14-foundation-fixture",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
  return {
    userId: "user-123",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 8,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

describe("Phase 14 player hub foundation", () => {
  it("records one authoritative development week for direct training", () => {
    const snapshot = createSnapshot();
    const result = applyGameAction(snapshot, {
      type: "training",
      plan: snapshot.state.weeklySchedule.trainingPlan,
    });
    const training = result.outcome as TrainingResult;

    expect(result.state.history.playerDevelopmentWeeks).toHaveLength(1);
    expect(result.state.history.playerDevelopmentWeeks[0]).toEqual({
      gameDate: snapshot.state.date,
      academicYearIndex: snapshot.state.yearIndex,
      weekOfYear: snapshot.state.calendar.weekOfYear,
      trainingMenuId: training.teamTrainingMenuId,
      players: training.playerLogs.map((log) => ({
        playerId: log.playerId,
        totalAbilityGrowth: log.totalAbilityGrowth,
        abilityChanges: log.abilityChanges,
      })),
    });
  });

  it("records automatic advance-week training once using the pre-advance week", () => {
    const snapshot = createSnapshot();
    const result = applyGameAction(snapshot, { type: "advance-week" });

    expect(result.state.history.playerDevelopmentWeeks).toHaveLength(1);
    expect(result.state.history.playerDevelopmentWeeks[0]).toMatchObject({
      gameDate: snapshot.state.date,
      academicYearIndex: snapshot.state.yearIndex,
      weekOfYear: snapshot.state.calendar.weekOfYear,
    });
  });

  it("updates development priorities without changing regular team selection", () => {
    const snapshot = createSnapshot();
    const players = snapshot.state.schools[
      snapshot.state.userSchoolId
    ]!.playerIds.slice(0, 3);

    const result = applyGameAction(snapshot, {
      type: "set-development-priorities",
      playerIds: players,
    });

    expect(result.state.teamPlanning.developmentPriorityPlayerIds).toEqual(
      players,
    );
    expect(result.teamSelection).toEqual(snapshot.teamSelection);
  });

  it("rejects invalid development priorities authoritatively", () => {
    const snapshot = createSnapshot();
    const first =
      snapshot.state.schools[snapshot.state.userSchoolId]!.playerIds[0]!;

    expect(() =>
      applyGameAction(snapshot, {
        type: "set-development-priorities",
        playerIds: [first, first],
      }),
    ).toThrowError(GameRuleConflictError);
  });

  it("saves and deletes a lineup preset without changing regular team selection", () => {
    const snapshot = createSnapshot();
    const saved = applyGameAction(snapshot, {
      type: "save-lineup-preset",
      slot: 1,
      name: "ベスト",
      selection: snapshot.teamSelection,
    });

    expect(saved.state.teamPlanning.savedLineups).toHaveLength(1);
    expect(saved.state.teamPlanning.savedLineups[0]).toMatchObject({
      slot: 1,
      name: "ベスト",
    });
    expect(saved.teamSelection).toEqual(snapshot.teamSelection);

    const deleted = applyGameAction(
      { ...snapshot, state: saved.state, teamSelection: saved.teamSelection },
      { type: "delete-lineup-preset", slot: 1 },
    );
    expect(deleted.state.teamPlanning.savedLineups).toEqual([]);
    expect(deleted.teamSelection).toEqual(snapshot.teamSelection);
  });

  it("rejects an invalid saved lineup authoritatively", () => {
    const snapshot = createSnapshot();
    const invalid = structuredClone(snapshot.teamSelection);
    invalid.rotation[1]!.playerId = invalid.rotation[0]!.playerId;

    expect(() =>
      applyGameAction(snapshot, {
        type: "save-lineup-preset",
        slot: 1,
        name: "invalid",
        selection: invalid,
      }),
    ).toThrowError(GameRuleConflictError);
  });

  it("accepts the new strict request shapes and rejects malformed planning payloads", () => {
    const snapshot = createSnapshot();
    const first =
      snapshot.state.schools[snapshot.state.userSchoolId]!.playerIds[0]!;

    expect(
      gameActionRequestSchema.safeParse({
        operationId: "phase14-priority",
        revision: 8,
        action: { type: "set-development-priorities", playerIds: [first] },
      }).success,
    ).toBe(true);
    expect(
      gameActionRequestSchema.safeParse({
        operationId: "phase14-preset",
        revision: 8,
        action: {
          type: "save-lineup-preset",
          slot: 1,
          name: "ベスト",
          selection: snapshot.teamSelection,
        },
      }).success,
    ).toBe(true);
    expect(
      gameActionRequestSchema.safeParse({
        operationId: "phase14-too-many",
        revision: 8,
        action: {
          type: "set-development-priorities",
          playerIds: [first, first, first, first],
        },
      }).success,
    ).toBe(false);
    expect(
      gameActionRequestSchema.safeParse({
        operationId: "phase14-bad-slot",
        revision: 8,
        action: {
          type: "delete-lineup-preset",
          slot: 4,
        },
      }).success,
    ).toBe(false);
  });
});
