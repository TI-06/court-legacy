import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../../src/domain/team/autoSelectTeam";
import type { GameStore } from "../../../../worker/data/GameStore";
import type { ShopStore } from "../../../../worker/data/ShopStore";
import { createShopStatusHandler } from "../../../../worker/routes/shopStatus";

function createGameStore(): GameStore {
  const state = createInitialGame({
    seed: "shop-status-fixture",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
  state.yearIndex = 4;
  const snapshot = {
    userId: "user-123",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 7,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };

  return {
    getSnapshot: vi.fn(async () => snapshot),
    getOperationResponse: vi.fn(async () => null),
    createGame: vi.fn(async () => snapshot),
    applyOperation: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

function createShopStore(): ShopStore {
  return {
    getStatus: vi.fn(async () => [
      {
        academicYearIndex: 4,
        itemId: "fatigue-recovery",
        displayName: "疲労回復",
        description: "指定した選手1名の疲労を大きく回復します。",
        priceYen: 0,
        annualPurchaseLimit: 3,
        annualUseLimit: 3,
        purchasedCount: 1,
        usedCount: 0,
        quantityOwned: 1,
        enabled: true,
        sortOrder: 50,
      },
      {
        academicYearIndex: 4,
        itemId: "training-camp",
        displayName: "強化合宿",
        description: "チーム全体へ追加の特別育成を実施します。",
        priceYen: 0,
        annualPurchaseLimit: 1,
        annualUseLimit: 1,
        purchasedCount: 1,
        usedCount: 1,
        quantityOwned: 0,
        enabled: true,
        sortOrder: 40,
      },
    ]),
    purchase: vi.fn(async () => {
      throw new Error("not used");
    }),
    use: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

describe("shop status route", () => {
  it("returns current in-game-year shop status with server-derived availability", async () => {
    const gameStore = createGameStore();
    const shopStore = createShopStore();
    const handler = createShopStatusHandler({ gameStore, shopStore });

    const response = await handler(
      new Request("https://court-legacy.test/api/shop"),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    expect(shopStore.getStatus).toHaveBeenCalledWith("user-123", 4);
    await expect(response.json()).resolves.toEqual({
      revision: 7,
      academicYearIndex: 4,
      items: [
        {
          itemId: "fatigue-recovery",
          displayName: "疲労回復",
          description: "指定した選手1名の疲労を大きく回復します。",
          priceYen: 0,
          annualPurchaseLimit: 3,
          annualUseLimit: 3,
          purchasedCount: 1,
          usedCount: 0,
          quantityOwned: 1,
          canPurchase: true,
          purchaseBlockedReason: null,
          canUse: true,
          useBlockedReason: null,
        },
        {
          itemId: "training-camp",
          displayName: "強化合宿",
          description: "チーム全体へ追加の特別育成を実施します。",
          priceYen: 0,
          annualPurchaseLimit: 1,
          annualUseLimit: 1,
          purchasedCount: 1,
          usedCount: 1,
          quantityOwned: 0,
          canPurchase: false,
          purchaseBlockedReason: "purchase_limit_reached",
          canUse: false,
          useBlockedReason: "use_limit_reached",
        },
      ],
    });
  });

  it("requires an initialized game before exposing shop state", async () => {
    const gameStore = createGameStore();
    vi.mocked(gameStore.getSnapshot).mockResolvedValue(null);
    const shopStore = createShopStore();
    const handler = createShopStatusHandler({ gameStore, shopStore });

    const response = await handler(
      new Request("https://court-legacy.test/api/shop"),
      { id: "user-123" },
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("game_not_initialized");
    expect(shopStore.getStatus).not.toHaveBeenCalled();
  });
});
