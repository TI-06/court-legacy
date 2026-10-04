import { describe, expect, it } from "vitest";
import { runBalanceSoak } from "../../../src/dev/soak/runBalanceSoak";

describe("Phase57 pacing audit", () => {
  it("measures progression density without writing new game state", () => {
    const result = runBalanceSoak({
      seed: "phase57-pacing-audit",
      preset: "smoke",
    });

    const { pacing, metadata } = result.report;

    expect(metadata.completedWeeks).toBeGreaterThan(0);
    expect(pacing.progressionActions).toBeGreaterThanOrEqual(
      metadata.completedWeeks,
    );
    expect(pacing.averageProgressionActionsPerWeek).toBeGreaterThanOrEqual(1);
    expect(pacing.maxProgressionActionsInWeek).toBeGreaterThanOrEqual(1);
    expect(pacing.interactiveWeeks).toBeLessThanOrEqual(
      metadata.completedWeeks,
    );
    expect(pacing.quietWeeks).toBeLessThanOrEqual(metadata.completedWeeks);
    expect(pacing.longestQuietWeekStreak).toBeLessThanOrEqual(
      pacing.quietWeeks,
    );
    expect(result.summary).toContain("pacing=avg");
  });
});
