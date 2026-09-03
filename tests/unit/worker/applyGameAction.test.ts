import { describe, expect, it } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { gameData } from "../../../src/app/createDemoGame";
import { isWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
import { eventId } from "../../../src/domain/model/identifiers";
import type { TrainingResultNotification } from "../../../src/domain/notifications/gameNotifications";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type {
  TrainingResult,
  WeeklyPlan,
} from "../../../src/domain/training/resolveWeeklyTraining";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  applyGameAction,
  GameRuleConflictError,
} from "../../../worker/game/applyGameAction";

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "server-action-fixture",
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
    revision: 7,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function createTrainingPlan(snapshot: CloudGameSnapshot): WeeklyPlan {
  const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
  return {
    teamTrainingMenuId: "training.spike",
    individualAssignments: [
      {
        playerId: school.playerIds[0]!,
        instructionId: "instruction.attack",
      },
      {
        playerId: school.playerIds[1]!,
        instructionId: "instruction.defense",
      },
    ],
  };
}

function trainingNotification(
  snapshot: CloudGameSnapshot,
): TrainingResultNotification {
  const state = snapshot.state;
  return {
    id: `training-result:${state.userSchoolId}:${state.yearIndex}:${state.calendar.weekOfYear}:${state.date}`,
    type: "training-result",
    createdGameDate: state.date,
    academicYearIndex: state.yearIndex,
    weekOfYear: state.calendar.weekOfYear,
    readAtGameDate: null,
    payload: {
      teamTrainingMenuName: "スパイク練習",
      totalAbilityGrowth: 0,
      totalFatigueChange: 0,
      injuredCount: 0,
      players: [],
    },
  };
}

function schedulePracticeOpponent(snapshot: CloudGameSnapshot): void {
  const opponent = Object.values(snapshot.state.schools).find(
    (school) => school.id !== snapshot.state.userSchoolId,
  );
  if (!opponent) {
    throw new Error("practice opponent fixture missing");
  }
  snapshot.state.weeklySchedule.practiceMatch.scheduledOpponentId = opponent.id;
  snapshot.state.weeklySchedule.practiceMatch.scheduledBy = "outgoing";
}

