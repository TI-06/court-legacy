import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../../worker/data/GameStore";
import { resolveShopUse } from "../../../../worker/shop/resolveShopUse";

function createSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: "user-scout-items",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 7,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

describe("scout candidate shop items", () => {
  it("queues an extra candidate for the next scouting search without requiring an active pool", async () => {
    const snapshot = createSnapshot();

    const resolved = await resolveShopUse({
      snapshot,
      request: {
        operationId: "normal-extra-1",
        revision: 7,
        itemId: "extra-scout-candidate",
      },
    });

    expect(resolved.state.recruiting).toMatchObject({
      cycleKey: `${snapshot.state.userSchoolId}:year-${snapshot.state.yearIndex}`,
      pendingExtraScoutCandidates: 1,
    });
    expect(
      resolved.state.recruiting?.pendingGenerationalScoutCandidates ?? 0,
    ).toBe(0);
    expect(resolved.scoutingCandidates).toBeUndefined();
    expect(resolved.publicResult).toEqual({
      extraCandidateCount: 1,
      guaranteedGenerationalCount: 0,
    });
  });

  it("queues a guaranteed genius candidate for the next scouting search", async () => {
    const snapshot = createSnapshot();

    const resolved = await resolveShopUse({
      snapshot,
      request: {
        operationId: "genius-extra-1",
        revision: 7,
        itemId: "generational-scout-candidate",
      },
    });

    expect(resolved.state.recruiting).toMatchObject({
      cycleKey: `${snapshot.state.userSchoolId}:year-${snapshot.state.yearIndex}`,
      pendingGenerationalScoutCandidates: 1,
    });
    expect(resolved.state.recruiting?.pendingExtraScoutCandidates ?? 0).toBe(
      0,
    );
    expect(resolved.scoutingCandidates).toBeUndefined();
    expect(resolved.publicResult).toEqual({
      extraCandidateCount: 0,
      guaranteedGenerationalCount: 1,
    });
  });

  it("stacks multiple queued scouting item effects until the next search", async () => {
    const snapshot = createSnapshot();
    const first = await resolveShopUse({
      snapshot,
      request: {
        operationId: "normal-extra-stack",
        revision: 7,
        itemId: "extra-scout-candidate",
      },
    });
    const second = await resolveShopUse({
      snapshot: {
        ...snapshot,
        state: first.state,
      },
      request: {
        operationId: "genius-extra-stack",
        revision: 7,
        itemId: "generational-scout-candidate",
      },
    });

    expect(second.state.recruiting).toMatchObject({
      pendingExtraScoutCandidates: 1,
      pendingGenerationalScoutCandidates: 1,
    });
    expect(second.publicResult).toEqual({
      extraCandidateCount: 1,
      guaranteedGenerationalCount: 1,
    });
  });
});
