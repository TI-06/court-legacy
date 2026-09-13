import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { createSoakSnapshot } from "../../../src/dev/soak/runBalanceSoak";

const subjectPath = "../../../src/dev/soak/soakInvariants";

interface Violation {
  code: string;
  message: string;
  path?: string;
}

interface InvariantSubject {
  inspectSoakInvariants(snapshot: CloudGameSnapshot): Violation[];
  assertSoakInvariants(
    snapshot: CloudGameSnapshot,
    context?: { actionCount?: number },
  ): void;
}

async function loadSubject(): Promise<InvariantSubject> {
  return (await import(subjectPath)) as InvariantSubject;
}

function cloneSnapshot(snapshot: CloudGameSnapshot): CloudGameSnapshot {
  return structuredClone(snapshot) as CloudGameSnapshot;
}

describe("Phase18 soak hard invariants", () => {
  it("accepts a fresh production-compatible soak snapshot", async () => {
    const { inspectSoakInvariants } = await loadSubject();
    const snapshot = createSoakSnapshot("phase18-invariant-valid");

    expect(inspectSoakInvariants(snapshot)).toEqual([]);
  });

  it("reports non-finite and out-of-range numeric state without hiding the path", async () => {
    const { inspectSoakInvariants } = await loadSubject();
    const snapshot = createSoakSnapshot("phase18-invariant-numeric");
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const player = snapshot.state.players[playerId]!;

    player.abilities.spike = Number.NaN;
    player.condition = 101;
    school.funds = -1;
    school.facilities.gym = 51;

    const violations = inspectSoakInvariants(snapshot);

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "non_finite",
          path: expect.stringContaining("abilities.spike"),
        }),
        expect.objectContaining({
          code: "player_value_out_of_range",
          path: expect.stringContaining("condition"),
        }),
        expect.objectContaining({
          code: "negative_school_funds",
          path: expect.stringContaining("funds"),
        }),
        expect.objectContaining({
          code: "facility_level_out_of_range",
          path: expect.stringContaining("facilities.gym"),
        }),
      ]),
    );
  });

  it("detects roster-reference corruption and invalid active team selection", async () => {
    const { inspectSoakInvariants } = await loadSubject();
    const snapshot = createSoakSnapshot("phase18-invariant-roster");
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const missingPlayerId = school.playerIds[0]!;
    delete snapshot.state.players[missingPlayerId];
    snapshot.teamSelection.rotation[1]!.playerId =
      snapshot.teamSelection.rotation[0]!.playerId;

    const codes = inspectSoakInvariants(snapshot).map((item) => item.code);

    expect(codes).toContain("missing_roster_player");
    expect(codes).toContain("invalid_team_selection");
  });

  it("throws one reproducible invariant error with seed, date and action count", async () => {
    const { assertSoakInvariants } = await loadSubject();
    const snapshot = cloneSnapshot(
      createSoakSnapshot("phase18-invariant-repro"),
    );
    snapshot.state.randomCursor = Number.POSITIVE_INFINITY;

    expect(() => assertSoakInvariants(snapshot, { actionCount: 17 })).toThrow(
      /phase18-invariant-repro.*2026-04-01.*17.*non_finite/i,
    );
  });
});
