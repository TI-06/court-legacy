import { describe, expect, it } from "vitest";
import { createSoakSnapshot } from "../../../src/dev/soak/runBalanceSoak";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  applyJsonStatePatch,
  buildJsonStatePatch,
  collapseJsonStatePatchRoot,
  compactJsonStatePatchForPersistence,
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
    if (!choiceId) {
      throw new Error("pending endurance event has no choice");
    }
    return { type: "event-choice", choiceId };
  }

  const activeMatch = snapshot.state.activeMatch;
  if (activeMatch && activeMatch.phase !== "match-complete") {
    if (
      activeMatch.phase !== "coach-decision" ||
      activeMatch.pendingCoachCommandForSchoolId !== snapshot.state.userSchoolId
    ) {
      throw new Error(
        `endurance match stopped outside user decision: ${activeMatch.phase}`,
      );
    }
    return { type: "match-command", command: { type: "continue" } };
  }

  return { type: "advance-week" };
}

describe("phase40 long-session save endurance", () => {
  it("keeps every save reconstructable and routable across 104 weeks and repeated matches", () => {
    let snapshot = createSoakSnapshot("phase40-save-endurance-104-weeks");
    let completedWeeks = 0;
    let completedMatches = 0;
    let actionCount = 0;
    let midMatchCommands = 0;
    let deltaEligibleOperations = 0;
    let fullStateFallbackOperations = 0;
    let rawFullStateFallbackOperations = 0;
    let largestPatchOperations = 0;
    let largestPatchBytes = 0;
    let largestCompactedPatchOperations = 0;
    let largestCompactedPatchBytes = 0;
    const maximumActions = 4_000;

    while (completedWeeks < 104 || completedMatches < 6) {
      if (actionCount >= maximumActions) {
        throw new Error(
          `endurance guard exhausted: weeks=${completedWeeks} matches=${completedMatches}`,
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
      const rawPatch = buildJsonStatePatch(prepared.state, applied.state);
      const patch = isMidMatchCommand
        ? collapseJsonStatePatchRoot(
            applied.state as unknown as Record<string, unknown>,
            rawPatch,
            "activeMatch",
          )
        : rawPatch;

      const reconstructed = applyJsonStatePatch(prepared.state, patch);
      expect(reconstructed).toEqual(applied.state);

      const patchBytes = JSON.stringify(patch).length;
      const rawUsesFullStateFallback =
        patch.length > MAX_JSON_PATCH_OPERATIONS ||
        (!isMidMatchCommand && patchBytes > MAX_JSON_PATCH_BYTES);
      if (rawUsesFullStateFallback) {
        rawFullStateFallbackOperations += 1;
      }

      const compactedPatch = compactJsonStatePatchForPersistence(
        applied.state as unknown as Record<string, unknown>,
        patch,
        MAX_JSON_PATCH_OPERATIONS,
      );
      expect(applyJsonStatePatch(prepared.state, compactedPatch)).toEqual(
        applied.state,
      );
      const compactedPatchBytes = JSON.stringify(compactedPatch).length;
      const usesFullStateFallback =
        compactedPatch.length > MAX_JSON_PATCH_OPERATIONS ||
        (!isMidMatchCommand && compactedPatchBytes > MAX_JSON_PATCH_BYTES);

      if (usesFullStateFallback) {
        fullStateFallbackOperations += 1;
      } else {
        deltaEligibleOperations += 1;
      }

      if (isMidMatchCommand) {
        midMatchCommands += 1;
        expect(
          patch.filter((operation) => operation.path[0] === "activeMatch"),
        ).toHaveLength(1);
        expect(patch.length).toBeLessThanOrEqual(MAX_JSON_PATCH_OPERATIONS);
      }

      largestPatchOperations = Math.max(largestPatchOperations, patch.length);
      largestPatchBytes = Math.max(largestPatchBytes, patchBytes);
      largestCompactedPatchOperations = Math.max(
        largestCompactedPatchOperations,
        compactedPatch.length,
      );
      largestCompactedPatchBytes = Math.max(
        largestCompactedPatchBytes,
        compactedPatchBytes,
      );

      const nextSnapshot: CloudGameSnapshot = {
        ...prepared,
        revision: prepared.revision + 1,
        state: applied.state,
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

    expect(completedWeeks).toBeGreaterThanOrEqual(104);
    expect(completedMatches).toBeGreaterThanOrEqual(6);
    expect(midMatchCommands).toBeGreaterThan(0);
    expect(deltaEligibleOperations).toBeGreaterThan(0);
    expect(rawFullStateFallbackOperations).toBeGreaterThan(0);
    expect(fullStateFallbackOperations).toBeLessThan(
      rawFullStateFallbackOperations,
    );
    expect(actionCount).toBeLessThan(maximumActions);
    expect(largestPatchOperations).toBeGreaterThan(MAX_JSON_PATCH_OPERATIONS);
    expect(largestPatchBytes).toBeGreaterThan(0);
    expect(largestCompactedPatchOperations).toBeLessThanOrEqual(
      largestPatchOperations,
    );
    expect(largestCompactedPatchBytes).toBeGreaterThan(0);
  }, 60_000);
});
