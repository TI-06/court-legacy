import { spawnSync } from "node:child_process";

interface DistributionReport {
  seasons: number;
  rootOccurrences: number;
  chainStageOccurrences: number;
  uniqueRootEvents: number;
  maximumRootShare: number;
  categoryCounts: Record<string, number>;
}

function runReport(): { output: string; report: DistributionReport } {
  const result = spawnSync(
    process.execPath,
    ["scripts/event-distribution-report.mjs", "--json"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  expect(result.status, result.stderr).toBe(0);
  return {
    output: result.stdout,
    report: JSON.parse(result.stdout) as DistributionReport,
  };
}

describe("1000-season event distribution report", () => {
  it("is deterministic, broad, and free from dominant root events", () => {
    const first = runReport();
    const second = runReport();

    expect(second.output).toBe(first.output);
    expect(first.report.seasons).toBe(1000);
    expect(first.report.rootOccurrences).toBe(17_000);
    expect(first.report.chainStageOccurrences).toBeGreaterThan(500);
    expect(first.report.uniqueRootEvents).toBeGreaterThanOrEqual(130);
    expect(first.report.maximumRootShare).toBeLessThan(0.04);
    expect(
      Object.values(first.report.categoryCounts).every((count) => count > 0),
    ).toBe(true);
  });
});
