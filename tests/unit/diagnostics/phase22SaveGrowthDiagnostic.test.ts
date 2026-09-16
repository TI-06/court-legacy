import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  advanceSoakUntilWeekChanges,
  createSoakSnapshot,
} from "../../../src/dev/soak/runBalanceSoak";
import type { GameState } from "../../../src/domain/model/GameState";
import {
  decodeGameState,
  encodeGameState,
} from "../../../src/persistence/gameStateCodec";

interface DiagnosticPoint {
  week: number;
  date: string;
  yearIndex: number;
  revision: number;
  actionCount: number;
  stateBytes: number;
  snapshotBytes: number;
  estimatedOperationResponseBytes: number;
  cumulativeEstimatedOperationBytes: number;
  history: {
    matches: number;
    graduates: number;
    officialTournaments: number;
    playerDevelopmentWeeks: number;
    relationshipLegacyHistory: number;
    seasonGoalSeasons: number;
  };
  topLevelStateBytes: Record<string, number>;
}

function bytes(value: unknown): number {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? 0 : Buffer.byteLength(serialized, "utf8");
}

function topLevelStateBytes(state: GameState): Record<string, number> {
  return Object.fromEntries(
    Object.entries(state)
      .map(([key, value]) => [key, bytes(value)] as const)
      .sort((left, right) => right[1] - left[1]),
  );
}

describe("Phase22 save growth diagnostic", () => {
  it("captures 156 weeks of snapshot growth and preserves codec round-tripping", () => {
    let snapshot = createSoakSnapshot("phase22-save-growth");
    let totalActions = 0;
    let cumulativeEstimatedOperationBytes = 0;
    const points: DiagnosticPoint[] = [];

    const capture = (week: number, actionCount: number) => {
      const stateBytes = bytes(snapshot.state);
      const snapshotBytes = bytes(snapshot);
      const estimatedOperationResponseBytes = snapshotBytes;
      cumulativeEstimatedOperationBytes +=
        actionCount * estimatedOperationResponseBytes;
      const history = snapshot.state.history;
      points.push({
        week,
        date: snapshot.state.date,
        yearIndex: snapshot.state.yearIndex,
        revision: snapshot.revision,
        actionCount: totalActions,
        stateBytes,
        snapshotBytes,
        estimatedOperationResponseBytes,
        cumulativeEstimatedOperationBytes,
        history: {
          matches: history.matches.length,
          graduates: history.graduates.length,
          officialTournaments: history.officialTournaments.length,
          playerDevelopmentWeeks: history.playerDevelopmentWeeks.length,
          relationshipLegacyHistory: history.relationshipLegacyHistory.length,
          seasonGoalSeasons: history.seasonGoalSeasons?.length ?? 0,
        },
        topLevelStateBytes: topLevelStateBytes(snapshot.state),
      });
    };

    capture(0, 0);
    for (let week = 1; week <= 156; week += 1) {
      const advanced = advanceSoakUntilWeekChanges(snapshot);
      snapshot = advanced.snapshot;
      totalActions += advanced.actionCount;
      if (week % 13 === 0 || week === 1 || week === 156) {
        capture(week, advanced.actionCount);
      } else {
        cumulativeEstimatedOperationBytes +=
          advanced.actionCount * bytes(snapshot);
      }
    }

    const encoded = encodeGameState(snapshot.state);
    const decoded = decodeGameState(encoded);
    const reencoded = encodeGameState(decoded);

    mkdirSync(".phase22-diagnostics", { recursive: true });
    writeFileSync(
      ".phase22-diagnostics/save-growth.json",
      `${JSON.stringify({ totalActions, points }, null, 2)}\n`,
      "utf8",
    );

    expect(points.at(-1)?.week).toBe(156);
    expect(decoded.date).toBe(snapshot.state.date);
    expect(decoded.yearIndex).toBe(snapshot.state.yearIndex);
    expect(reencoded).toBe(encoded);
  }, 20_000);
});
