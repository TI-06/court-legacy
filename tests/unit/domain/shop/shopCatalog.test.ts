import { describe, expect, it } from "vitest";
import {
  PHASE5_SHOP_ITEMS,
  getShopItemDefinition,
} from "../../../../src/domain/shop/shopCatalog";

describe("Phase 5 shop catalog", () => {
  it("contains exactly the seven approved zero-yen items", () => {
    expect(PHASE5_SHOP_ITEMS.map((item) => item.itemId)).toEqual([
      "extra-scout-candidate",
      "scout-research",
      "potential-appraisal",
      "training-camp",
      "fatigue-recovery",
      "special-coach",
      "training-efficiency-boost",
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

  it("keeps item display order stable", () => {
    expect(PHASE5_SHOP_ITEMS.map((item) => item.sortOrder)).toEqual([
      10, 20, 30, 40, 50, 60, 70,
    ]);
  });
});
