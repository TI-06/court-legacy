import { describe, expect, it, vi } from "vitest";
import { runTeamIdentityMatrix } from "../../src/dev/soak/runTeamIdentityMatrix";

const enabled = process.env.PHASE56_IDENTITY_MATRIX_RUN === "1";
const describeMatrix = enabled ? describe : describe.skip;

if (enabled) {
  vi.setConfig({ testTimeout: 180_000 });
}

describeMatrix("Phase56 team identity balance matrix", () => {
  it("keeps mastery meaningful but smaller than roster strength", () => {
    const result = runTeamIdentityMatrix({
      seed: "phase56-team-identity-matrix",
      matchesPerSeries: 2_000,
    });
    const report = result.report;

    console.info(`[phase56-identity-matrix] ${result.summary}`);

    expect(report.masteredWinRateDelta).toBeGreaterThan(0);
    expect(report.masteredWinRateDelta).toBeLessThanOrEqual(0.05);

    expect(Math.abs(report.mismatchedMasteredWinRate)).toBeLessThanOrEqual(
      0.015,
    );

    expect(report.strongerOpponentWinRate).toBeLessThan(0.4);
  });
});
