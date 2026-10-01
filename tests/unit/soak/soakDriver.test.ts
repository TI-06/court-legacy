import { CURRENT_GAME_SCHEMA_VERSION } from "../../../src/domain/model/GameState";
import { captureSoakSnapshotMetrics } from "../../../src/dev/soak/soakMetrics";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";

const subjectPath = "../../../src/dev/soak/runBalanceSoak";

interface SoakDriverSubject {
  createSoakSnapshot(seed: string): CloudGameSnapshot;
  applySoakManagementPolicy(snapshot: CloudGameSnapshot): {
    snapshot: CloudGameSnapshot;
    actionCount: number;
    specialProjectIds: string[];
  };
  advanceSoakUntilWeekChanges(
    snapshot: CloudGameSnapshot,
    options?: { maxActionsPerWeek?: number },
  ): {
    snapshot: CloudGameSnapshot;
    actionCount: number;
    resolvedEvents: number;
    completedMatches: number;
  };
  buildBalanceObservations(
    yearly: readonly ReturnType<typeof captureSoakSnapshotMetrics>[],
  ): Array<{ code: string; message: string; yearIndex: number }>;
  observeSoakSpecialAbilityFlow(
    before: CloudGameSnapshot,
    after: CloudGameSnapshot,
  ): {
    normalAcquired: number;
    rareAcquired: number;
    superRareAcquired: number;
    superRareFromEvent: number;
    superRareFromMatch: number;
    superRareFromOther: number;
    negativeAcquired: number;
    negativeRecovered: number;
  };
}

async function loadSubject(): Promise<SoakDriverSubject> {
  return (await import(subjectPath)) as SoakDriverSubject;
}

