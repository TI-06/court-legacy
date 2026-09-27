import { describe, expect, it } from "vitest";
import { createSoakSnapshot } from "../../../src/dev/soak/runBalanceSoak";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  applyJsonStatePatch,
  buildJsonStatePatch,
  collapseJsonStatePatchRoot,
} from "../../../worker/data/statePatch";
import type { GameAction } from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";

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
  it("reconstructs every save delta across more than half a season and at least three matches", () => {
    let snapshot = createSoakSnapshot("phase40-save-endurance");
    let completedWeeks = 0;
    let completedMatches = 0;
    let actionCount = 0;
    let midMatchCommands = 0;
    let largestPatchOperations = 0;
    const maximumActions = 1200;

    while (completedWeeks < 32 || completedMatches < 3) {
      if (actionCount >= maximumActions) {
        throw new Error(
          `endurance guard exhausted: weeks=${completedWeeks} matches=${completedMatches}`,
        );
      }

      const action = nextAction(snapshot);
      const previousDate = snapshot.state.date;
      const previousMatchCount = snapshot.state.history.matches.length;
      const applied = applyGameAction(snapshot, action);
      const isMidMatchCommand =
        action.type === "match-command" &&
        applied.state.activeMatch?.phase !== "match-complete";
      const rawPatch = buildJsonStatePatch(snapshot.state, applied.state);
      const patch = isMidMatchCommand
        ? collapseJsonStatePatchRoot(
            applied.state as unknown as Record<string, unknown>,
            rawPatch,
            "activeMatch",
          )
        : rawPatch;

      const reconstructed = applyJsonStatePatch(snapshot.state, patch);
      expect(reconstructed).toEqual(applied.state);

      if (isMidMatchCommand) {
        midMatchCommands += 1;
        expect(
          patch.filter((operation) => operation.path[0] === "activeMatch"),
        ).toHaveLength(1);
      }

      largestPatchOperations = Math.max(largestPatchOperations, patch.length);
      const nextSnapshot: CloudGameSnapshot = {
        ...snapshot,
        revision: snapshot.revision + 1,
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

    expect(completedWeeks).toBeGreaterThanOrEqual(32);
    expect(completedMatches).toBeGreaterThanOrEqual(3);
    expect(midMatchCommands).toBeGreaterThan(0);
    expect(actionCount).toBeLessThan(maximumActions);
    expect(largestPatchOperations).toBeGreaterThan(0);
  });
});
