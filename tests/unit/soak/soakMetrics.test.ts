import { createSoakSnapshot } from "../../../src/dev/soak/runBalanceSoak";

const subjectPath = "../../../src/dev/soak/soakMetrics";

interface Distribution {
  count: number;
  min: number;
  p50: number;
  p90: number;
  max: number;
  mean: number;
}

interface SnapshotMetrics {
  seed: string;
  yearIndex: number;
  date: string;
  userFunds: number;
  yearlyIncome: number;
  yearlyExpense: number;
  userStrength: number;
  cpuStrength: Distribution;
  playerAbility: Distribution;
  injuredPlayers: number;
  condition: Distribution;
  facilities: Record<string, number>;
  assistantCoach: { rank: string; specialty: string | null } | null;
  tournamentSummaryCount: number;
  userNationalTitles: number;
  playerTierCounts: Record<string, number>;
  growthTypeCounts: Record<string, number>;
  positionCounts: Record<string, number>;
}

interface MetricsSubject {
  captureSoakSnapshotMetrics(
    snapshot: ReturnType<typeof createSoakSnapshot>,
  ): SnapshotMetrics;
  formatSoakSnapshotSummary(metrics: SnapshotMetrics): string;
}

async function loadSubject(): Promise<MetricsSubject> {
  return (await import(subjectPath)) as MetricsSubject;
}

describe("Phase18 soak balance metrics", () => {
  it(
    "captures deterministic financial, strength, ability and facility evidence",
    async () => {
      const { captureSoakSnapshotMetrics } = await loadSubject();
      const snapshot = createSoakSnapshot("phase18-metrics-seed");

      const first = captureSoakSnapshotMetrics(snapshot);
      const second = captureSoakSnapshotMetrics(snapshot);

      expect(first).toEqual(second);
      expect(first.seed).toBe("phase18-metrics-seed");
      expect(first.userFunds).toBeGreaterThanOrEqual(0);
      expect(first.userStrength).toBeGreaterThan(0);
      expect(first.cpuStrength.count).toBeGreaterThan(0);
      expect(first.playerAbility.count).toBeGreaterThan(0);
      expect(first.condition.count).toBeGreaterThan(0);
      expect(Object.keys(first.facilities).sort()).toHaveLength(8);
    },
  );

  it(
    "keeps stable sorted categorical counts for player balance inspection",
    async () => {
      const { captureSoakSnapshotMetrics } = await loadSubject();
      const snapshot = createSoakSnapshot("phase18-metrics-counts");
      const metrics = captureSoakSnapshotMetrics(snapshot);

      expect(Object.keys(metrics.playerTierCounts)).toEqual(
        [...Object.keys(metrics.playerTierCounts)].sort(),
      );
      expect(Object.keys(metrics.growthTypeCounts)).toEqual(
        [...Object.keys(metrics.growthTypeCounts)].sort(),
      );
      expect(Object.keys(metrics.positionCounts)).toEqual(
        [...Object.keys(metrics.positionCounts)].sort(),
      );
    },
  );

  it(
    "derives annual income and expense from the authoritative funds ledger",
    async () => {
      const { captureSoakSnapshotMetrics } = await loadSubject();
      const snapshot = createSoakSnapshot("phase18-metrics-ledger");
      const year = snapshot.state.yearIndex;
      snapshot.state.schoolManagement.fundsHistory.push(
        {
          id: "soak-income",
          gameDate: snapshot.state.date,
          academicYearIndex: year,
          kind: "annual-budget",
          amount: 120,
          balanceAfter: 820,
          label: "test income",
        },
        {
          id: "soak-expense",
          gameDate: snapshot.state.date,
          academicYearIndex: year,
          kind: "facility-upgrade",
          amount: -45,
          balanceAfter: 775,
          label: "test expense",
        },
      );

      const metrics = captureSoakSnapshotMetrics(snapshot);

      expect(metrics.yearlyIncome).toBeGreaterThanOrEqual(120);
      expect(metrics.yearlyExpense).toBeGreaterThanOrEqual(45);
    },
  );

  it("formats a concise human-readable per-seed summary", async () => {
    const { captureSoakSnapshotMetrics, formatSoakSnapshotSummary } =
      await loadSubject();
    const metrics = captureSoakSnapshotMetrics(
      createSoakSnapshot("phase18-summary-seed"),
    );

    const summary = formatSoakSnapshotSummary(metrics);

    expect(summary).toContain("phase18-summary-seed");
    expect(summary).toMatch(/funds/i);
    expect(summary).toMatch(/strength/i);
    expect(summary).toMatch(/injured/i);
  });
});
