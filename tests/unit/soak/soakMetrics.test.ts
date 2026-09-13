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

interface MetricContext {
  academicYearIndex?: number;
  academicYear?: number;
  fundsStart?: number;
  fundsMin?: number;
  fundsMax?: number;
  zeroFundWeeks?: number;
  injuredPlayerWeeks?: number;
  newInjuries?: number;
  healedInjuries?: number;
  intakePlayerIds?: string[];
  growthTypeByPlayerId?: Record<string, string>;
  nationalParticipantStrengthValues?: number[];
  assistantCoachChanges?: number;
}

interface SnapshotMetrics {
  seed: string;
  yearIndex: number;
  academicYearIndex: number;
  academicYear: number;
  date: string;
  userFunds: number;
  fundsStart: number;
  fundsEnd: number;
  fundsMin: number;
  fundsMax: number;
  zeroFundWeeks: number;
  yearlyIncome: number;
  yearlyExpense: number;
  userStrength: number;
  cpuStrength: Distribution;
  playerAbility: Distribution;
  yearlyGrowthTotal: number;
  growthByGrowthType: Record<string, number>;
  intakeCount: number;
  intakeTierCounts: Record<string, number>;
  intakeGrowthTypeCounts: Record<string, number>;
  injuredPlayers: number;
  injuredPlayerWeeks: number;
  newInjuries: number;
  healedInjuries: number;
  condition: Distribution;
  conditionHistogram: Record<string, number>;
  facilities: Record<string, number>;
  assistantCoach: {
    rank: string;
    specialty: string | null;
    contractYearIndex: number;
  } | null;
  assistantCoachChanges: number;
  tournamentSummaryCount: number;
  userNationalTitles: number;
  userTournamentTitles: number;
  userBestTournamentRound: string | null;
  nationalParticipantStrength: Distribution;
  nationalChampionStrength: Distribution;
  playerTierCounts: Record<string, number>;
  growthTypeCounts: Record<string, number>;
  positionCounts: Record<string, number>;
}

interface MetricsSubject {
  captureSoakSnapshotMetrics(
    snapshot: ReturnType<typeof createSoakSnapshot>,
    context?: MetricContext,
  ): SnapshotMetrics;
  formatSoakSnapshotSummary(metrics: SnapshotMetrics): string;
}

async function loadSubject(): Promise<MetricsSubject> {
  return (await import(subjectPath)) as MetricsSubject;
}

