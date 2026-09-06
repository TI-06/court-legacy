import { describe, expect, it } from "vitest";
import {
  PHASE5_SHOP_ITEMS,
  getShopItemDefinition,
  shopFundsGrantAmount,
} from "../../../../src/domain/shop/shopCatalog";

describe("Phase 5 shop catalog", () => {
  it("contains the approved zero-yen items including immediate fund grants", () => {
    expect(PHASE5_SHOP_ITEMS.map((item) => item.itemId)).toEqual([
      "extra-scout-candidate",
      "scout-research",
      "potential-appraisal",
      "training-camp",
      "fatigue-recovery",
      "special-coach",
      "training-efficiency-boost",
      "funds-grant-300",
      "funds-grant-1000",
      "funds-grant-3000",
    ]);
    expect(PHASE5_SHOP_ITEMS.every((item) => item.priceYen === 0)).toBe(true);
    expect(
      PHASE5_SHOP_ITEMS.every(
        (item) => item.annualPurchaseLimit === item.annualUseLimit,
      ),
    ).toBe(true);
  });

  it("defines fatigue recovery as a player item with a three-use annual limit", () => {
    expect(getShopItemDefinition("fatigue-recovery")).toMatchObject({
      itemId: "fatigue-recovery",
      displayName: "疲労回復",
      targetKind: "player",
      annualPurchaseLimit: 3,
      annualUseLimit: 3,
      priceYen: 0,
    });
  });

  it("defines immediate fund grants and their canonical amounts", () => {
    expect(getShopItemDefinition("funds-grant-300")).toMatchObject({
      displayName: "資金 +300",
      priceYen: 0,
      annualPurchaseLimit: 3,
      targetKind: "none",
    });
    expect(shopFundsGrantAmount("funds-grant-300")).toBe(300);
    expect(shopFundsGrantAmount("funds-grant-1000")).toBe(1000);
    expect(shopFundsGrantAmount("funds-grant-3000")).toBe(3000);
    expect(shopFundsGrantAmount("fatigue-recovery")).toBeNull();
  });

  it("keeps item display order stable", () => {
    expect(PHASE5_SHOP_ITEMS.map((item) => item.sortOrder)).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });
});
