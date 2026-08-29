import { describe, expect, it, vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import type {
  CloudGameSnapshot,
  GameStore,
} from "../../../../worker/data/GameStore";
import {
  ShopStoreMutationError,
  type ShopMutationResult,
  type ShopStore,
} from "../../../../worker/data/ShopStore";
import { createShopUseHandler } from "../../../../worker/routes/shopUse";
import {
  ShopUseResolutionError,
  type ResolveShopUseInput,
  type ResolvedShopUse,
} from "../../../../worker/shop/resolveShopUse";

function request(body: unknown): Request {
  return new Request("https://court-legacy.test/api/shop/use", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const playerId = school.playerIds[0]!;
  state.players[playerId] = {
    ...state.players[playerId]!,
    fatigue: 25,
    condition: 95,
  };

  return {
    userId: "user-123",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 8,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function createGameStore(snapshot: CloudGameSnapshot | null): GameStore {
  return {
    getSnapshot: vi.fn(async () => snapshot),
    getOperationResponse: vi.fn(async () => null),
    createGame: vi.fn(async () => {
      throw new Error("not used");
    }),
    applyOperation: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

function createShopStore(): ShopStore {
  return {
    findOperation: vi.fn(async () => null),
    getStatus: vi.fn(async () => []),
    purchase: vi.fn(async () => {
      throw new Error("not used");
    }),
    use: vi.fn(async (input): Promise<ShopMutationResult> => ({
      operationId: input.operationId,
      operationType: "use",
      requestFingerprint: input.requestFingerprint,
      revision: 9,
      academicYearIndex: input.state.yearIndex,
      itemId: input.itemId,
      quantityOwned: 0,
      purchasedCount: 1,
      usedCount: 1,
      response: {
        operationId: input.operationId,
        operationType: "use",
        revision: 9,
        academicYearIndex: input.state.yearIndex,
        itemId: input.itemId,
        quantityOwned: 0,
        purchasedCount: 1,
        usedCount: 1,
        result: input.publicResult,
      },
      replayed: false,
    })),
  };
}

function resolvedFatigueUse(snapshot: CloudGameSnapshot): ResolvedShopUse {
  const state = structuredClone(snapshot.state);
  const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
  state.players[playerId] = {
    ...state.players[playerId]!,
    fatigue: 0,
    condition: 100,
  };

  return {
    state,
    teamSelection: structuredClone(snapshot.teamSelection),
    targetType: "player",
    targetId: playerId,
    safeRequest: { target: { type: "player", playerId } },
    publicResult: {
      playerId,
      before: { fatigue: 25, condition: 95 },
      after: { fatigue: 0, condition: 100 },
    },
  };
}

function createResolver(result: ResolvedShopUse) {
  return vi.fn(async (_input: ResolveShopUseInput) => result);
}

function bodyFor(snapshot: CloudGameSnapshot) {
  const playerId = snapshot.state.schools[snapshot.state.userSchoolId]!.playerIds[0]!;
  return {
    operationId: "shop-use-001",
    revision: 8,
    itemId: "fatigue-recovery" as const,
    target: { type: "player" as const, playerId },
  };
}

function fingerprint(body: ReturnType<typeof bodyFor>): string {
  return JSON.stringify({
    operationType: "use",
    revision: body.revision,
    itemId: body.itemId,
    target: body.target,
  });
}

describe("shop use route", () => {
  it("rejects client-controlled effect fields before touching authoritative stores", async () => {
    const snapshot = createSnapshot();
    const gameStore = createGameStore(snapshot);
    const shopStore = createShopStore();
    const resolveUse = createResolver(resolvedFatigueUse(snapshot));
    const handler = createShopUseHandler({ gameStore, shopStore, resolveUse });

    const response = await handler(
      request({ ...bodyFor(snapshot), fatigueReduction: 99, priceYen: 0 }),
      { id: "user-123" },
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_shop_use");
    expect(shopStore.findOperation).not.toHaveBeenCalled();
    expect(gameStore.getSnapshot).not.toHaveBeenCalled();
    expect(resolveUse).not.toHaveBeenCalled();
    expect(shopStore.use).not.toHaveBeenCalled();
  });

  it("returns an exact successful replay before reading or re-resolving changed game state", async () => {
    const snapshot = createSnapshot();
    const body = bodyFor(snapshot);
    const canonicalResponse = {
      operationId: body.operationId,
      operationType: "use",
      revision: 9,
      academicYearIndex: snapshot.state.yearIndex,
      itemId: body.itemId,
      quantityOwned: 0,
      purchasedCount: 1,
      usedCount: 1,
      result: {
        playerId: body.target.playerId,
        before: { fatigue: 25, condition: 95 },
        after: { fatigue: 0, condition: 100 },
      },
    };
    const gameStore = createGameStore(snapshot);
    const shopStore = createShopStore();
    vi.mocked(shopStore.findOperation).mockResolvedValue({
      operationId: body.operationId,
      operationType: "use",
      requestFingerprint: fingerprint(body),
      response: canonicalResponse,
    });
    const resolveUse = createResolver(resolvedFatigueUse(snapshot));
    const handler = createShopUseHandler({ gameStore, shopStore, resolveUse });

    const response = await handler(request(body), { id: "user-123" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(canonicalResponse);
    expect(gameStore.getSnapshot).not.toHaveBeenCalled();
    expect(resolveUse).not.toHaveBeenCalled();
    expect(shopStore.use).not.toHaveBeenCalled();
  });

  it("rejects semantic reuse of an operation id before resolver execution", async () => {
    const snapshot = createSnapshot();
    const body = bodyFor(snapshot);
    const gameStore = createGameStore(snapshot);
    const shopStore = createShopStore();
    vi.mocked(shopStore.findOperation).mockResolvedValue({
      operationId: body.operationId,
      operationType: "purchase",
      requestFingerprint: "different",
      response: { operationId: body.operationId },
    });
    const resolveUse = createResolver(resolvedFatigueUse(snapshot));
    const handler = createShopUseHandler({ gameStore, shopStore, resolveUse });

    const response = await handler(request(body), { id: "user-123" });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("operation_id_reused");
    expect(gameStore.getSnapshot).not.toHaveBeenCalled();
    expect(resolveUse).not.toHaveBeenCalled();
    expect(shopStore.use).not.toHaveBeenCalled();
  });

  it("resolves a first use from the authoritative snapshot and commits exactly once", async () => {
    const snapshot = createSnapshot();
    const body = bodyFor(snapshot);
    const resolved = resolvedFatigueUse(snapshot);
    const gameStore = createGameStore(snapshot);
    const shopStore = createShopStore();
    const resolveUse = createResolver(resolved);
    const handler = createShopUseHandler({ gameStore, shopStore, resolveUse });

    const response = await handler(request(body), { id: "user-123" });

    expect(response.status).toBe(200);
    expect(shopStore.findOperation).toHaveBeenCalledWith(
      "user-123",
      body.operationId,
    );
    expect(gameStore.getSnapshot).toHaveBeenCalledWith("user-123");
    expect(resolveUse).toHaveBeenCalledWith({
      snapshot,
      request: body,
      scoutingStore: undefined,
    });
    expect(shopStore.use).toHaveBeenCalledTimes(1);
    expect(shopStore.use).toHaveBeenCalledWith({
      userId: "user-123",
      operationId: body.operationId,
      requestFingerprint: fingerprint(body),
      expectedRevision: 8,
      itemId: "fatigue-recovery",
      state: resolved.state,
      teamSelection: resolved.teamSelection,
      targetType: "player",
      targetId: body.target.playerId,
      safeRequest: resolved.safeRequest,
      publicResult: resolved.publicResult,
      scoutingCycleKey: null,
      scoutingCandidates: null,
      scoutingInsight: null,
    });
  });

  it("does not commit when the game is not initialized", async () => {
    const snapshot = createSnapshot();
    const gameStore = createGameStore(null);
    const shopStore = createShopStore();
    const resolveUse = createResolver(resolvedFatigueUse(snapshot));
    const handler = createShopUseHandler({ gameStore, shopStore, resolveUse });

    const response = await handler(request(bodyFor(snapshot)), {
      id: "user-123",
    });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("game_not_initialized");
    expect(resolveUse).not.toHaveBeenCalled();
    expect(shopStore.use).not.toHaveBeenCalled();
  });

  it.each([
    "invalid_target",
    "target_not_found",
    "effect_already_pending",
    "scouting_cycle_unavailable",
  ] as const)("maps resolver conflict %s without consuming inventory", async (code) => {
    const snapshot = createSnapshot();
    const gameStore = createGameStore(snapshot);
    const shopStore = createShopStore();
    const resolveUse = vi.fn(async () => {
      throw new ShopUseResolutionError(code);
    });
    const handler = createShopUseHandler({ gameStore, shopStore, resolveUse });

    const response = await handler(request(bodyFor(snapshot)), {
      id: "user-123",
    });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe(code);
    expect(shopStore.use).not.toHaveBeenCalled();
  });

  it.each([
    "revision_conflict",
    "inventory_empty",
    "use_limit_reached",
    "operation_id_reused",
  ] as const)("maps store conflict %s to 409", async (code) => {
    const snapshot = createSnapshot();
    const gameStore = createGameStore(snapshot);
    const shopStore = createShopStore();
    vi.mocked(shopStore.use).mockRejectedValue(new ShopStoreMutationError(code));
    const resolveUse = createResolver(resolvedFatigueUse(snapshot));
    const handler = createShopUseHandler({ gameStore, shopStore, resolveUse });

    const response = await handler(request(bodyFor(snapshot)), {
      id: "user-123",
    });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe(code);
  });
});
