import { describe, expect, it } from "vitest";
import { createSoakSnapshot } from "../../../src/dev/soak/runBalanceSoak";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  applyJsonStateDelta,
  buildJsonStateDelta,
} from "../../../worker/data/stateDelta";
import {
  buildJsonStatePatch,
  collapseJsonStatePatchRoot,
} from "../../../worker/data/statePatch";
import type { GameAction } from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";
import { compactGameSnapshot } from "../../../worker/game/compactGameSnapshot";

const LEGACY_MAX_JSON_PATCH_BYTES = 32_768;
const LEGACY_MAX_JSON_PATCH_OPERATIONS = 16;
const TARGET_WEEKS = 520;

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

describe("Phase58 V5 long-session save endurance", () => {
  it("keeps every 10-year save reconstructable through section deltas, including mid-match saves", () => {
    let snapshot = createSoakSnapshot("phase58-v5-save-endurance-10-years");
    let completedWeeks = 0;
    let completedMatches = 0;
    let actionCount = 0;
    let midMatchCommands = 0;
    let sectionDeltaOperations = 0;
    let legacyPatchFallbackCandidates = 0;
    let largestStateDeltaBytes = 0;
    let largestFullStateBytes = 0;
    let largestDeltaToStateRatio = 0;
    const maximumActions = 20_000;

    while (completedWeeks < TARGET_WEEKS) {
      if (actionCount >= maximumActions) {
        throw new Error(
          `endurance guard exhausted: weeks=${completedWeeks} matches=${completedMatches} actions=${actionCount}`,
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

      const stateDelta = buildJsonStateDelta(
        prepared.state as unknown as Record<string, unknown>,
        persistedState as unknown as Record<string, unknown>,
      );
      const reconstructed = applyJsonStateDelta(
        prepared.state as unknown as Record<string, unknown>,
        stateDelta,
      );
      expect(reconstructed).toEqual(persistedState);
      sectionDeltaOperations += 1;

      const rawPatch = buildJsonStatePatch(prepared.state, persistedState);
      const legacyPatch = isMidMatchCommand
        ? collapseJsonStatePatchRoot(
            persistedState as unknown as Record<string, unknown>,
            rawPatch,
            "activeMatch",
          )
        : rawPatch;
      const legacyPatchBytes = JSON.stringify(legacyPatch).length;
      if (
        legacyPatch.length > LEGACY_MAX_JSON_PATCH_OPERATIONS ||
        (!isMidMatchCommand &&
          legacyPatchBytes > LEGACY_MAX_JSON_PATCH_BYTES)
      ) {
        legacyPatchFallbackCandidates += 1;
      }

      const stateDeltaBytes = JSON.stringify(stateDelta).length;
      const fullStateBytes = JSON.stringify(persistedState).length;
      largestStateDeltaBytes = Math.max(
        largestStateDeltaBytes,
        stateDeltaBytes,
      );
      largestFullStateBytes = Math.max(largestFullStateBytes, fullStateBytes);
      largestDeltaToStateRatio = Math.max(
        largestDeltaToStateRatio,
        fullStateBytes === 0 ? 0 : stateDeltaBytes / fullStateBytes,
      );

      if (isMidMatchCommand) {
        midMatchCommands += 1;
        expect(stateDelta.set).toHaveProperty("activeMatch");
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

    console.info(
      [
        "[phase58-save-endurance]",
        `weeks=${completedWeeks}`,
        `actions=${actionCount}`,
        `matches=${completedMatches}`,
        `midMatch=${midMatchCommands}`,
        `sectionDelta=${sectionDeltaOperations}`,
        `legacyFallbackCandidates=${legacyPatchFallbackCandidates}`,
        `maxDeltaBytes=${largestStateDeltaBytes}`,
        `maxStateBytes=${largestFullStateBytes}`,
        `maxDeltaRatio=${largestDeltaToStateRatio.toFixed(4)}`,
      ].join(" "),
    );

    expect(completedWeeks).toBe(TARGET_WEEKS);
    expect(completedMatches).toBeGreaterThan(0);
    expect(midMatchCommands).toBeGreaterThan(0);
    expect(sectionDeltaOperations).toBe(actionCount);
    expect(legacyPatchFallbackCandidates).toBeGreaterThan(0);
    expect(actionCount).toBeLessThan(maximumActions);
    expect(largestStateDeltaBytes).toBeGreaterThan(0);
    expect(largestFullStateBytes).toBeGreaterThan(largestStateDeltaBytes);
    expect(largestDeltaToStateRatio).toBeLessThan(1);
  }, 180_000);
});
