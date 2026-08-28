import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { ShopUseRequest } from "../../../../src/domain/shop/shopContracts";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../../worker/data/GameStore";
import type {
  ScoutingCandidateInsight,
  ScoutingCandidatePool,
  ScoutingStore,
} from "../../../../worker/data/ScoutingStore";
import {
  generateServerScoutingCandidates,
  scoutingCycleKey,
} from "../../../../worker/scouting/serverScoutingBoard";
import {
  ShopUseResolutionError,
  resolveShopUse,
} from "../../../../worker/shop/resolveShopUse";

function createSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: "user-123",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 7,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function request(
  itemId: ShopUseRequest["itemId"],
  target?: ShopUseRequest["target"],
): ShopUseRequest {
  return {
    operationId: `use-${itemId}`,
    revision: 7,
    itemId,
    ...(target ? { target } : {}),
  };
}

function createScoutingContext(
  snapshot: CloudGameSnapshot,
  insights: ScoutingCandidateInsight[] = [],
): { pool: ScoutingCandidatePool; store: ScoutingStore } {
  const cycleKey = scoutingCycleKey(snapshot.state);
  const pool: ScoutingCandidatePool = {
    userId: snapshot.userId,
    cycleKey,
    creationOperationId: "scouting-pool-op",
    candidates: generateServerScoutingCandidates(snapshot.state),
  };
  const store: ScoutingStore = {
    getCandidatePool: vi.fn(async () => pool),
    createCandidatePool: vi.fn(async () => pool),
    listCandidateInsights: vi.fn(async () => insights),
  };
  return { pool, store };
}

