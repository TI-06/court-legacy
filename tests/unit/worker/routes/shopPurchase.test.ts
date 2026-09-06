import { describe, expect, it, vi } from "vitest";
import {
  ShopStoreMutationError,
  type ShopMutationResult,
  type ShopStore,
} from "../../../../worker/data/ShopStore";
import { createShopPurchaseHandler } from "../../../../worker/routes/shopPurchase";

function request(body: unknown): Request {
  return new Request("https://court-legacy.test/api/shop/purchase", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createShopStore(): ShopStore {
  return {
    findOperation: vi.fn(async () => null),
    getStatus: vi.fn(async () => []),
    purchase: vi.fn(async (input): Promise<ShopMutationResult> => ({
      operationId: input.operationId,
      operationType: "purchase",
      requestFingerprint: input.requestFingerprint,
      revision: 8,
      academicYearIndex: 4,
      itemId: input.itemId,
      quantityOwned: 1,
      purchasedCount: 1,
      usedCount: 0,
      response: {
        operationId: input.operationId,
        operationType: "purchase",
        revision: 8,
        academicYearIndex: 4,
        itemId: input.itemId,
        quantityOwned: 1,
        purchasedCount: 1,
        usedCount: 0,
      },
      replayed: false,
    })),
    use: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

const purchaseBody = {
  operationId: "purchase-op-001",
  revision: 7,
  itemId: "fatigue-recovery",
};

describe("shop purchase route", () => {
  it("derives the idempotency fingerprint on the Worker and returns the committed response", async () => {
    const shopStore = createShopStore();
    const handler = createShopPurchaseHandler({ shopStore });

    const response = await handler(request(purchaseBody), { id: "user-123" });

    expect(response.status).toBe(200);
    expect(shopStore.purchase).toHaveBeenCalledWith({
      userId: "user-123",
      operationId: "purchase-op-001",
      requestFingerprint:
        '{"operationType":"purchase","revision":7,"itemId":"fatigue-recovery"}',
      expectedRevision: 7,
      itemId: "fatigue-recovery",
    });
    await expect(response.json()).resolves.toEqual({
      operationId: "purchase-op-001",
      operationType: "purchase",
      revision: 8,
      academicYearIndex: 4,
      itemId: "fatigue-recovery",
      quantityOwned: 1,
      purchasedCount: 1,
      usedCount: 0,
    });
  });

  it("returns the canonical immediate fund grant result unchanged", async () => {
    const shopStore = createShopStore();
    const grantResponse = {
      operationId: "shop-grant-001",
      operationType: "purchase" as const,
      revision: 8,
      academicYearIndex: 4,
      itemId: "funds-grant-300" as const,
      quantityOwned: 0,
      purchasedCount: 1,
      usedCount: 0,
      result: { fundsGranted: 300, balanceAfter: 1000 },
    };
    vi.mocked(shopStore.purchase).mockResolvedValue({
      operationId: grantResponse.operationId,
      operationType: "purchase",
      requestFingerprint:
        '{"operationType":"purchase","revision":7,"itemId":"funds-grant-300"}',
      revision: grantResponse.revision,
      academicYearIndex: grantResponse.academicYearIndex,
      itemId: grantResponse.itemId,
      quantityOwned: grantResponse.quantityOwned,
      purchasedCount: grantResponse.purchasedCount,
      usedCount: grantResponse.usedCount,
      response: grantResponse,
      replayed: false,
    });
    const handler = createShopPurchaseHandler({ shopStore });

    const response = await handler(
      request({
        operationId: "shop-grant-001",
        revision: 7,
        itemId: "funds-grant-300",
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(grantResponse);
  });

  it("rejects client-controlled price or effect fields before hitting persistence", async () => {
    const shopStore = createShopStore();
    const handler = createShopPurchaseHandler({ shopStore });

    const response = await handler(
      request({ ...purchaseBody, priceYen: 0, quantity: 99 }),
      { id: "user-123" },
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_shop_purchase");
    expect(shopStore.purchase).not.toHaveBeenCalled();
  });

  it.each([
    "revision_conflict",
    "purchase_limit_reached",
    "operation_id_reused",
  ] as const)("maps %s to a stable conflict response", async (code) => {
    const shopStore = createShopStore();
    vi.mocked(shopStore.purchase).mockRejectedValue(
      new ShopStoreMutationError(code),
    );
    const handler = createShopPurchaseHandler({ shopStore });

    const response = await handler(request(purchaseBody), { id: "user-123" });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe(code);
  });
});
