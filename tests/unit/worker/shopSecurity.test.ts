import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type { GameState } from "../../../src/domain/model/GameState";
import type { Player } from "../../../src/domain/model/Player";
import { PHASE5_SHOP_ITEMS } from "../../../src/domain/shop/shopCatalog";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import type {
  ScoutingCandidatePool,
  ScoutingStore,
} from "../../../worker/data/ScoutingStore";
import type { PublishedPvpTeamSnapshot } from "../../../worker/data/PvPStore";
import { buildPvpSimulationState } from "../../../worker/pvp/buildPvpSimulationState";
import {
  generateServerScoutingCandidates,
  scoutingCycleKey,
} from "../../../worker/scouting/serverScoutingBoard";
import {
  ShopUseResolutionError,
  resolveShopUse,
} from "../../../worker/shop/resolveShopUse";

function defenderSnapshot(state: GameState): PublishedPvpTeamSnapshot {
  const school = structuredClone(state.schools[state.userSchoolId]!);
  const players = Object.fromEntries(
    school.playerIds.map((id) => [id, structuredClone(state.players[id]!)]),
  ) as Record<string, Player>;

  return {
    id: "security-defender-snapshot",
    userId: "security-defender",
    sourceRevision: 4,
    sourceAcademicYear: state.calendar.academicYear,
    sourceYearIndex: state.yearIndex,
    school,
    players,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    isActive: true,
    publishedAt: "2026-08-29T05:00:00.000Z",
  };
}

function gameSnapshot(state = createDemoGame()): CloudGameSnapshot {
  return {
    userId: "security-user",
    schoolDbId: "00000000-0000-4000-8000-000000000099",
    revision: 7,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function scoutingStore(snapshot: CloudGameSnapshot): {
  pool: ScoutingCandidatePool;
  store: ScoutingStore;
} {
  const cycleKey = scoutingCycleKey(snapshot.state);
  const pool: ScoutingCandidatePool = {
    userId: snapshot.userId,
    cycleKey,
    creationOperationId: "security-scouting-pool",
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

async function expectResolutionError(
  promise: Promise<unknown>,
  code: ShopUseResolutionError["code"],
): Promise<void> {
  try {
    await promise;
    throw new Error("expected shop use resolution error");
  } catch (error) {
    expect(error).toBeInstanceOf(ShopUseResolutionError);
    expect((error as ShopUseResolutionError).code).toBe(code);
  }
}

describe("Phase 5 shop security boundaries", () => {
  it("does not define direct PvP win, rating, or instant ability manipulation items", () => {
    expect(PHASE5_SHOP_ITEMS.map((item) => item.itemId)).toEqual([
      "extra-scout-candidate",
      "scout-research",
      "potential-appraisal",
      "training-camp",
      "fatigue-recovery",
      "special-coach",
      "training-efficiency-boost",
    ]);

    const publicCatalogText = PHASE5_SHOP_ITEMS.map(
      (item) => `${item.itemId} ${item.displayName} ${item.description}`,
    ).join("\n");
    expect(publicCatalogText).not.toMatch(
      /pvp[-_ ]?win|rating|レート上昇|勝利確定|能力\s*\+20/i,
    );
  });

  it("removes temporary shop effects from ranked PvP simulation state", () => {
    const challengerState = createDemoGame();
    const defenderState = createDemoGame();
    challengerState.shopEffects = {
      nextTrainingGrowthBoost: {
        percent: 20,
        remainingUses: 1,
        sourceItemId: "training-efficiency-boost",
      },
    };

    const result = buildPvpSimulationState({
      challenger: {
        userId: "security-challenger",
        state: challengerState,
        teamSelection: autoSelectTeam({
          state: challengerState,
          schoolId: challengerState.userSchoolId,
        }),
      },
      defender: defenderSnapshot(defenderState),
    });

    expect(result.state.shopEffects).toBeUndefined();
    expect(JSON.stringify(result.state)).not.toContain(
      "training-efficiency-boost",
    );
  });

  it("rejects a player outside the current school before any shop commit", async () => {
    const snapshot = gameSnapshot();
    const foreignSchool = Object.values(snapshot.state.schools).find(
      (school) => school.id !== snapshot.state.userSchoolId,
    );
    expect(foreignSchool).toBeDefined();
    const foreignPlayerId = foreignSchool!.playerIds[0]!;

    await expectResolutionError(
      resolveShopUse({
        snapshot,
        request: {
          operationId: "security-foreign-player",
          revision: snapshot.revision,
          itemId: "fatigue-recovery",
          target: { type: "player", playerId: foreignPlayerId },
        },
      }),
      "target_not_found",
    );
  });

  it("rejects a scouting candidate outside the authenticated user's active pool", async () => {
    const snapshot = gameSnapshot();
    const context = scoutingStore(snapshot);

    await expectResolutionError(
      resolveShopUse({
        snapshot,
        request: {
          operationId: "security-foreign-candidate",
          revision: snapshot.revision,
          itemId: "potential-appraisal",
          target: {
            type: "scouting-candidate",
            candidateId: "foreign-user:candidate-1",
          },
        },
        scoutingStore: context.store,
      }),
      "target_not_found",
    );
  });

  it("returns only public scouting precision fields from appraisal", async () => {
    const snapshot = gameSnapshot();
    const context = scoutingStore(snapshot);
    const candidate = context.pool.candidates[0]!;

    const resolved = await resolveShopUse({
      snapshot,
      request: {
        operationId: "security-public-appraisal",
        revision: snapshot.revision,
        itemId: "potential-appraisal",
        target: {
          type: "scouting-candidate",
          candidateId: candidate.player.id,
        },
      },
      scoutingStore: context.store,
    });

    expect(Object.keys(resolved.publicResult).sort()).toEqual([
      "candidateId",
      "overallPrecision",
      "potentialPrecision",
    ]);
    expect(resolved.publicResult).not.toHaveProperty("player");
    expect(resolved.publicResult).not.toHaveProperty("potential");
    expect(resolved.publicResult).not.toHaveProperty("seed");
    expect(resolved.publicResult).not.toHaveProperty("hiddenTraits");
  });
});
