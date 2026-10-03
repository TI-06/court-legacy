import { describe, it } from "vitest";
import { createSoakSnapshot } from "../../../src/dev/soak/runBalanceSoak";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  buildJsonStatePatch,
  buildJsonStatePatchWithCollapsedRoot,
} from "../../../worker/data/statePatch";
import type { GameAction } from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";
import { compactGameSnapshot } from "../../../worker/game/compactGameSnapshot";

const MAX_JSON_PATCH_BYTES = 32_768;
const MAX_JSON_PATCH_OPERATIONS = 16;

function nextAction(snapshot: CloudGameSnapshot): GameAction {
  const pendingEvent = snapshot.state.pendingEvent;
  if (pendingEvent) {
    const choiceId = pendingEvent.choiceIds[0];
    if (!choiceId) throw new Error("pending diagnostic event has no choice");
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

describe("save progression fallback diagnostic", () => {
  it("reports which long-session actions still require full-state persistence", () => {
    let snapshot = createSoakSnapshot("save-progression-fallback-diagnostic");
    let completedWeeks = 0;
    let actionCount = 0;
    let maximumStateBytes = 0;
    const fallbackByAction = new Map<string, number>();
    const maxPatchBytesByAction = new Map<string, number>();
    const maxPatchOpsByAction = new Map<string, number>();
    const samples: Array<{
      week: number;
      action: string;
      stateBytes: number;
      patchBytes: number;
      patchOperations: number;
    }> = [];

    while (completedWeeks < 156 && actionCount < 6_000) {
      const prepared = compactGameSnapshot(snapshot);
      const action = nextAction(prepared);
      const previousDate = prepared.state.date;
      const applied = applyGameAction(prepared, action);
      const activeMatchChanged =
        prepared.state.activeMatch !== applied.state.activeMatch;
      const patch = activeMatchChanged
        ? buildJsonStatePatchWithCollapsedRoot(
            prepared.state as unknown as Record<string, unknown>,
            applied.state as unknown as Record<string, unknown>,
            "activeMatch",
          )
        : buildJsonStatePatch(prepared.state, applied.state);
      const patchBytes = JSON.stringify(patch).length;
      const stateBytes = JSON.stringify(applied.state).length;
      const key = action.type;
      maximumStateBytes = Math.max(maximumStateBytes, stateBytes);
      maxPatchBytesByAction.set(
        key,
        Math.max(maxPatchBytesByAction.get(key) ?? 0, patchBytes),
      );
      maxPatchOpsByAction.set(
        key,
        Math.max(maxPatchOpsByAction.get(key) ?? 0, patch.length),
      );

      const fullStateFallback =
        patch.length > MAX_JSON_PATCH_OPERATIONS ||
        patchBytes > MAX_JSON_PATCH_BYTES;
      if (fullStateFallback) {
        fallbackByAction.set(key, (fallbackByAction.get(key) ?? 0) + 1);
        if (samples.length < 12) {
          samples.push({
            week: completedWeeks,
            action: key,
            stateBytes,
            patchBytes,
            patchOperations: patch.length,
          });
        }
      }

      snapshot = {
        ...prepared,
        revision: prepared.revision + 1,
        state: applied.state,
        teamSelection: applied.teamSelection,
      };
      if (snapshot.state.date !== previousDate) completedWeeks += 1;
      actionCount += 1;
    }

    const summary = {
      completedWeeks,
      actionCount,
      maximumStateBytes,
      fallbackByAction: Object.fromEntries(fallbackByAction),
      maxPatchBytesByAction: Object.fromEntries(maxPatchBytesByAction),
      maxPatchOpsByAction: Object.fromEntries(maxPatchOpsByAction),
      samples,
    };

    if ([...fallbackByAction.values()].some((count) => count > 0)) {
      throw new Error(`SAVE_FALLBACK_DIAGNOSTIC ${JSON.stringify(summary)}`);
    }
  }, 60_000);
});
