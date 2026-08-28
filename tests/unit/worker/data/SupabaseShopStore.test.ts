import { describe, expect, it, vi } from "vitest";
import {
  ShopStoreMutationError,
  type CommitShopUseInput,
  type PurchaseShopItemInput,
} from "../../../../worker/data/ShopStore";
import { SupabaseShopStore } from "../../../../worker/data/SupabaseShopStore";
import type { SupabaseAdminClient } from "../../../../worker/data/createSupabaseAdmin";

interface RpcResult {
  data: unknown;
  error: unknown;
}

type MockSupabaseAdminClient = SupabaseAdminClient & {
  rpc: ReturnType<typeof vi.fn>;
};

function createClient(
  results: Record<string, RpcResult>,
): MockSupabaseAdminClient {
  return {
    rpc: vi.fn(
      async (name: string) => results[name] ?? { data: null, error: null },
    ),
  } as unknown as MockSupabaseAdminClient;
}

const statusRows = [
  {
    academic_year_index: 4,
    item_id: "fatigue-recovery",
    display_name: "疲労回復",
    description: "指定した選手1名の疲労を大きく回復します。",
    price_yen: 0,
    annual_purchase_limit: 3,
    annual_use_limit: 3,
    purchased_count: 1,
    used_count: 0,
    quantity_owned: 1,
    enabled: true,
    sort_order: 50,
  },
];

const mutationRow = {
  operation_id: "shop-op-001",
  operation_type: "purchase",
  request_fingerprint: "purchase:fatigue-recovery:7",
  revision: 8,
  academic_year_index: 4,
  item_id: "fatigue-recovery",
  quantity_owned: 1,
  purchased_count: 1,
  used_count: 0,
  response: { operationId: "shop-op-001", revision: 8 },
  replayed: false,
};

describe("SupabaseShopStore", () => {
  it("strictly maps authoritative shop status rows", async () => {
    const client = createClient({
      get_shop_status: { data: statusRows, error: null },
    });
    const store = new SupabaseShopStore(client);

    await expect(store.getStatus("user-123", 4)).resolves.toEqual([
      {
        academicYearIndex: 4,
        itemId: "fatigue-recovery",
        displayName: "疲労回復",
        description: "指定した選手1名の疲労を大きく回復します。",
        priceYen: 0,
        annualPurchaseLimit: 3,
        annualUseLimit: 3,
        purchasedCount: 1,
        usedCount: 0,
        quantityOwned: 1,
        enabled: true,
        sortOrder: 50,
      },
    ]);
    expect(client.rpc).toHaveBeenCalledWith("get_shop_status", {
      p_user_id: "user-123",
      p_current_year_index: 4,
    });
  });

  it("uses one purchase RPC and preserves the canonical operation response", async () => {
    const client = createClient({
      purchase_shop_item: { data: [mutationRow], error: null },
    });
    const store = new SupabaseShopStore(client);
    const input: PurchaseShopItemInput = {
      userId: "user-123",
      operationId: "shop-op-001",
      requestFingerprint: "purchase:fatigue-recovery:7",
      expectedRevision: 7,
      itemId: "fatigue-recovery",
    };

    await expect(store.purchase(input)).resolves.toEqual({
      operationId: "shop-op-001",
      operationType: "purchase",
      requestFingerprint: "purchase:fatigue-recovery:7",
      revision: 8,
      academicYearIndex: 4,
      itemId: "fatigue-recovery",
      quantityOwned: 1,
      purchasedCount: 1,
      usedCount: 0,
      response: { operationId: "shop-op-001", revision: 8 },
      replayed: false,
    });
    expect(client.rpc).toHaveBeenCalledWith("purchase_shop_item", {
      p_user_id: "user-123",
      p_operation_id: "shop-op-001",
      p_request_fingerprint: "purchase:fatigue-recovery:7",
      p_expected_revision: 7,
      p_item_id: "fatigue-recovery",
    });
  });

  it("uses one atomic use RPC with only trusted persistence payloads", async () => {
    const row = {
      ...mutationRow,
      operation_id: "shop-use-001",
      operation_type: "use",
      request_fingerprint: "use:fatigue-recovery:player-1:8",
      revision: 9,
      quantity_owned: 0,
      used_count: 1,
      response: { operationId: "shop-use-001", revision: 9 },
    };
    const client = createClient({
      commit_shop_item_use: { data: [row], error: null },
    });
    const store = new SupabaseShopStore(client);
    const input: CommitShopUseInput = {
      userId: "user-123",
      operationId: "shop-use-001",
      requestFingerprint: "use:fatigue-recovery:player-1:8",
      expectedRevision: 8,
      itemId: "fatigue-recovery",
      state: { schemaVersion: 2 } as never,
      teamSelection: { starters: {} } as never,
      targetType: "player",
      targetId: "player-1",
      safeRequest: { playerId: "player-1" },
      publicResult: { fatigueBefore: 70, fatigueAfter: 30 },
    };

    await expect(store.use(input)).resolves.toMatchObject({
      operationId: "shop-use-001",
      operationType: "use",
      revision: 9,
      quantityOwned: 0,
      usedCount: 1,
    });
    expect(client.rpc).toHaveBeenCalledWith("commit_shop_item_use", {
      p_user_id: "user-123",
      p_operation_id: "shop-use-001",
      p_request_fingerprint: "use:fatigue-recovery:player-1:8",
      p_expected_revision: 8,
      p_item_id: "fatigue-recovery",
      p_state: input.state,
      p_team_selection: input.teamSelection,
      p_target_type: "player",
      p_target_id: "player-1",
      p_safe_request: { playerId: "player-1" },
      p_public_result: { fatigueBefore: 70, fatigueAfter: 30 },
      p_scouting_cycle_key: null,
      p_scouting_candidates: null,
      p_scouting_insight: null,
    });
  });

  it("maps stable RPC conflict messages to typed shop errors", async () => {
    const client = createClient({
      purchase_shop_item: {
        data: null,
        error: { code: "40001", message: "revision_conflict" },
      },
    });
    const store = new SupabaseShopStore(client);

    await expect(
      store.purchase({
        userId: "user-123",
        operationId: "shop-op-conflict",
        requestFingerprint: "purchase:fatigue-recovery:7",
        expectedRevision: 7,
        itemId: "fatigue-recovery",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ShopStoreMutationError>>({
        name: "ShopStoreMutationError",
        code: "revision_conflict",
      }),
    );
  });

  it("rejects malformed mutation rows instead of trusting Supabase payloads", async () => {
    const client = createClient({
      purchase_shop_item: {
        data: [{ ...mutationRow, revision: "8" }],
        error: null,
      },
    });
    const store = new SupabaseShopStore(client);

    await expect(
      store.purchase({
        userId: "user-123",
        operationId: "shop-op-001",
        requestFingerprint: "purchase:fatigue-recovery:7",
        expectedRevision: 7,
        itemId: "fatigue-recovery",
      }),
    ).rejects.toMatchObject({ name: "ShopStoreDataError" });
  });
});