async function expectResolutionCode(
  promise: Promise<unknown>,
  code: ShopUseResolutionError["code"],
): Promise<void> {
  try {
    await promise;
    throw new Error("expected shop use resolution to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(ShopUseResolutionError);
    expect((error as ShopUseResolutionError).code).toBe(code);
  }
}

describe("resolveShopUse", () => {
  it("rejects a target shape that does not match the authoritative item definition", async () => {
    const snapshot = createSnapshot();

    await expectResolutionCode(
      resolveShopUse({
        snapshot,
        request: request("fatigue-recovery"),
      }),
      "invalid_target",
    );
  });

  it("applies fatigue recovery to a current-school player and exposes only before/after public values", async () => {
    const snapshot = createSnapshot();
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    snapshot.state.players[playerId] = {
      ...snapshot.state.players[playerId]!,
      fatigue: 25,
      condition: 95,
    };

    const resolved = await resolveShopUse({
      snapshot,
      request: request("fatigue-recovery", { type: "player", playerId }),
    });

    expect(resolved.state.players[playerId]!.fatigue).toBe(0);
    expect(resolved.state.players[playerId]!.condition).toBe(100);
    expect(resolved.targetType).toBe("player");
    expect(resolved.targetId).toBe(playerId);
    expect(resolved.publicResult).toEqual({
      playerId,
      before: { fatigue: 25, condition: 95 },
      after: { fatigue: 0, condition: 100 },
    });
    expect(JSON.stringify(resolved.publicResult)).not.toMatch(
      /potential|growthPeak|injuryResistance|tier/i,
    );
  });

  it("adds deterministic candidate index seven without rerolling the existing six or exposing truth", async () => {
    const snapshot = createSnapshot();
    const { pool, store } = createScoutingContext(snapshot);

    const resolved = await resolveShopUse({
      snapshot,
      request: request("extra-scout-candidate"),
      scoutingStore: store,
    });

    expect(resolved.scoutingCycleKey).toBe(pool.cycleKey);
    expect(resolved.scoutingCandidates).toHaveLength(7);
    expect(resolved.scoutingCandidates?.slice(0, 6)).toEqual(pool.candidates);
    expect(resolved.scoutingCandidates?.[6]?.player.id).toContain("-7");
    expect(resolved.publicResult).toEqual({
      candidateCount: 7,
      addedCandidateId: resolved.scoutingCandidates?.[6]?.player.id,
    });
    expect(JSON.stringify(resolved.publicResult)).not.toMatch(
      /abilities|potential|growthPeak|injuryResistance|tier/i,
    );
  });

  it("upgrades scout research while preserving an already appraised potential precision", async () => {
    const snapshot = createSnapshot();
    const base = createScoutingContext(snapshot);
    const candidateId = base.pool.candidates[0]!.player.id;
    const { store } = createScoutingContext(snapshot, [
      {
        candidateId,
        overallPrecision: "normal",
        potentialPrecision: "appraised",
      },
    ]);

    const resolved = await resolveShopUse({
      snapshot,
      request: request("scout-research", {
        type: "scouting-candidate",
        candidateId,
      }),
      scoutingStore: store,
    });

    expect(resolved.scoutingInsight).toEqual({
      candidateId,
      overallPrecision: "researched",
      potentialPrecision: "appraised",
    });
    expect(resolved.publicResult).toEqual(resolved.scoutingInsight);
  });

  it("appraises potential while preserving the existing overall precision", async () => {
    const snapshot = createSnapshot();
    const base = createScoutingContext(snapshot);
    const candidateId = base.pool.candidates[0]!.player.id;
    const { store } = createScoutingContext(snapshot, [
      {
        candidateId,
        overallPrecision: "researched",
        potentialPrecision: "normal",
      },
    ]);

    const resolved = await resolveShopUse({
      snapshot,
      request: request("potential-appraisal", {
        type: "scouting-candidate",
        candidateId,
      }),
      scoutingStore: store,
    });

    expect(resolved.scoutingInsight).toEqual({
      candidateId,
      overallPrecision: "researched",
      potentialPrecision: "appraised",
    });
    expect(resolved.publicResult).toEqual(resolved.scoutingInsight);
  });

  it("runs training camp through normal player-training mechanics and returns a public summary", async () => {
    const snapshot = createSnapshot();
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const before = structuredClone(snapshot.state.players);

    const resolved = await resolveShopUse({
      snapshot,
      request: request("training-camp"),
    });

    expect(resolved.targetType).toBe("team");
    expect(resolved.publicResult.participantCount).toBe(school.playerIds.length);
    expect(resolved.publicResult).toHaveProperty("totalAbilityGrowth");
    expect(resolved.publicResult).toHaveProperty("averageFatigueChange");
    expect(resolved.state.randomCursor).toBeGreaterThanOrEqual(
      snapshot.state.randomCursor,
    );
    expect(resolved.state.players).not.toEqual(before);
  });

  it("runs special coach for one eligible player and leaves other roster members unchanged", async () => {
    const snapshot = createSnapshot();
    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const playerId = school.playerIds[0]!;
    const otherPlayerId = school.playerIds[1]!;
    snapshot.state.players[playerId] = {
      ...snapshot.state.players[playerId]!,
      injury: null,
      fatigue: 0,
      condition: 100,
    };
    const targetBefore = structuredClone(snapshot.state.players[playerId]!);
    const otherBefore = structuredClone(snapshot.state.players[otherPlayerId]!);

    const resolved = await resolveShopUse({
      snapshot,
      request: request("special-coach", {
        type: "special-coach",
        playerId,
        focus: "spike",
      }),
    });

    expect(resolved.targetType).toBe("special-coach");
    expect(resolved.state.players[playerId]!.abilities.spike).toBeGreaterThanOrEqual(
      targetBefore.abilities.spike,
    );
    expect(resolved.state.players[playerId]!.abilities.jump).toBeGreaterThanOrEqual(
      targetBefore.abilities.jump,
    );
    expect(resolved.state.players[otherPlayerId]).toEqual(otherBefore);
    expect(resolved.publicResult).toMatchObject({ playerId, focus: "spike" });
  });

  it("activates the exact next-training boost once and rejects a second pending activation", async () => {
    const snapshot = createSnapshot();
    const first = await resolveShopUse({
      snapshot,
      request: request("training-efficiency-boost"),
    });

    expect(first.state.shopEffects?.nextTrainingGrowthBoost).toEqual({
      percent: 20,
      remainingUses: 1,
      sourceItemId: "training-efficiency-boost",
    });
    expect(first.publicResult).toEqual({ pending: true, percent: 20 });

    await expectResolutionCode(
      resolveShopUse({
        snapshot: { ...snapshot, state: first.state },
        request: {
          ...request("training-efficiency-boost"),
          operationId: "use-training-efficiency-boost-second",
        },
      }),
      "effect_already_pending",
    );
  });
});
