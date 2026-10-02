import { describe, expect, it } from "vitest";
import { createSoakSnapshot } from "../../../src/dev/soak/runBalanceSoak";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  buildJsonStatePatch,
  buildJsonStatePatchWithCollapsedRoot,
} from "../../../worker/data/statePatch";
import type { GameAction } from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";
import { compactGameSnapshot } from "../../../worker/game/compactGameSnapshot";

const NORMAL_DELTA_BYTES = 32_768;
const PREFERRED_DELTA_BYTES = 262_144;
const MAX_PATCH_OPERATIONS = 16;

function bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function nextAction(snapshot: CloudGameSnapshot): GameAction {
  const pendingEvent = snapshot.state.pendingEvent;
  if (pendingEvent) {
    const choiceId = pendingEvent.choiceIds[0];
    if (!choiceId) throw new Error("diagnostic event has no choice");
    return { type: "event-choice", choiceId };
  }

  const activeMatch = snapshot.state.activeMatch;
  if (activeMatch && activeMatch.phase !== "match-complete") {
    if (
      activeMatch.phase !== "coach-decision" ||
      activeMatch.pendingCoachCommandForSchoolId !== snapshot.state.userSchoolId
    ) {
      throw new Error(
        `diagnostic match stopped outside user decision: ${activeMatch.phase}`,
      );
    }
    return { type: "match-command", command: { type: "continue" } };
  }

  return { type: "advance-week" };
}

type Bucket = {
  actions: number;
  fullStateFallbacks: number;
  maxPatchOperations: number;
  maxPatchBytes: number;
  maxStateBytes: number;
  maxActiveMatchBytes: number;
  maxEventLogBytes: number;
  maxEventLogEvents: number;
};

function emptyBucket(): Bucket {
  return {
    actions: 0,
    fullStateFallbacks: 0,
    maxPatchOperations: 0,
    maxPatchBytes: 0,
    maxStateBytes: 0,
    maxActiveMatchBytes: 0,
    maxEventLogBytes: 0,
    maxEventLogEvents: 0,
  };
}

describe("save failure recurrence diagnostic", () => {
  it("measures real save routing across 156 weeks and repeated matches", () => {
    let snapshot = createSoakSnapshot("save-failure-recurrence");
    let completedWeeks = 0;
    let completedMatches = 0;
    let actionCount = 0;
    const maximumActions = 8_000;
    const buckets: Record<string, Bucket> = {
      "advance-week": emptyBucket(),
      "match-command": emptyBucket(),
      "event-choice": emptyBucket(),
    };

    while (completedWeeks < 156 || completedMatches < 12) {
      if (actionCount >= maximumActions) {
        throw new Error(
          `diagnostic guard exhausted: weeks=${completedWeeks} matches=${completedMatches}`,
        );
      }

      const prepared = compactGameSnapshot(snapshot);
      const action = nextAction(prepared);
      const previousDate = prepared.state.date;
      const previousMatchCount = prepared.state.history.matches.length;
      const applied = applyGameAction(prepared, action);

      const isMidMatchCommand =
        action.type === "match-command" &&
        applied.state.activeMatch?.phase !== "match-complete";
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

      const activeMatchChanged =
        prepared.state.activeMatch !== persistedState.activeMatch;
      const patch = activeMatchChanged
        ? buildJsonStatePatchWithCollapsedRoot(
            prepared.state as unknown as Record<string, unknown>,
            persistedState as unknown as Record<string, unknown>,
            "activeMatch",
          )
        : buildJsonStatePatch(prepared.state, persistedState);

      const patchBytes = bytes(patch);
      const stateBytes = bytes(persistedState);
      const preferDelta = isMidMatchCommand;
      const fullStateFallback =
        patch.length > MAX_PATCH_OPERATIONS ||
        (preferDelta
          ? patchBytes > PREFERRED_DELTA_BYTES
          : patchBytes > NORMAL_DELTA_BYTES);

      const bucket = buckets[action.type] ?? (buckets[action.type] = emptyBucket());
      bucket.actions += 1;
      if (fullStateFallback) bucket.fullStateFallbacks += 1;
      bucket.maxPatchOperations = Math.max(
        bucket.maxPatchOperations,
        patch.length,
      );
      bucket.maxPatchBytes = Math.max(bucket.maxPatchBytes, patchBytes);
      bucket.maxStateBytes = Math.max(bucket.maxStateBytes, stateBytes);

      const activeMatch = persistedState.activeMatch;
      if (activeMatch) {
        bucket.maxActiveMatchBytes = Math.max(
          bucket.maxActiveMatchBytes,
          bytes(activeMatch),
        );
        bucket.maxEventLogBytes = Math.max(
          bucket.maxEventLogBytes,
          bytes(activeMatch.eventLog),
        );
        bucket.maxEventLogEvents = Math.max(
          bucket.maxEventLogEvents,
          activeMatch.eventLog.length,
        );
      }

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

    const report = {
      completedWeeks,
      completedMatches,
      actionCount,
      finalRevision: snapshot.revision,
      finalStateBytes: bytes(snapshot.state),
      finalSnapshotBytes: bytes(snapshot),
      buckets,
    };
    console.log("SAVE_RECURRENCE_DIAGNOSTIC", JSON.stringify(report));

    expect(completedWeeks).toBeGreaterThanOrEqual(156);
    expect(completedMatches).toBeGreaterThanOrEqual(12);
  }, 120_000);
});
