import { describe, expect, it } from "vitest";
import { createSoakSnapshot } from "../../../src/dev/soak/runBalanceSoak";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { applyJsonStatePatch } from "../../../worker/data/statePatch";
import type { GameAction } from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";
import { buildPersistenceStatePatch } from "../../../worker/game/buildPersistenceStatePatch";
import { compactGameSnapshot } from "../../../worker/game/compactGameSnapshot";

const MAX_DELTA_BYTES = 262_144;
const MAX_PATCH_OPERATIONS = 16;

function bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function nextAction(snapshot: CloudGameSnapshot): GameAction {
  const pendingEvent = snapshot.state.pendingEvent;
  if (pendingEvent) {
    const choiceId = pendingEvent.choiceIds[0];
    if (!choiceId) throw new Error("V5 endurance event has no choice");
    return { type: "event-choice", choiceId };
  }

  const activeMatch = snapshot.state.activeMatch;
  if (activeMatch && activeMatch.phase !== "match-complete") {
    if (
      activeMatch.phase !== "coach-decision" ||
      activeMatch.pendingCoachCommandForSchoolId !== snapshot.state.userSchoolId
    ) {
      throw new Error(
        `V5 endurance match stopped outside user decision: ${activeMatch.phase}`,
      );
    }
    return { type: "match-command", command: { type: "continue" } };
  }

  return { type: "advance-week" };
}

interface RouteMetric {
  actions: number;
  fullStateFallbacks: number;
  maximumPatchOperations: number;
  maximumPatchBytes: number;
}

function emptyMetric(): RouteMetric {
  return {
    actions: 0,
    fullStateFallbacks: 0,
    maximumPatchOperations: 0,
    maximumPatchBytes: 0,
  };
}

describe("Save Stability V5 endurance", () => {
  it("keeps the 156-week game loop on compact reconstructable deltas", () => {
    let snapshot = createSoakSnapshot("save-stability-v5-endurance");
    let completedWeeks = 0;
    let completedMatches = 0;
    let actionCount = 0;
    const maximumActions = 8_000;
    const metrics: Record<string, RouteMetric> = {
      "advance-week": emptyMetric(),
      "match-command": emptyMetric(),
      "event-choice": emptyMetric(),
    };

    while (completedWeeks < 156 || completedMatches < 12) {
      if (actionCount >= maximumActions) {
        throw new Error(
          `V5 endurance guard exhausted: weeks=${completedWeeks} matches=${completedMatches}`,
        );
      }

      const prepared = compactGameSnapshot(snapshot);
      const action = nextAction(prepared);
      const previousDate = prepared.state.date;
      const previousMatchCount = prepared.state.history.matches.length;
      const applied = applyGameAction(prepared, action);
      const persistedState =
        applied.state.activeMatch?.phase === "match-complete" &&
        applied.state.activeMatch.eventLog.length > 0
          ? {
              ...applied.state,
              activeMatch: {
                ...applied.state.activeMatch,
                eventLog: [],
              },
            }
          : applied.state;

      const patch = buildPersistenceStatePatch(prepared.state, persistedState);
      const reconstructed = applyJsonStatePatch(prepared.state, patch);
      expect(reconstructed).toEqual(persistedState);

      const patchBytes = bytes(patch);
      const usesFullState =
        patch.length > MAX_PATCH_OPERATIONS || patchBytes > MAX_DELTA_BYTES;
      const metric =
        metrics[action.type] ?? (metrics[action.type] = emptyMetric());
      metric.actions += 1;
      if (usesFullState) metric.fullStateFallbacks += 1;
      metric.maximumPatchOperations = Math.max(
        metric.maximumPatchOperations,
        patch.length,
      );
      metric.maximumPatchBytes = Math.max(metric.maximumPatchBytes, patchBytes);

      const nextSnapshot: CloudGameSnapshot = {
        ...prepared,
        revision: prepared.revision + 1,
        state: persistedState,
        teamSelection: applied.teamSelection,
      };
      if (nextSnapshot.state.date !== previousDate) {
        completedWeeks += 1;
      }
      completedMatches += Math.max(
        0,
        nextSnapshot.state.history.matches.length - previousMatchCount,
      );
      snapshot = nextSnapshot;
      actionCount += 1;
    }

    const totalFallbacks = Object.values(metrics).reduce(
      (total, metric) => total + metric.fullStateFallbacks,
      0,
    );
    const baselineFallbacks = 169 + 37 + 53;

    console.log(
      "SAVE_STABILITY_V5_ENDURANCE",
      JSON.stringify({
        completedWeeks,
        completedMatches,
        actionCount,
        totalFallbacks,
        baselineFallbacks,
        reduction:
          baselineFallbacks === 0 ? 1 : 1 - totalFallbacks / baselineFallbacks,
        metrics,
      }),
    );

    expect(completedWeeks).toBeGreaterThanOrEqual(156);
    expect(completedMatches).toBeGreaterThanOrEqual(12);
    expect(totalFallbacks).toBeLessThanOrEqual(
      Math.floor(baselineFallbacks * 0.1),
    );
    expect(metrics["event-choice"]!.fullStateFallbacks).toBeLessThanOrEqual(2);
    expect(metrics["advance-week"]!.fullStateFallbacks).toBeLessThanOrEqual(15);
  }, 120_000);
});
