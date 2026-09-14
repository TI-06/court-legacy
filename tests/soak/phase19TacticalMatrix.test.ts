import { runTacticalMatrix } from "../../src/dev/soak/runTacticalMatrix";

const enabled = process.env.PHASE19_TACTICAL_MATRIX_RUN === "1";
const describeMatrix = enabled ? describe : describe.skip;

if (enabled) {
  vi.setConfig({ testTimeout: 180_000 });
}

describeMatrix("Phase19-4 tactical balance matrix", () => {
  it("keeps tactics meaningful without overpowering roster strength", () => {
    const result = runTacticalMatrix({
      seed: "phase19-4-tactical-matrix",
      matchesPerSeries: 160,
    });
    const report = result.report;

    console.info(`[phase19-4-matrix] ${result.summary}`);

    expect(report.neutralWinRate).toBeGreaterThanOrEqual(0.45);
    expect(report.neutralWinRate).toBeLessThanOrEqual(0.55);

    expect(report.favorableWinRate).toBeGreaterThan(
      report.unfavorableWinRate + 0.03,
    );
    expect(report.favorableWinRate).toBeLessThan(0.65);

    for (const rate of Object.values(report.planAverageWinRates)) {
      expect(rate).toBeLessThan(0.62);
    }

    expect(report.strongerDisadvantagedWinRate).toBeGreaterThan(0.6);
    expect(report.strongerDisadvantagedWinRate).toBeGreaterThan(
      report.unfavorableWinRate,
    );

    expect(report.cpuTier3CounterWinRate).toBeGreaterThanOrEqual(
      report.cpuTier0CounterWinRate,
    );
    expect(
      Math.abs(report.cpuTier3NeutralWinRate - report.cpuTier0NeutralWinRate),
    ).toBeLessThanOrEqual(0.03);
  });
});
