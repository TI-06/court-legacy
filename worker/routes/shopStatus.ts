import type {
  ShopBlockedReason,
  ShopPublicStatusItem,
  ShopStatusResponse,
} from "../../src/domain/shop/shopContracts";
import type { GameStore } from "../data/GameStore";
import type { ShopStatusItem, ShopStore } from "../data/ShopStore";
import { json, jsonError } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";

export interface ShopStatusHandlerDependencies {
  gameStore: GameStore;
  shopStore: ShopStore;
}

function purchaseBlockedReason(item: ShopStatusItem): ShopBlockedReason | null {
  if (!item.enabled) {
    return "item_disabled";
  }
  if (item.purchasedCount >= item.annualPurchaseLimit) {
    return "purchase_limit_reached";
  }
  return null;
}

function useBlockedReason(item: ShopStatusItem): ShopBlockedReason | null {
  if (!item.enabled) {
    return "item_disabled";
  }
  if (item.usedCount >= item.annualUseLimit) {
    return "use_limit_reached";
  }
  if (item.quantityOwned <= 0) {
    return "inventory_empty";
  }
  return null;
}

function toPublicStatus(item: ShopStatusItem): ShopPublicStatusItem {
  const purchaseReason = purchaseBlockedReason(item);
  const useReason = useBlockedReason(item);

  return {
    itemId: item.itemId,
    displayName: item.displayName,
    description: item.description,
    priceYen: item.priceYen,
    annualPurchaseLimit: item.annualPurchaseLimit,
    annualUseLimit: item.annualUseLimit,
    purchasedCount: item.purchasedCount,
    usedCount: item.usedCount,
    quantityOwned: item.quantityOwned,
    canPurchase: purchaseReason === null,
    purchaseBlockedReason: purchaseReason,
    canUse: useReason === null,
    useBlockedReason: useReason,
  };
}

export function createShopStatusHandler(
  deps: ShopStatusHandlerDependencies,
): AuthenticatedRequestHandler {
  return async (_request, user) => {
    const snapshot = await deps.gameStore.getSnapshot(user.id);
    if (!snapshot) {
      return jsonError(
        409,
        "game_not_initialized",
        "学校データを作成してください",
      );
    }

    const items = await deps.shopStore.getStatus(
      user.id,
      snapshot.state.yearIndex,
    );
    const response: ShopStatusResponse = {
      revision: snapshot.revision,
      academicYearIndex: snapshot.state.yearIndex,
      items: items.map(toPublicStatus),
    };
    return json(response);
  };
}
