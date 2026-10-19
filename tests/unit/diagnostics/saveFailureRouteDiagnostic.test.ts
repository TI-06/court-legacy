import { describe, expect, it } from "vitest";
import { createSoakSnapshot } from "../../../src/dev/soak/runBalanceSoak";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import {
  buildJsonStatePatch,
  collapseJsonStatePatchRoot,
} from "../../../worker/data/statePatch";
import type { GameAction } from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";
import { compactGameSnapshot } from "../../../worker/game/compactGameSnapshot";

const MAX_JSON_PATCH_BYTES = 32_768;
const MAX_PREFERRED_JSON_PATCH_BYTES = 262_144;
const MAX_JSON_PATCH_OPERATIONS = 16;

interface SaveRoutePoint {
  actionIndex: number;
  date: string;
  revision: number;
  actionType: string;
  patchOperations: number;
  patchBytes: number;
  stateBytes: number;
  fullStateFallback: boolean;
  fallbackReason:
    "operation-count" | "patch-bytes" | "preferred-patch-bytes" | null;
  matchPhase: string | null;
  historyMatches: number;
  playerCount: number;
  graduateCount: number;
}

function bytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function nextAction(snapshot: CloudGameSnapshot): GameAction {
  const pendingEvent = snapshot.state.pendingEvent;
  if (pendingEvent) {
    const choiceId = pendingEvent.choiceIds[0];
    if (!choiceId) {
      throw new Error("pending diagnostic event has no choice");
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
        `diagnostic match stopped outside user decision: ${activeMatch.phase}`,
      );
    }
    return { type: "match-command", command: { type: "continue" } };
  }

  return { type: "advance-week" };
}

describe("save failure route diagnostic", () => {
  it("measures which long-session actions fall back to full-state persistence", () => {
    let snapshot = createSoakSnapshot("save-failure-route-156-weeks");
    let completedWeeks = 0;
    let completedMatches = 0;
    let actionIndex = 0;
    const points: SaveRoutePoint[] = [];
    const guard = 6_000;

    while (completedWeeks < 156 || completedMatches < 9) {
      if (actionIndex >= guard) {
        throw new Error(
          `save diagnostic guard exhausted: weeks=${completedWeeks} matches=${completedMatches}`,
        );
      }

      const prepared = compactGameSnapshot(snapshot);
      const action = nextAction(prepared);
      const beforeDate = prepared.state.date;
      const beforeMatches = prepared.state.history.matches.length;
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

      const activeMatchChanged =
        prepared.state.activeMatch !== persistedState.activeMatch;
      const rawPatch = activeMatchChanged
        ? collapseJsonStatePatchRoot(
            persistedState as unknown as Record<string, unknown>,
            buildJsonStatePatch(prepared.state, persistedState),
            "activeMatch",
          )
        : buildJsonStatePatch(prepared.state, persistedState);

      const patchBytes = bytes(rawPatch);
      const isMidMatchCommand =
        action.type === "match-command" &&
        persistedState.activeMatch?.phase !== "match-complete";
      const fallbackReason =
        rawPatch.length > MAX_JSON_PATCH_OPERATIONS
          ? "operation-count"
          : isMidMatchCommand && patchBytes > MAX_PREFERRED_JSON_PATCH_BYTES
            ? "preferred-patch-bytes"
            : !isMidMatchCommand && patchBytes > MAX_JSON_PATCH_BYTES
              ? "patch-bytes"
              : null;

      points.push({
        actionIndex,
        date: prepared.state.date,
        revision: prepared.revision,
        actionType: action.type,
        patchOperations: rawPatch.length,
        patchBytes,
        stateBytes: bytes(persistedState),
        fullStateFallback: fallbackReason !== null,
        fallbackReason,
        matchPhase: persistedState.activeMatch?.phase ?? null,
        historyMatches: persistedState.history.matches.length,
        playerCount: Object.keys(persistedState.players).length,
        graduateCount: persistedState.history.graduates.length,
      });

      const nextSnapshot: CloudGameSnapshot = {
        ...prepared,
        revision: prepared.revision + 1,
        state: persistedState,
        teamSelection: applied.teamSelection,
      };
      if (nextSnapshot.state.date !== beforeDate) completedWeeks += 1;
      completedMatches += Math.max(
        0,
        nextSnapshot.state.history.matches.length - beforeMatches,
      );
      snapshot = nextSnapshot;
      actionIndex += 1;
    }

    const full = points.filter((point) => point.fullStateFallback);
    const byAction = Object.fromEntries(
      [...new Set(points.map((point) => point.actionType))].map(
        (actionType) => {
          const actionPoints = points.filter(
            (point) => point.actionType === actionType,
          );
          return [
            actionType,
            {
              total: actionPoints.length,
              fullStateFallbacks: actionPoints.filter(
                (point) => point.fullStateFallback,
              ).length,
              maxPatchOperations: Math.max(
                ...actionPoints.map((point) => point.patchOperations),
              ),
              maxPatchBytes: Math.max(
                ...actionPoints.map((point) => point.patchBytes),
              ),
              maxStateBytes: Math.max(
                ...actionPoints.map((point) => point.stateBytes),
              ),
            },
          ];
        },
      ),
    );

    const largestFallbacks = [...full]
      .sort(
        (left, right) =>
          right.stateBytes - left.stateBytes ||
          right.patchBytes - left.patchBytes,
      )
      .slice(0, 20);

    const diagnostic = {
      completedWeeks,
      completedMatches,
      actionCount: points.length,
      fullStateFallbackCount: full.length,
      fullStateFallbackRate:
        points.length === 0 ? 0 : full.length / points.length,
      maxStateBytes: Math.max(...points.map((point) => point.stateBytes)),
      maxPatchBytes: Math.max(...points.map((point) => point.patchBytes)),
      maxPatchOperations: Math.max(
        ...points.map((point) => point.patchOperations),
      ),
      byAction,
      largestFallbacks,
    };

    const compactDiagnostic = {
      completedWeeks: diagnostic.completedWeeks,
      completedMatches: diagnostic.completedMatches,
      actionCount: diagnostic.actionCount,
      fullStateFallbackCount: diagnostic.fullStateFallbackCount,
      fullStateFallbackRate: diagnostic.fullStateFallbackRate,
      maxStateBytes: diagnostic.maxStateBytes,
      maxPatchBytes: diagnostic.maxPatchBytes,
      maxPatchOperations: diagnostic.maxPatchOperations,
      byAction: diagnostic.byAction,
    };
    console.error("SAVE_ROUTE_DIAGNOSTIC", JSON.stringify(compactDiagnostic));
    throw new Error("save route diagnostic complete");

    expect(completedWeeks).toBeGreaterThanOrEqual(156);
    expect(completedMatches).toBeGreaterThanOrEqual(9);
    expect(points.length).toBeGreaterThan(0);
  }, 120_000);
});
