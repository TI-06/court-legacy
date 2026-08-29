import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { GameApp } from "../../../src/app/GameApp";
import { createDemoGame } from "../../../src/app/createDemoGame";
import {
  PHASE5_SHOP_ITEMS,
  type ShopItemId,
} from "../../../src/domain/shop/shopCatalog";
import type {
  ShopPublicStatusItem,
  ShopStatusResponse,
} from "../../../src/domain/shop/shopContracts";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { GameApiClient } from "../../../src/services/api/GameApiClient";
import type {
  AuthClient,
  AuthSession,
} from "../../../src/services/auth/AuthClient";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";

const session: AuthSession = {
  userId: "user-shop-1",
  email: "coach@example.com",
  accessToken: "shop-token",
};

function createSnapshot(revision = 1): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: session.userId,
    schoolDbId: "shop-school-db",
    revision,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function authClient(): AuthClient {
  return {
    getSession: vi.fn().mockResolvedValue(session),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

function createShopStatus(revision = 1): ShopStatusResponse {
  return {
    revision,
    academicYearIndex: 1,
    items: PHASE5_SHOP_ITEMS.map((item) => ({
      itemId: item.itemId,
      displayName: item.displayName,
      description: item.description,
      priceYen: 0,
      annualPurchaseLimit: item.annualPurchaseLimit,
      annualUseLimit: item.annualUseLimit,
      purchasedCount: 0,
      usedCount: 0,
      quantityOwned: 0,
      canPurchase: true,
      purchaseBlockedReason: null,
      canUse: false,
      useBlockedReason: "inventory_empty",
    })),
  };
}

function updateShopItem(
  status: ShopStatusResponse,
  itemId: ShopItemId,
  patch: Partial<ShopPublicStatusItem>,
): ShopStatusResponse {
  return {
    ...status,
    items: status.items.map((item) =>
      item.itemId === itemId ? { ...item, ...patch } : item,
    ),
  };
}

function renderShopApp(api: GameApiClient, snapshot = createSnapshot()) {
  render(
    <GameApp
      api={api}
      auth={authClient()}
      session={session}
      snapshot={snapshot}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "その他" }));
  fireEvent.click(screen.getByRole("button", { name: "ショップ" }));
}

describe("GameApp shop flow", () => {
  it("opens Shop from More and loads the current-year shop status", async () => {
    const snapshot = createSnapshot();
    const getShop = vi.fn<NonNullable<GameApiClient["getShop"]>>(async () =>
      createShopStatus(snapshot.revision),
    );
    const api: GameApiClient = {
      bootstrap: vi.fn(),
      onboard: vi.fn(),
      applyAction: vi.fn(),
      getShop,
    };

    renderShopApp(api, snapshot);

    await waitFor(() => expect(getShop).toHaveBeenCalledTimes(1));
    expect(getShop).toHaveBeenCalledWith(session.accessToken);
    expect(
      await screen.findByRole("heading", { name: "ショップ" }),
    ).toBeVisible();
  });

  it("purchases and uses a targetless item while adopting each new server revision", async () => {
    const initialSnapshot = createSnapshot(1);
    const purchasedSnapshot = createSnapshot(2);
    const usedSnapshot = createSnapshot(3);
    const initialStatus = createShopStatus(1);
    const purchasedStatus = updateShopItem(createShopStatus(2), "training-camp", {
      purchasedCount: 1,
      quantityOwned: 1,
      canPurchase: false,
      purchaseBlockedReason: "purchase_limit_reached",
      canUse: true,
      useBlockedReason: null,
    });
    const usedStatus = updateShopItem(createShopStatus(3), "training-camp", {
      purchasedCount: 1,
      usedCount: 1,
      quantityOwned: 0,
      canPurchase: false,
      purchaseBlockedReason: "purchase_limit_reached",
      canUse: false,
      useBlockedReason: "inventory_empty",
    });
    const getShop = vi
      .fn<NonNullable<GameApiClient["getShop"]>>()
      .mockResolvedValueOnce(initialStatus)
      .mockResolvedValueOnce(purchasedStatus)
      .mockResolvedValueOnce(usedStatus);
    const purchaseShopItem = vi.fn<
      NonNullable<GameApiClient["purchaseShopItem"]>
    >(async (_accessToken, request) => ({
      operationId: request.operationId,
      operationType: "purchase",
      revision: 2,
      academicYearIndex: 1,
      itemId: "training-camp",
      quantityOwned: 1,
      purchasedCount: 1,
      usedCount: 0,
    }));
    const useShopItem = vi.fn<NonNullable<GameApiClient["useShopItem"]>>(
      async (_accessToken, request) => ({
        operationId: request.operationId,
        operationType: "use",
        revision: 3,
        academicYearIndex: 1,
        itemId: "training-camp",
        quantityOwned: 0,
        purchasedCount: 1,
        usedCount: 1,
        result: { participantCount: 12 },
      }),
    );
    const bootstrap = vi
      .fn<GameApiClient["bootstrap"]>()
      .mockResolvedValueOnce({ status: "ready", game: purchasedSnapshot })
      .mockResolvedValueOnce({ status: "ready", game: usedSnapshot });
    const api: GameApiClient = {
      bootstrap,
      onboard: vi.fn(),
      applyAction: vi.fn(),
      getShop,
      purchaseShopItem,
      useShopItem,
    };

    renderShopApp(api, initialSnapshot);
    await screen.findByRole("heading", { name: "ショップ" });

    fireEvent.click(
      await screen.findByRole("button", { name: "強化合宿を購入" }),
    );

    await waitFor(() => expect(purchaseShopItem).toHaveBeenCalledTimes(1));
    expect(purchaseShopItem).toHaveBeenCalledWith(
      session.accessToken,
      expect.objectContaining({
        operationId: expect.any(String),
        revision: 1,
        itemId: "training-camp",
      }),
    );
    await waitFor(() => expect(bootstrap).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getShop).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("購入しました ✓")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "所持品" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "強化合宿を使用" }),
    );

    await waitFor(() => expect(useShopItem).toHaveBeenCalledTimes(1));
    expect(useShopItem).toHaveBeenCalledWith(
      session.accessToken,
      expect.objectContaining({
        operationId: expect.any(String),
        revision: 2,
        itemId: "training-camp",
      }),
    );
    await waitFor(() => expect(bootstrap).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(getShop).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("使用しました ✓")).toBeVisible();
    expect(
      await screen.findByText("今年度の所持アイテムはありません。"),
    ).toBeVisible();
  });
});
