import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../../worker/data/GameStore";
import type {
  ScoutingCandidatePool,
  ScoutingStore,
} from "../../../../worker/data/ScoutingStore";
import {
  generateServerScoutingCandidates,
  scoutingCycleKey,
} from "../../../../worker/scouting/serverScoutingBoard";
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

function createScoutingContext(snapshot: CloudGameSnapshot): {
  pool: ScoutingCandidatePool;
  store: ScoutingStore;
} {
  const pool: ScoutingCandidatePool = {
    userId: snapshot.userId,
    cycleKey: scoutingCycleKey(snapshot.state),
    creationOperationId: "pool-op",
    candidates: generateServerScoutingCandidates(snapshot.state),
  };
  return {
    pool,
    store: {
      getCandidatePool: vi.fn(async () => pool),
      createCandidatePool: vi.fn(async () => pool),
      listCandidateInsights: vi.fn(async () => []),
    },
  };
}

describe("scout candidate shop items", () => {
  it("appends a different candidate on every normal extra-candidate use", async () => {
    const snapshot = createSnapshot();
    const { pool, store } = createScoutingContext(snapshot);

    for (let useIndex = 1; useIndex <= 5; useIndex += 1) {
      const resolved = await resolveShopUse({
        snapshot,
        request: {
          operationId: `normal-extra-${useIndex}`,
          revision: 7,
          itemId: "extra-scout-candidate",
        },
        scoutingStore: store,
      });
      expect(resolved.scoutingCandidates).toHaveLength(6 + useIndex);
      expect(resolved.scoutingCandidates?.at(-1)?.player.id).toContain(
        `-${6 + useIndex}`,
      );
      pool.candidates.splice(
        0,
        pool.candidates.length,
        ...(resolved.scoutingCandidates ?? []),
      );
    }

    expect(
      new Set(pool.candidates.map((candidate) => candidate.player.id)).size,
    ).toBe(11);
  });

  it("adds exactly one guaranteed generational (天才) candidate", async () => {
    const snapshot = createSnapshot();
    const { pool, store } = createScoutingContext(snapshot);

    const resolved = await resolveShopUse({
      snapshot,
      request: {
        operationId: "genius-extra-1",
        revision: 7,
        itemId: "generational-scout-candidate",
      },
      scoutingStore: store,
    });

    expect(resolved.scoutingCandidates).toHaveLength(7);
    const added = resolved.scoutingCandidates?.at(-1);
    expect(added?.player.id).toContain("-7");
    expect(added?.player.tier).toBe("generational");
    expect(resolved.publicResult).toEqual({
      candidateCount: 7,
      addedCandidateId: added?.player.id,
    });
    expect(JSON.stringify(resolved.publicResult)).not.toMatch(
      /tier|potential|abilities/i,
    );
    expect(pool.candidates).toHaveLength(6);
  });
});