describe("Phase18 soak production action driver", () => {
  it("creates a production-compatible snapshot from the requested seed", async () => {
    const { createSoakSnapshot } = await loadSubject();

    const snapshot = createSoakSnapshot("phase18-driver-seed");

    expect(snapshot.state.seed).toBe("phase18-driver-seed");
    expect(snapshot.state.schemaVersion).toBe(CURRENT_GAME_SCHEMA_VERSION);
    expect(snapshot.teamSelection.rotation).toHaveLength(6);
    expect(snapshot.state.activeMatch).toBeNull();
    expect(snapshot.state.pendingEvent).toBeNull();
  });

  it("uses production management actions to contract one annual coach and upgrade one facility per policy step", async () => {
    const { createSoakSnapshot, applySoakManagementPolicy } =
      await loadSubject();
    const before = createSoakSnapshot("phase18-management-seed");
    before.state.schools[before.state.userSchoolId]!.funds = 1000;
    const schoolBefore = before.state.schools[before.state.userSchoolId]!;
    const gymBefore = schoolBefore.facilities.gym;

    const first = applySoakManagementPolicy(before);
    const firstState = first.snapshot.state;
    const firstSchool = firstState.schools[firstState.userSchoolId]!;

    expect(first.actionCount).toBe(2);
    expect(firstState.schoolManagement.assistantCoach).toEqual({
      rank: "advanced",
      specialty: "attack",
      contractYearIndex: before.state.yearIndex,
    });
    expect(firstSchool.facilities.gym).toBe(gymBefore + 1);
    expect(firstSchool.funds).toBeLessThan(schoolBefore.funds);
    expect(firstSchool.funds).toBeGreaterThanOrEqual(300);

    const second = applySoakManagementPolicy(first.snapshot);
    expect(second.actionCount).toBe(1);
    expect(second.snapshot.state.schoolManagement.assistantCoach).toEqual(
      firstState.schoolManagement.assistantCoach,
    );
  });

  it("uses maxed facilities to exercise annual investments and two Phase51 projects without crossing the reserve", async () => {
    const { createSoakSnapshot, applySoakManagementPolicy } =
      await loadSubject();
    const snapshot = createSoakSnapshot("phase50-investment-policy");
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    school.funds = 10000;
    snapshot.state.schoolManagement.assistantCoach = {
      rank: "master",
      specialty: "attack",
      contractYearIndex: snapshot.state.yearIndex,
    };
    school.reputationPoints = 1000;
    school.history.nationalTitles = 1;
    for (const facility of Object.keys(school.facilities) as Array<
      keyof typeof school.facilities
    >) {
      school.facilities[facility] = 50;
    }

    const first = applySoakManagementPolicy(snapshot);
    const plan = first.snapshot.state.schoolManagement.investmentPlan;

    expect(first.actionCount).toBe(6);
    expect(first.specialProjectIds).toEqual([
      "national-data-bank",
      "medical-support",
    ]);
    expect(
      first.snapshot.state.schoolManagement.specialProjects
        ?.purchasedProjectIds,
    ).toEqual(["national-data-bank", "medical-support"]);
    expect(plan).toMatchObject({
      yearIndex: snapshot.state.yearIndex,
      developmentFocus: "attack",
      externalSpecialist: "attacker",
      campTier: "elite",
      scoutingTier: "national",
    });
    expect(
      first.snapshot.state.schools[first.snapshot.state.userSchoolId]!.funds,
    ).toBeGreaterThanOrEqual(300);

    const second = applySoakManagementPolicy(first.snapshot);
    expect(second.actionCount).toBe(0);
    expect(second.specialProjectIds).toEqual([]);
  });

  it("keeps the management reserve instead of spending the school below 300", async () => {
    const { createSoakSnapshot, applySoakManagementPolicy } =
      await loadSubject();
    const snapshot = createSoakSnapshot("phase18-management-reserve");
    snapshot.state.schools[snapshot.state.userSchoolId]!.funds = 300;

    const result = applySoakManagementPolicy(snapshot);
    const resultState = result.snapshot.state;
    const resultSchool = resultState.schools[resultState.userSchoolId]!;

    expect(result.actionCount).toBe(0);
    expect(resultSchool.funds).toBe(300);
    expect(resultState.schoolManagement.assistantCoach).toBeNull();
  });

  it("counts in-career special ability acquisition and negative recovery separately", async () => {
    const { createSoakSnapshot, observeSoakSpecialAbilityFlow } =
      await loadSubject();
    const before = createSoakSnapshot("phase50-special-flow");
    const after = createSoakSnapshot("phase50-special-flow");
    const playerId =
      before.state.schools[before.state.userSchoolId]!.playerIds[0]!;
    before.state.players[playerId]!.specialAbilityIds = ["serve_unstable"];
    after.state.players[playerId]!.specialAbilityIds = [
      "attack_course",
      "elite_serve_craftsman",
      "gold_commander",
    ];

    expect(observeSoakSpecialAbilityFlow(before, after)).toEqual({
      normalAcquired: 1,
      rareAcquired: 1,
      superRareAcquired: 1,
      superRareFromEvent: 0,
      superRareFromMatch: 0,
      superRareFromOther: 0,
      negativeAcquired: 0,
      negativeRecovered: 1,
    });
  });

  it("compares user strength with national contenders instead of the full CPU field", async () => {
    const { createSoakSnapshot, buildBalanceObservations } =
      await loadSubject();
    const snapshot = createSoakSnapshot("phase50-national-strength");
    const metrics = captureSoakSnapshotMetrics(snapshot, {
      nationalParticipantStrengthValues: [88, 90, 92, 94],
    });

    const normal = buildBalanceObservations([
      {
        ...metrics,
        userStrength: 94,
        cpuStrength: { ...metrics.cpuStrength, p90: 60 },
      },
    ]);
    expect(
      normal.some((observation) => observation.code.includes("strength")),
    ).toBe(false);

    const excessive = buildBalanceObservations([
      {
        ...metrics,
        userStrength: 105,
        cpuStrength: { ...metrics.cpuStrength, p90: 60 },
      },
    ]);
    expect(excessive).toEqual([
      expect.objectContaining({
        code: "user_strength_above_national_p90",
        yearIndex: metrics.yearIndex,
      }),
    ]);
  });

  it("does not flag a transient zero ledger balance unless a week starts at zero funds", async () => {
    const { createSoakSnapshot, buildBalanceObservations } =
      await loadSubject();
    const snapshot = createSoakSnapshot("phase50-funds-observation");
    const metrics = captureSoakSnapshotMetrics(snapshot);

    const transient = buildBalanceObservations([
      { ...metrics, fundsMin: 0, zeroFundWeeks: 0 },
    ]);
    expect(
      transient.some((observation) => observation.code === "user_funds_zero"),
    ).toBe(false);

    const persistent = buildBalanceObservations([
      { ...metrics, fundsMin: 0, zeroFundWeeks: 1 },
    ]);
    expect(persistent).toEqual([
      expect.objectContaining({
        code: "user_funds_zero",
        yearIndex: metrics.yearIndex,
      }),
    ]);
  });

  it("advances a normal game week through the production game action boundary", async () => {
    const { createSoakSnapshot, advanceSoakUntilWeekChanges } =
      await loadSubject();
    const before = createSoakSnapshot("phase18-week-seed");

    const result = advanceSoakUntilWeekChanges(before);

    expect(result.snapshot.state.date).not.toBe(before.state.date);
    expect(result.snapshot.state.calendar.weekOfYear).not.toBe(
      before.state.calendar.weekOfYear,
    );
    expect(result.snapshot.revision).toBeGreaterThan(before.revision);
    expect(result.actionCount).toBeGreaterThan(0);
    expect(before.state.date).toBe("2026-04-01");
  });

  it("avoids unaffordable event choices when an affordable alternative exists", async () => {
    const { createSoakSnapshot, advanceSoakUntilWeekChanges } =
      await loadSubject();
    const snapshot = createSoakSnapshot("phase50-affordable-event");
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const actorPlayerId = school.playerIds[0]!;
    school.funds = 332;
    snapshot.state.pendingEvent = {
      eventId: "event.scouting-conflict",
      actorPlayerIds: [actorPlayerId],
      targetSchoolId: null,
      surfacedDate: snapshot.state.date,
      choiceIds: ["direct", "patient"],
      chainId: null,
      chainStage: null,
    } as never;

    const result = advanceSoakUntilWeekChanges(snapshot);
    const occurrence = result.snapshot.state.eventMemory.history.at(-1);

    expect(occurrence?.eventId).toBe("event.scouting-conflict");
    expect(occurrence?.choiceId).toBe("patient");
    expect(
      result.snapshot.state.schoolManagement.fundsHistory.some(
        (entry) =>
          entry.relatedId === "event.scouting-conflict" && entry.amount < 0,
      ),
    ).toBe(false);
  });

  it("keeps the first event choice when it is affordable", async () => {
    const { createSoakSnapshot, advanceSoakUntilWeekChanges } =
      await loadSubject();
    const snapshot = createSoakSnapshot("phase50-affordable-first-choice");
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const actorPlayerId = school.playerIds[0]!;
    school.funds = 6000;
    snapshot.state.pendingEvent = {
      eventId: "event.scouting-conflict",
      actorPlayerIds: [actorPlayerId],
      targetSchoolId: null,
      surfacedDate: snapshot.state.date,
      choiceIds: ["direct", "patient"],
      chainId: null,
      chainStage: null,
    } as never;

    const result = advanceSoakUntilWeekChanges(snapshot);
    const occurrence = result.snapshot.state.eventMemory.history.at(-1);

    expect(occurrence?.choiceId).toBe("direct");
  });

  it("resolves a pending event deterministically before advancing the week", async () => {
    const { createSoakSnapshot, advanceSoakUntilWeekChanges } =
      await loadSubject();
    const snapshot = createSoakSnapshot("phase18-event-seed");
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const actorPlayerId = school.playerIds[0]!;
    snapshot.state.pendingEvent = {
      eventId: "event.rainy-season-laundry",
      actorPlayerIds: [actorPlayerId],
      targetSchoolId: null,
      surfacedDate: snapshot.state.date,
      choiceIds: ["rotate", "service"],
      chainId: null,
      chainStage: null,
    } as never;

    const first = advanceSoakUntilWeekChanges(snapshot);
    const second = advanceSoakUntilWeekChanges(snapshot);

    expect(first).toEqual(second);
    expect(first.resolvedEvents).toBe(1);
    expect(first.snapshot.state.pendingEvent).toBeNull();
    expect(first.snapshot.state.date).not.toBe(snapshot.state.date);
  });

  it("fails with reproducibility context instead of hanging when the per-week action guard is exhausted", async () => {
    const { createSoakSnapshot, advanceSoakUntilWeekChanges } =
      await loadSubject();
    const snapshot = createSoakSnapshot("phase18-guard-seed");

    expect(() =>
      advanceSoakUntilWeekChanges(snapshot, { maxActionsPerWeek: 0 }),
    ).toThrow(/phase18-guard-seed.*2026-04-01.*action guard/i);
  });
});
