import { describe, expect, it, vi } from "vitest";
import type {
  ShopPurchaseRequest,
  ShopUseRequest,
} from "../../../src/domain/shop/shopContracts";
import {
  ApiError,
  HttpGameApiClient,
} from "../../../src/services/api/GameApiClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("HttpGameApiClient shop API", () => {
  it("loads shop status through the authenticated GET endpoint", async () => {
    const payload = {
      revision: 7,
      academicYearIndex: 4,
      items: [],
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(payload));
    const api = new HttpGameApiClient(fetchImpl);

    await expect(api.getShop("access-token")).resolves.toEqual(payload);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/shop",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("posts only operation metadata for a shop purchase", async () => {
    const request: ShopPurchaseRequest = {
      operationId: "shop-purchase-client-001",
      revision: 7,
      itemId: "fatigue-recovery",
    };
    const payload = {
      operationId: request.operationId,
      operationType: "purchase",
      revision: 8,
      academicYearIndex: 4,
      itemId: request.itemId,
      quantityOwned: 1,
      purchasedCount: 1,
      usedCount: 0,
    };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(payload));
    const api = new HttpGameApiClient(fetchImpl);

    await expect(
      api.purchaseShopItem("access-token", request),
    ).resolves.toEqual(payload);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/shop/purchase",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
          "content-type": "application/json",
        }),
      }),
    );
  });

  it("posts only the safe target for item use and maps revision conflicts", async () => {
    const request: ShopUseRequest = {
      operationId: "shop-use-client-001",
      revision: 8,
      itemId: "fatigue-recovery",
      target: { type: "player", playerId: "player-1" },
    };
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "revision_conflict",
            message: "別の端末または操作でデータが更新されています",
          },
        },
        409,
      ),
    );
    const api = new HttpGameApiClient(fetchImpl);

    const error = await api
      .useShopItem("access-token", request)
      .catch((reason) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "revision_conflict",
      message: "別の端末または操作でデータが更新されています",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/shop/use",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
      }),
    );
  });
});