describe("applyGameAction", () => {
  it("applies training server-side, marks the weekly action, and does not mutate the snapshot", () => {
    const snapshot = createSnapshot();
    const before = structuredClone(snapshot);

    const result = applyGameAction(snapshot, {
      type: "training",
      plan: createTrainingPlan(snapshot),
    });

    expect(isWeeklyActionCompleted(result.state, "training")).toBe(true);
    expect(result.state.randomCursor).toBeGreaterThan(
      snapshot.state.randomCursor,
    );
    expect(result.outcome).toMatchObject({
      schoolId: snapshot.state.userSchoolId,
    });
    expect(snapshot).toEqual(before);
  });

  it("applies a pending shop training boost and consumes it only from the successful returned state", () => {
    const snapshot = createSnapshot();
    snapshot.state.shopEffects = {
      nextTrainingGrowthBoost: {
        percent: 20,
        remainingUses: 1,
        sourceItemId: "training-efficiency-boost",
      },
    };
    const before = structuredClone(snapshot);

    const result = applyGameAction(snapshot, {
      type: "training",
      plan: createTrainingPlan(snapshot),
    });
    const trainingResult = result.outcome as TrainingResult;

    expect(
      trainingResult.playerLogs.some((log) =>
        log.modifiers.some(
          (modifier) =>
            modifier.code === "shop-training-boost" && modifier.percent === 120,
        ),
      ),
    ).toBe(true);
    expect(result.state.shopEffects?.nextTrainingGrowthBoost).toBeUndefined();
    expect(snapshot).toEqual(before);
  });

  it("rejects a duplicate weekly training action", () => {
    const snapshot = createSnapshot();
    const first = applyGameAction(snapshot, {
      type: "training",
      plan: createTrainingPlan(snapshot),
    });
    const afterFirst: CloudGameSnapshot = {
      ...snapshot,
      state: first.state,
      teamSelection: first.teamSelection,
    };

    expect(() =>
      applyGameAction(afterFirst, {
        type: "training",
        plan: createTrainingPlan(afterFirst),
      }),
    ).toThrowError(GameRuleConflictError);
  });

  it("accepts a valid team selection and rejects an invalid duplicate player", () => {
    const snapshot = createSnapshot();
    const valid = structuredClone(snapshot.teamSelection);
    const accepted = applyGameAction(snapshot, {
      type: "team-selection",
      selection: valid,
    });

    expect(accepted.teamSelection).toEqual(valid);
    expect(accepted.teamSelection).not.toBe(valid);

    const invalid = structuredClone(snapshot.teamSelection);
    invalid.rotation[1]!.playerId = invalid.rotation[0]!.playerId;
    expect(() =>
      applyGameAction(snapshot, {
        type: "team-selection",
        selection: invalid,
      }),
    ).toThrowError(GameRuleConflictError);
  });

  it("produces the same practice-match result from the same scheduled snapshot", () => {
    const snapshot = createSnapshot();
    schedulePracticeOpponent(snapshot);
    const before = structuredClone(snapshot);

    const first = applyGameAction(snapshot, { type: "practice-match" });
    const second = applyGameAction(snapshot, { type: "practice-match" });

    expect(first).toEqual(second);
    expect(isWeeklyActionCompleted(first.state, "practice-match")).toBe(true);
    expect(first.state.activeMatch).not.toBeNull();
    expect(snapshot).toEqual(before);
  });

  it("resolves the saved training automatically when advancing the week and persists a notification", () => {
    const snapshot = createSnapshot();
    const plan = createTrainingPlan(snapshot);
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

    expect(advanced.state.date).not.toBe(snapshot.state.date);
    expect(advanced.outcome).toMatchObject({
      trainingResult: {
        teamTrainingMenuId: plan.teamTrainingMenuId,
      },
      weekAdvanced: true,
      pendingMatchPresentation: null,
    });
    expect(advanced.state.notifications.items).toHaveLength(1);
    expect(advanced.state.notifications.items[0]).toMatchObject({
      type: "training-result",
      createdGameDate: saved.state.date,
      weekOfYear: saved.state.calendar.weekOfYear,
    });
  });

  it("deduplicates a pre-seeded notification when the same week training resolves", () => {
    const snapshot = createSnapshot();
    const existing = trainingNotification(snapshot);
    const preseeded: CloudGameSnapshot = {
      ...snapshot,
      state: {
        ...snapshot.state,
        notifications: { items: [existing] },
      },
    };

    const advanced = applyGameAction(preseeded, { type: "advance-week" });

    expect(
      advanced.state.notifications.items.filter(
        (item) => item.id === existing.id,
      ),
    ).toHaveLength(1);
  });

  it("marks notifications read and keeps repeated or unknown read actions idempotent", () => {
    const snapshot = createSnapshot();
    const notification = trainingNotification(snapshot);
    const withNotification: CloudGameSnapshot = {
      ...snapshot,
      state: {
        ...snapshot.state,
        notifications: { items: [notification] },
      },
    };

    const read = applyGameAction(withNotification, {
      type: "mark-notification-read",
      notificationId: notification.id,
    } as never);
    expect(read.state.notifications.items[0]?.readAtGameDate).toBe(
      snapshot.state.date,
    );

    const readSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: read.state,
      teamSelection: read.teamSelection,
    };
    const repeated = applyGameAction(readSnapshot, {
      type: "mark-notification-read",
      notificationId: notification.id,
    } as never);
    expect(repeated.state.notifications).toEqual(read.state.notifications);

    const unknown = applyGameAction(readSnapshot, {
      type: "mark-notification-read",
      notificationId: "missing-notification",
    } as never);
    expect(unknown.state.notifications).toEqual(read.state.notifications);
  });

  it("upgrades a legal facility on the authoritative state", () => {
    const snapshot = createSnapshot();
    const schoolBefore = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const result = applyGameAction(snapshot, {
      type: "facility-upgrade",
      facility: "gym",
    });
    const schoolAfter = result.state.schools[result.state.userSchoolId]!;

    expect(schoolAfter.facilities.gym).toBe(schoolBefore.facilities.gym + 1);
    expect(schoolAfter.funds).toBeLessThan(schoolBefore.funds);
  });

  it("resolves a pending event choice using server game data", () => {
    const snapshot = createSnapshot();
    const event = [...gameData.events.values()].find(
      (candidate) => candidate.choices.length > 0,
    );
    if (!event) {
      throw new Error("event fixture missing");
    }
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const actorPlayerIds = school.playerIds.slice(0, event.actorCount);
    const choice = event.choices[0]!;
    const eventSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: {
        ...snapshot.state,
        pendingEvent: {
          eventId: eventId(event.id),
          actorPlayerIds,
          targetSchoolId: null,
          surfacedDate: snapshot.state.date,
          choiceIds: event.choices.map((candidate) => candidate.id),
          chainId: null,
          chainStage: null,
        },
      },
    };

    const result = applyGameAction(eventSnapshot, {
      type: "event-choice",
      choiceId: choice.id,
    });

    expect(result.state.pendingEvent).toBeNull();
  });
});