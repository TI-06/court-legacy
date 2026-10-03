import { describe, expect, it } from "vitest";
import { createSoakSnapshot } from "../../../src/dev/soak/runBalanceSoak";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  applyJsonStateDelta,
  buildJsonStateDelta,
} from "../../../worker/data/stateDelta";
import {
  buildJsonStatePatch,
  buildJsonStatePatchWithCollapsedRoot,
} from "../../../worker/data/statePatch";
import type { GameAction } from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";
import { compactGameSnapshot } from "../../../worker/game/compactGameSnapshot";

const LEGACY_MAX_JSON_PATCH_BYTES = 32_768;
const LEGACY_MAX_JSON_PATCH_OPERATIONS = 16;
const MID_MATCH_MAX_JSON_PATCH_BYTES = 262_144;
const MID_MATCH_MAX_JSON_PATCH_OPERATIONS = 16;

function nextAction(snapshot: CloudGameSnapshot): GameAction {
  const pendingEvent = snapshot.state.pendingEvent;
  if (pendingEvent) {
    const choiceId = pendingEvent.choiceIds[0];
    if (!choiceId) throw new Error("pending endurance event has no choice");
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

describe("save progression endurance", () => {
  it("keeps 156 weeks reconstructable without normal-action full-state persistence", () => {
    let snapshot = createSoakSnapshot("save-progression-section-delta");
    let completedWeeks = 0;
    let actionCount = 0;
    let legacyFallbackCount = 0;
    let normalActionCount = 0;
    let midMatchActionCount = 0;
    let maximumStateBytes = 0;
    let maximumDeltaBytes = 0;
    let maximumDeltaRatio = 0;
    let maximumMidMatchPatchBytes = 0;

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
      maximumStateBytes = Math.max(maximumStateBytes, stateBytes);

      const isMidMatchCommand =
        action.type === "match-command" &&
        applied.state.activeMatch?.phase !== "match-complete";

      if (isMidMatchCommand) {
        midMatchActionCount += 1;
        maximumMidMatchPatchBytes = Math.max(
          maximumMidMatchPatchBytes,
          patchBytes,
        );
        expect(
          patch.filter((operation) => operation.path[0] === "activeMatch"),
        ).toHaveLength(1);
        expect(patch.length).toBeLessThanOrEqual(
          MID_MATCH_MAX_JSON_PATCH_OPERATIONS,
        );
        expect(patchBytes).toBeLessThanOrEqual(MID_MATCH_MAX_JSON_PATCH_BYTES);
      } else {
        normalActionCount += 1;
        if (
          patch.length > LEGACY_MAX_JSON_PATCH_OPERATIONS ||
          patchBytes > LEGACY_MAX_JSON_PATCH_BYTES
        ) {
          legacyFallbackCount += 1;
        }

        const delta = buildJsonStateDelta(
          prepared.state as unknown as Record<string, unknown>,
          applied.state as unknown as Record<string, unknown>,
        );
        const reconstructed = applyJsonStateDelta(
          prepared.state as unknown as Record<string, unknown>,
          delta,
        );
        expect(reconstructed).toEqual(applied.state);

        const deltaBytes = JSON.stringify(delta).length;
        maximumDeltaBytes = Math.max(maximumDeltaBytes, deltaBytes);
        maximumDeltaRatio = Math.max(
          maximumDeltaRatio,
          stateBytes === 0 ? 0 : deltaBytes / stateBytes,
        );
        expect(deltaBytes).toBeLessThan(stateBytes);
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

    expect(completedWeeks).toBeGreaterThanOrEqual(156);
    expect(actionCount).toBeLessThan(6_000);
    expect(normalActionCount).toBeGreaterThan(0);
    expect(midMatchActionCount).toBeGreaterThan(0);

    // This proves the regression scenario remains represented: the legacy
    // fine-grained patch strategy would still fall back to full state often.
    expect(legacyFallbackCount).toBeGreaterThan(0);

    // V5 / browser section deltas avoid thousands of leaf operations and stay
    // smaller than the full authoritative save in representative play.
    expect(maximumDeltaBytes).toBeLessThan(maximumStateBytes);
    expect(maximumDeltaRatio).toBeLessThan(0.9);
    expect(maximumMidMatchPatchBytes).toBeLessThanOrEqual(
      MID_MATCH_MAX_JSON_PATCH_BYTES,
    );
  }, 60_000);
});