describe("Phase18 soak balance metrics", () => {
  it("captures deterministic financial, strength, ability and facility evidence", async () => {
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
  });

  it("keeps stable sorted categorical counts for player balance inspection", async () => {
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
    expect(Object.keys(metrics.conditionHistogram)).toEqual([
      "0-19",
      "20-39",
      "40-59",
      "60-79",
      "80-100",
    ]);
  });

  it("derives annual income and expense from the authoritative funds ledger", async () => {
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
    snapshot.state.schools[snapshot.state.userSchoolId]!.funds = 775;

    const metrics = captureSoakSnapshotMetrics(snapshot, {
      academicYearIndex: year,
      academicYear: snapshot.state.calendar.academicYear,
      fundsStart: 700,
      fundsMin: 0,
      fundsMax: 820,
      zeroFundWeeks: 2,
    });

    expect(metrics.yearlyIncome).toBeGreaterThanOrEqual(120);
    expect(metrics.yearlyExpense).toBeGreaterThanOrEqual(45);
    expect(metrics.fundsStart).toBe(700);
    expect(metrics.fundsEnd).toBe(775);
    expect(metrics.fundsMin).toBe(0);
    expect(metrics.fundsMax).toBe(820);
    expect(metrics.zeroFundWeeks).toBe(2);
  });

  it("reports authoritative yearly growth, recruiting and injury movement", async () => {
    const { captureSoakSnapshotMetrics } = await loadSubject();
    const snapshot = createSoakSnapshot("phase18-metrics-growth");
    const userSchool = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const playerId = userSchool.playerIds[0]!;
    const player = snapshot.state.players[playerId]!;
    const year = snapshot.state.yearIndex;

    snapshot.state.history.playerDevelopmentWeeks.push({
      gameDate: snapshot.state.date,
      academicYearIndex: year,
      weekOfYear: snapshot.state.calendar.weekOfYear,
      trainingMenuId: "balanced",
      players: [
        {
          playerId,
          totalAbilityGrowth: 7,
          abilityChanges: { spike: 4, receive: 3 },
        },
      ],
    });

    const metrics = captureSoakSnapshotMetrics(snapshot, {
      academicYearIndex: year,
      intakePlayerIds: [playerId],
      injuredPlayerWeeks: 5,
      newInjuries: 2,
      healedInjuries: 1,
    });

    expect(metrics.yearlyGrowthTotal).toBe(7);
    expect(metrics.growthByGrowthType[player.growthTypeId]).toBe(7);
    expect(metrics.intakeCount).toBe(1);
    expect(metrics.intakeTierCounts[player.tier]).toBe(1);
    expect(metrics.intakeGrowthTypeCounts[player.growthTypeId]).toBe(1);
    expect(metrics.injuredPlayerWeeks).toBe(5);
    expect(metrics.newInjuries).toBe(2);
    expect(metrics.healedInjuries).toBe(1);
  });

  it("preserves growth types for players that have graduated before year-end reporting", async () => {
    const { captureSoakSnapshotMetrics } = await loadSubject();
    const snapshot = createSoakSnapshot("phase18-metrics-graduate-growth");
    const userSchool = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const playerId = userSchool.playerIds[0]!;
    const growthTypeId = snapshot.state.players[playerId]!.growthTypeId;
    const year = snapshot.state.yearIndex;

    snapshot.state.history.playerDevelopmentWeeks.push({
      gameDate: snapshot.state.date,
      academicYearIndex: year,
      weekOfYear: snapshot.state.calendar.weekOfYear,
      trainingMenuId: "balanced",
      players: [
        {
          playerId,
          totalAbilityGrowth: 9,
          abilityChanges: { spike: 5, receive: 4 },
        },
      ],
    });
    delete snapshot.state.players[playerId];
    userSchool.playerIds = userSchool.playerIds.filter((id) => id !== playerId);

    const metrics = captureSoakSnapshotMetrics(snapshot, {
      academicYearIndex: year,
      growthTypeByPlayerId: { [playerId]: growthTypeId },
    });

    expect(metrics.growthByGrowthType[growthTypeId]).toBe(9);
    expect(metrics.growthByGrowthType.unknown).toBeUndefined();
  });

  it("reports user tournament progress, national participant strength and coach lifecycle counts", async () => {
    const { captureSoakSnapshotMetrics } = await loadSubject();
    const snapshot = createSoakSnapshot("phase18-metrics-tournament");
    const state = snapshot.state;
    const userSchool = state.schools[state.userSchoolId]!;

    state.history.officialTournaments.push({
      tournamentId: "soak-national",
      academicYear: state.calendar.academicYear,
      circuit: "interhigh",
      level: "national",
      champion: {
        entrantId: `school:${state.userSchoolId}`,
        schoolId: state.userSchoolId,
        displayName: userSchool.name,
      },
      userResult: {
        qualified: true,
        bestRound: "final",
        champion: true,
      },
    });

    const metrics = captureSoakSnapshotMetrics(snapshot, {
      academicYear: state.calendar.academicYear,
      nationalParticipantStrengthValues: [48, 52, 60],
      assistantCoachChanges: 2,
    });

    expect(metrics.userTournamentTitles).toBe(1);
    expect(metrics.userBestTournamentRound).toBe("final");
    expect(metrics.nationalParticipantStrength).toEqual({
      count: 3,
      min: 48,
      p50: 52,
      p90: 60,
      max: 60,
      mean: 53.33,
    });
    expect(metrics.nationalChampionStrength.count).toBe(1);
    expect(metrics.nationalChampionStrength.mean).toBeGreaterThan(0);
    expect(metrics.assistantCoachChanges).toBe(2);
  });

  it("formats a concise human-readable per-seed summary", async () => {
    const { captureSoakSnapshotMetrics, formatSoakSnapshotSummary } =
      await loadSubject();
    const metrics = captureSoakSnapshotMetrics(
      createSoakSnapshot("phase18-summary-seed"),
    );

    const summary = formatSoakSnapshotSummary(metrics);

    expect(summary).toContain("phase18-summary-seed");
    expect(summary).toMatch(/funds/i);
    expect(summary).toMatch(/growth/i);
    expect(summary).toMatch(/tournament/i);
    expect(summary).toMatch(/injured/i);
  });
});
