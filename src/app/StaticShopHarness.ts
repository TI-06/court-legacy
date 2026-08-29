import {
  PHASE5_SHOP_ITEMS,
  getShopItemDefinition,
  type ShopItemId,
} from "../domain/shop/shopCatalog";
import type {
  ShopPurchaseRequest,
  ShopPurchaseResponse,
  ShopStatusResponse,
  ShopUseRequest,
  ShopUseResponse,
} from "../domain/shop/shopContracts";
import { evaluateShopItemStatus } from "../domain/shop/shopRules";
import { ApiError } from "../services/api/GameApiClient";

interface HarnessGameView {
  revision: number;
  yearIndex: number;
}

interface HarnessShopItemState {
  purchasedCount: number;
  usedCount: number;
  quantityOwned: number;
}

type HarnessShopOperation =
  | {
      operationType: "purchase";
      fingerprint: string;
      response: ShopPurchaseResponse;
    }
  | {
      operationType: "use";
      fingerprint: string;
      response: ShopUseResponse;
    };

export interface StaticShopHarnessDependencies {
  getGame: () => HarnessGameView;
  commitRevision: (revision: number) => void;
  commitUse?: (
    request: ShopUseRequest,
    revision: number,
  ) => Record<string, unknown>;
}

function purchaseFingerprint(request: ShopPurchaseRequest): string {
  return JSON.stringify({
    operationType: "purchase",
    revision: request.revision,
    itemId: request.itemId,
  });
}

function shopUseFingerprint(request: ShopUseRequest): string {
  return JSON.stringify({
    operationType: "use",
    revision: request.revision,
    itemId: request.itemId,
    target: request.target ?? null,
  });
}

function targetMatches(request: ShopUseRequest): boolean {
  const targetKind = getShopItemDefinition(request.itemId).targetKind;
  switch (targetKind) {
    case "none":
    case "team":
    case "next-training":
      return request.target === undefined;
    case "player":
      return request.target?.type === "player";
    case "scouting-candidate":
      return request.target?.type === "scouting-candidate";
    case "special-coach":
      return request.target?.type === "special-coach";
  }
}

function operationReused(): ApiError {
  return new ApiError(
    409,
    "operation_id_reused",
    "同じ操作IDが別の操作内容で使用されています",
  );
}

export class StaticShopHarness {
  private yearIndex: number | null = null;
  private readonly items = new Map<ShopItemId, HarnessShopItemState>();
  private readonly operations = new Map<string, HarnessShopOperation>();

  constructor(private readonly deps: StaticShopHarnessDependencies) {}

  private syncYear(yearIndex: number): void {
    if (this.yearIndex === yearIndex) {
      return;
    }

    this.yearIndex = yearIndex;
    this.items.clear();
    for (const definition of PHASE5_SHOP_ITEMS) {
      this.items.set(definition.itemId, {
        purchasedCount: 0,
        usedCount: 0,
        quantityOwned: 0,
      });
    }
  }

  private currentItem(itemId: ShopItemId): HarnessShopItemState {
    const item = this.items.get(itemId);
    if (!item) {
      throw new ApiError(409, "item_not_found", "商品を確認できません");
    }
    return item;
  }

  getStatus(): ShopStatusResponse {
    const game = this.deps.getGame();
    this.syncYear(game.yearIndex);

    return {
      revision: game.revision,
      academicYearIndex: game.yearIndex,
      items: PHASE5_SHOP_ITEMS.map((definition) => {
        const item = this.currentItem(definition.itemId);
        const status = evaluateShopItemStatus(
          definition,
          item,
          item.quantityOwned,
        );
        return {
          itemId: definition.itemId,
          displayName: definition.displayName,
          description: definition.description,
          priceYen: definition.priceYen,
          annualPurchaseLimit: definition.annualPurchaseLimit,
          annualUseLimit: definition.annualUseLimit,
          purchasedCount: item.purchasedCount,
          usedCount: item.usedCount,
          quantityOwned: item.quantityOwned,
          canPurchase: status.canPurchase,
          purchaseBlockedReason: status.purchaseBlockedReason,
          canUse: status.canUse,
          useBlockedReason: status.useBlockedReason,
        };
      }),
    };
  }

  purchase(request: ShopPurchaseRequest): ShopPurchaseResponse {
    const fingerprint = purchaseFingerprint(request);
    const cached = this.operations.get(request.operationId);
    if (cached) {
      if (
        cached.operationType === "purchase" &&
        cached.fingerprint === fingerprint
      ) {
        return cached.response;
      }
      throw operationReused();
    }

    const game = this.deps.getGame();
    if (request.revision !== game.revision) {
      throw new ApiError(
        409,
        "revision_conflict",
        "別の操作でテスト用データが更新されています",
      );
    }
    this.syncYear(game.yearIndex);

    const definition = getShopItemDefinition(request.itemId);
    const item = this.currentItem(request.itemId);
    if (item.purchasedCount >= definition.annualPurchaseLimit) {
      throw new ApiError(
        409,
        "purchase_limit_reached",
        "この年度の購入上限に達しています",
      );
    }

    item.purchasedCount += 1;
    item.quantityOwned += 1;
    const revision = game.revision + 1;
    const response: ShopPurchaseResponse = {
      operationId: request.operationId,
      operationType: "purchase",
      revision,
      academicYearIndex: game.yearIndex,
      itemId: request.itemId,
      quantityOwned: item.quantityOwned,
      purchasedCount: item.purchasedCount,
      usedCount: item.usedCount,
    };
    this.deps.commitRevision(revision);
    this.operations.set(request.operationId, {
      operationType: "purchase",
      fingerprint,
      response,
    });
    return response;
  }

  use(request: ShopUseRequest): ShopUseResponse {
    const fingerprint = shopUseFingerprint(request);
    const cached = this.operations.get(request.operationId);
    if (cached) {
      if (
        cached.operationType === "use" &&
        cached.fingerprint === fingerprint
      ) {
        return cached.response;
      }
      throw operationReused();
    }

    const game = this.deps.getGame();
    if (request.revision !== game.revision) {
      throw new ApiError(
        409,
        "revision_conflict",
        "別の操作でテスト用データが更新されています",
      );
    }
    this.syncYear(game.yearIndex);

    if (!targetMatches(request)) {
      throw new ApiError(
        409,
        "invalid_target",
        "このアイテムの使用対象を確認してください",
      );
    }

    const definition = getShopItemDefinition(request.itemId);
    const item = this.currentItem(request.itemId);
    if (item.usedCount >= definition.annualUseLimit) {
      throw new ApiError(
        409,
        "use_limit_reached",
        "この年度の使用上限に達しています",
      );
    }
    if (item.quantityOwned <= 0) {
      throw new ApiError(
        409,
        "inventory_empty",
        "このアイテムを所持していません",
      );
    }

    const revision = game.revision + 1;
    const result = this.deps.commitUse
      ? this.deps.commitUse(request, revision)
      : { itemId: request.itemId };
    item.quantityOwned -= 1;
    item.usedCount += 1;
    const response: ShopUseResponse = {
      operationId: request.operationId,
      operationType: "use",
      revision,
      academicYearIndex: game.yearIndex,
      itemId: request.itemId,
      quantityOwned: item.quantityOwned,
      purchasedCount: item.purchasedCount,
      usedCount: item.usedCount,
      result,
    };
    if (!this.deps.commitUse) {
      this.deps.commitRevision(revision);
    }
    this.operations.set(request.operationId, {
      operationType: "use",
      fingerprint,
      response,
    });
    return response;
  }
}