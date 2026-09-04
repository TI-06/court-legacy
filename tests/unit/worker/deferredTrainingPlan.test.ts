import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { isWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
} from "../../../src/domain/tournament/progressOfficialTournaments";
import type {
  TrainingResult,
  WeeklyPlan,
} from "../../../src/domain/training/resolveWeeklyTraining";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import type { GameAction } from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "deferred-training-plan-fixture",
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
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function changedPlan(snapshot: CloudGameSnapshot): WeeklyPlan {
  const currentPlan = snapshot.state.weeklySchedule.trainingPlan;
  return {
    ...currentPlan,
    individualAssignments: [
      currentPlan.individualAssignments[1]!,
      currentPlan.individualAssignments[0]!,
    ],
  };
}

describe("deferred weekly training plan", () => {
  it("saves a changed weekly plan without applying growth or completing training", () => {
    const snapshot = createSnapshot();
    const plan = changedPlan(snapshot);
    const playersBefore = structuredClone(snapshot.state.players);

    const result = applyGameAction(snapshot, {
      type: "set-training-plan",
      plan,
    } as unknown as GameAction);

    expect(result).toBeDefined();
    expect(result.state.weeklySchedule.trainingPlan).toEqual(plan);
    expect(result.state.players).toEqual(playersBefore);
    expect(isWeeklyActionCompleted(result.state, "training")).toBe(false);
  });

  it("resolves the saved training plan while advancing to the next week", () => {
    const snapshot = createSnapshot();
    const plan = changedPlan(snapshot);
    const saved = applyGameAction(snapshot, {
      type: "set-training-plan",
      plan,
    });
    const savedSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: saved.state,
      teamSelection: saved.teamSelection,
    };

    const advanced = applyGameAction(savedSnapshot, { type: "advance-week" });

    expect(advanced.state.date).not.toBe(saved.state.date);
    expect(advanced.outcome).toMatchObject({
      trainingResult: {
        teamTrainingMenuId: plan.teamTrainingMenuId,
      },
      weekAdvanced: true,
      pendingMatchPresentation: null,
    });

    const trainingResult = (
      advanced.outcome as { trainingResult: TrainingResult }
    ).trainingResult;
    const school = saved.state.schools[saved.state.userSchoolId]!;
    expect(trainingResult.individualAssignments).toHaveLength(
      school.playerIds.length,
    );
    expect(trainingResult.individualAssignments).toEqual(
      expect.arrayContaining(plan.individualAssignments),
    );
    const explicitlyAssigned = new Set(
      plan.individualAssignments.map((assignment) => assignment.playerId),
    );
    expect(
      trainingResult.individualAssignments
        .filter((assignment) => !explicitlyAssigned.has(assignment.playerId))
        .every(
          (assignment) => assignment.instructionId === "instruction.overall",
        ),
    ).toBe(true);

    expect(advanced.state.notifications.items).toHaveLength(1);
    expect(isWeeklyActionCompleted(advanced.state, "training")).toBe(false);
  });

  it("resolves training and persists its notification before an official match presentation", () => {
    const snapshot = createSnapshot();
    let officialState = {
      ...snapshot.state,
      calendar: {
        ...snapshot.state.calendar,
        weekOfYear: 9,
      },
    };
    officialState = advanceOfficialTournamentsThroughWeek(officialState);
    expect(findDueUserOfficialMatch(officialState)).not.toBeNull();
    expect(isWeeklyActionCompleted(officialState, "training")).toBe(false);

    const officialSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: officialState,
      teamSelection: autoSelectTeam({
        state: officialState,
        schoolId: officialState.userSchoolId,
      }),
    };
    const result = applyGameAction(officialSnapshot, { type: "advance-week" });

    expect(result.state.date).toBe(officialState.date);
    expect(isWeeklyActionCompleted(result.state, "training")).toBe(true);
    expect(findDueUserOfficialMatch(result.state)).toBeNull();
    expect(result.state.notifications.items).toHaveLength(1);
    expect(result.state.notifications.items[0]).toMatchObject({
      type: "training-result",
      createdGameDate: officialState.date,
      weekOfYear: officialState.calendar.weekOfYear,
    });
    expect(result.outcome).toMatchObject({
      trainingResult: {
        teamTrainingMenuId:
          officialState.weeklySchedule.trainingPlan.teamTrainingMenuId,
      },
      weekAdvanced: false,
      pendingMatchPresentation: { kind: "official" },
    });
  });
});
