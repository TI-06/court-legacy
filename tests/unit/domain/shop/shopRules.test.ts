import { describe, expect, it } from "vitest";
import { getShopItemDefinition } from "../../../../src/domain/shop/shopCatalog";
import {
  evaluateShopItemStatus,
  isUsableInventory,
} from "../../../../src/domain/shop/shopRules";

describe("shop annual and carry-over rules", () => {
  it("keeps purchase available at former annual cap counts", () => {
    const definition = getShopItemDefinition("fatigue-recovery");

    expect(
      evaluateShopItemStatus(
        definition,
        { purchasedCount: 3, usedCount: 2 },
        1,
      ),
    ).toEqual({
      canPurchase: true,
      purchaseBlockedReason: null,
      canUse: true,
      useBlockedReason: null,
    });
  });

  it("keeps use available at former annual cap counts", () => {
    const definition = getShopItemDefinition("fatigue-recovery");

    expect(
      evaluateShopItemStatus(
        definition,
        { purchasedCount: 3, usedCount: 3 },
        1,
      ),
    ).toEqual({
      canPurchase: true,
      purchaseBlockedReason: null,
      canUse: true,
      useBlockedReason: null,
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
