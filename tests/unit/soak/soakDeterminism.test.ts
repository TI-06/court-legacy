const subjectPath = "../../../src/dev/soak/runBalanceSoak";

vi.setConfig({ testTimeout: 15_000 });

interface YearlyMetrics {
  academicYearIndex: number;
  fundsStart: number;
  fundsEnd: number;
  fundsMin: number;
  fundsMax: number;
  zeroFundWeeks: number;
  yearlyGrowthTotal: number;
  intakeCount: number;
  injuredPlayerWeeks: number;
  newInjuries: number;
  healedInjuries: number;
  facilities: Record<string, number>;
  assistantCoach: {
    rank: string;
    specialty: string | null;
    contractYearIndex: number;
  } | null;
}

interface FacilityProgress {
  maxObservedLevel: number;
  firstYearByLevel: Record<string, number>;
}

interface FacilityMilestones {
  facilityMaxLevel: number;
  byFacility: Record<string, FacilityProgress>;
}

interface RunResult {
  snapshot: {
    state: {
      seed: string;
      yearIndex: number;
      pendingEvent: unknown;
      activeMatch: { phase: string } | null;
    };
  };
  report: {
    metadata: {
      seed: string;
      preset: string;
      targetSeasons: number;
      completedSeasons: number;
      completedWeeks: number;
      actions: number;
      schemaVersion: number;
    };
    yearly: YearlyMetrics[];
    facilityMilestones: FacilityMilestones;
    observations: unknown[];
  };
  summary: string;
}

interface RunnerSubject {
  SOAK_PRESETS: Record<"smoke" | "short" | "balance" | "long", number>;
  runBalanceSoak(options: {
    seed: string;
    preset: "smoke" | "short" | "balance" | "long";
  }): RunResult;
}

async function loadSubject(): Promise<RunnerSubject> {
  return (await import(subjectPath)) as RunnerSubject;
}

describe("Phase18 deterministic multi-season soak runner", () => {
  it("publishes the approved 1/3/10/30 season presets", async () => {
    const { SOAK_PRESETS } = await loadSubject();

    expect(SOAK_PRESETS).toEqual({
      smoke: 1,
      short: 3,
      balance: 10,
      long: 30,
    });
  });

  it("reproduces the same one-season material report for the same seed", async () => {
    const { runBalanceSoak } = await loadSubject();

    const first = runBalanceSoak({
      seed: "phase18-deterministic",
      preset: "smoke",
    });
    const second = runBalanceSoak({
      seed: "phase18-deterministic",
      preset: "smoke",
    });
    const firstYear = first.report.yearly[0]!;

    expect(first.report).toEqual(second.report);
    expect(first.summary).toBe(second.summary);
    expect(first.report.metadata.completedSeasons).toBe(1);
    expect(first.report.metadata.completedWeeks).toBeGreaterThan(0);
    expect(first.report.metadata.actions).toBeGreaterThan(0);
    expect(first.report.metadata.schemaVersion).toBe(8);
    expect(first.report.facilityMilestones.facilityMaxLevel).toBe(50);
    expect(Object.keys(first.report.facilityMilestones.byFacility).length).toBe(
      8,
    );
    expect(firstYear.assistantCoach).toEqual({
      rank: "intermediate",
      specialty: "attack",
      contractYearIndex: 1,
    });
    expect(first.report.facilityMilestones.byFacility.gym!.maxObservedLevel).toBeGreaterThanOrEqual(
      1,
    );
    expect(first.summary).toMatch(/facilit/i);
    expect(first.summary).toContain("coach=intermediate/attack");
  });

  it("tracks the completed academic year instead of reporting the new rollover year", async () => {
    const { runBalanceSoak } = await loadSubject();
    const result = runBalanceSoak({
      seed: "phase18-yearly-tracking",
      preset: "smoke",
    });
    const year = result.report.yearly[0]!;

    expect(year.academicYearIndex).toBe(result.snapshot.state.yearIndex - 1);
    expect(year.fundsStart).toBe(700);
    expect(year.fundsMin).toBeLessThanOrEqual(year.fundsStart);
    expect(year.fundsMax).toBeGreaterThanOrEqual(year.fundsStart);
    expect(year.fundsMin).toBeLessThanOrEqual(year.fundsEnd);
    expect(year.fundsMax).toBeGreaterThanOrEqual(year.fundsEnd);
    expect(year.zeroFundWeeks).toBeGreaterThanOrEqual(0);
    expect(year.yearlyGrowthTotal).toBeGreaterThan(0);
    expect(year.intakeCount).toBeGreaterThan(0);
    expect(year.injuredPlayerWeeks).toBeGreaterThanOrEqual(0);
    expect(year.newInjuries).toBeGreaterThanOrEqual(0);
    expect(year.healedInjuries).toBeGreaterThanOrEqual(0);
  });

  it("changes at least one tracked material result for a different seed", async () => {
    const { runBalanceSoak } = await loadSubject();

    const first = runBalanceSoak({ seed: "phase18-seed-a", preset: "smoke" });
    const second = runBalanceSoak({ seed: "phase18-seed-b", preset: "smoke" });

    expect(JSON.stringify(first.report.yearly)).not.toBe(
      JSON.stringify(second.report.yearly),
    );
  });

  it("completes the fast three-season regression without leaving a blocking interaction", async () => {
    const { runBalanceSoak } = await loadSubject();

    const result = runBalanceSoak({
      seed: "phase18-short-regression",
      preset: "short",
    });

    expect(result.report.metadata.targetSeasons).toBe(3);
    expect(result.report.metadata.completedSeasons).toBe(3);
    expect(result.report.yearly).toHaveLength(3);
    expect(result.snapshot.state.pendingEvent).toBeNull();
    expect(
      result.snapshot.state.activeMatch === null ||
        result.snapshot.state.activeMatch.phase === "match-complete",
    ).toBe(true);
    expect(result.summary).toContain("phase18-short-regression");
  });
});
