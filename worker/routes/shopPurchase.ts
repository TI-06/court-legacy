import { shopPurchaseRequestSchema } from "../../src/domain/shop/shopContracts";
import {
  ShopStoreMutationError,
  type ShopMutationErrorCode,
  type ShopStore,
} from "../data/ShopStore";
import { json, jsonError } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";

export interface ShopPurchaseHandlerDependencies {
  shopStore: ShopStore;
}

function invalidPurchase(): Response {
  return jsonError(400, "invalid_shop_purchase", "購入内容を確認してください");
}

function conflictMessage(code: ShopMutationErrorCode): string {
  switch (code) {
    case "revision_conflict":
      return "別の端末または操作でデータが更新されています";
    case "purchase_limit_reached":
      return "この年度の購入上限に達しています";
    case "operation_id_reused":
      return "同じ操作IDが別の購入内容で使用されています";
    case "item_not_found":
      return "商品を確認できません";
    case "item_disabled":
      return "この商品は現在購入できません";
    default:
      return "現在の状態では購入できません";
  }
}

function requestFingerprint(revision: number, itemId: string): string {
  return JSON.stringify({ operationType: "purchase", revision, itemId });
}

export function createShopPurchaseHandler(
  deps: ShopPurchaseHandlerDependencies,
): AuthenticatedRequestHandler {
  return async (request, user) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidPurchase();
    }

    const parsed = shopPurchaseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return invalidPurchase();
    }

    try {
      const result = await deps.shopStore.purchase({
        userId: user.id,
        operationId: parsed.data.operationId,
        requestFingerprint: requestFingerprint(
          parsed.data.revision,
          parsed.data.itemId,
        ),
        expectedRevision: parsed.data.revision,
        itemId: parsed.data.itemId,
      });

      return json(result.response);
    } catch (error) {
      if (error instanceof ShopStoreMutationError) {
        if (error.code === "server_error") {
          throw error;
        }
        return jsonError(409, error.code, conflictMessage(error.code));
      }
      throw error;
    }
  };
}
