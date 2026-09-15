import { CURRENT_GAME_SCHEMA_VERSION } from "../../../src/domain/model/GameState";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";

const subjectPath = "../../../src/dev/soak/runBalanceSoak";

interface SoakDriverSubject {
  createSoakSnapshot(seed: string): CloudGameSnapshot;
  applySoakManagementPolicy(snapshot: CloudGameSnapshot): {
    snapshot: CloudGameSnapshot;
    actionCount: number;
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
