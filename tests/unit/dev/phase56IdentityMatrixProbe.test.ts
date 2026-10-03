import { describe, expect, it, vi } from "vitest";
import { runTeamIdentityMatrix } from "../../../src/dev/soak/runTeamIdentityMatrix";

vi.setConfig({ testTimeout: 180_000 });

describe("Phase56 temporary identity matrix probe", () => {
  it("prints the fast balance matrix probe", () => {
    const result = runTeamIdentityMatrix({
      seed: "phase56-team-identity-matrix",
      matchesPerSeries: 40,
    });

    console.info(`[phase56-identity-matrix-probe] ${result.summary}`);

    expect(result.report.masteredWinRateDelta).toBeGreaterThan(0);
    expect(result.report.masteredWinRateDelta).toBeLessThanOrEqual(0.05);
    expect(
      Math.abs(result.report.mismatchedMasteredWinRate),
    ).toBeLessThanOrEqual(0.015);
    expect(result.report.strongerOpponentWinRate).toBeLessThan(0.4);
  });
});
