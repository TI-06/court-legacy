import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { isWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { WeeklyPlan } from "../../../src/domain/training/resolveWeeklyTraining";
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
        individualAssignments: plan.individualAssignments,
      },
      officialMatchRequired: false,
    });
    expect(isWeeklyActionCompleted(advanced.state, "training")).toBe(false);
  });
});
