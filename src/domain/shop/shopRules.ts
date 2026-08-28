import type { ShopItemDefinition } from "./shopCatalog";

export interface ShopYearCounters {
  purchasedCount: number;
  usedCount: number;
}

export interface ShopItemStatus {
  canPurchase: boolean;
  purchaseBlockedReason: "purchase_limit_reached" | null;
  canUse: boolean;
  useBlockedReason: "use_limit_reached" | "inventory_empty" | null;
}

export function evaluateShopItemStatus(
  definition: ShopItemDefinition,
  counters: ShopYearCounters,
  quantityOwned: number,
): ShopItemStatus {
  const canPurchase = counters.purchasedCount < definition.annualPurchaseLimit;
  const useLimitReached = counters.usedCount >= definition.annualUseLimit;
  const inventoryEmpty = quantityOwned <= 0;

  return {
    canPurchase,
    purchaseBlockedReason: canPurchase ? null : "purchase_limit_reached",
    canUse: !useLimitReached && !inventoryEmpty,
    useBlockedReason: useLimitReached
      ? "use_limit_reached"
      : inventoryEmpty
        ? "inventory_empty"
        : null,
  };
}

export interface InventoryYearInput {
  inventoryYearIndex: number;
  currentYearIndex: number;
  quantityRemaining: number;
}

export function isCurrentYearInventory(input: InventoryYearInput): boolean {
  return (
    input.inventoryYearIndex === input.currentYearIndex &&
    input.quantityRemaining > 0
  );
}
