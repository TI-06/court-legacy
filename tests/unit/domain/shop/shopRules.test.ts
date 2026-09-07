import { describe, expect, it } from "vitest";
import { getShopItemDefinition } from "../../../../src/domain/shop/shopCatalog";
import {
  evaluateShopItemStatus,
  isUsableInventory,
} from "../../../../src/domain/shop/shopRules";

describe("shop annual and carry-over rules", () => {
  it("blocks purchase independently while allowing owned inventory use", () => {
    const definition = getShopItemDefinition("fatigue-recovery");

    expect(
      evaluateShopItemStatus(
        definition,
        { purchasedCount: 3, usedCount: 2 },
        1,
      ),
    ).toEqual({
      canPurchase: false,
      purchaseBlockedReason: "purchase_limit_reached",
      canUse: true,
      useBlockedReason: null,
    });
  });

  it("blocks use when the annual use limit is reached", () => {
    const definition = getShopItemDefinition("fatigue-recovery");

    expect(
      evaluateShopItemStatus(
        definition,
        { purchasedCount: 3, usedCount: 3 },
        1,
      ),
    ).toEqual({
      canPurchase: false,
      purchaseBlockedReason: "purchase_limit_reached",
      canUse: false,
      useBlockedReason: "use_limit_reached",
    });
  });

  it("blocks use when no inventory is owned", () => {
    const definition = getShopItemDefinition("fatigue-recovery");

    expect(
      evaluateShopItemStatus(
        definition,
        { purchasedCount: 1, usedCount: 0 },
        0,
      ),
    ).toEqual({
      canPurchase: true,
      purchaseBlockedReason: null,
      canUse: false,
      useBlockedReason: "inventory_empty",
    });
  });

  it("keeps prior-year inventory usable but rejects future-year and empty rows", () => {
    expect(
      isUsableInventory({
        inventoryYearIndex: 8,
        currentYearIndex: 9,
        quantityRemaining: 2,
      }),
    ).toBe(true);
    expect(
      isUsableInventory({
        inventoryYearIndex: 9,
        currentYearIndex: 9,
        quantityRemaining: 1,
      }),
    ).toBe(true);
    expect(
      isUsableInventory({
        inventoryYearIndex: 10,
        currentYearIndex: 9,
        quantityRemaining: 1,
      }),
    ).toBe(false);
    expect(
      isUsableInventory({
        inventoryYearIndex: 8,
        currentYearIndex: 9,
        quantityRemaining: 0,
      }),
    ).toBe(false);
  });
});
