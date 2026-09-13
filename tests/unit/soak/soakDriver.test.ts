import type { CloudGameSnapshot } from "../../../worker/data/GameStore";

const subjectPath = "../../../src/dev/soak/runBalanceSoak";

interface SoakDriverSubject {
  createSoakSnapshot(seed: string): CloudGameSnapshot;
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
    expect(snapshot.state.schemaVersion).toBe(8);
    expect(snapshot.teamSelection.rotation).toHaveLength(6);
    expect(snapshot.state.activeMatch).toBeNull();
    expect(snapshot.state.pendingEvent).toBeNull();
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
    snapshot.state.pendingEvent = {
      eventId: "event.club-room-cleanup",
      actorPlayerIds: [],
      targetSchoolId: null,
      surfacedDate: snapshot.state.date,
      choiceIds: ["choice.ignore", "choice.clean"],
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
