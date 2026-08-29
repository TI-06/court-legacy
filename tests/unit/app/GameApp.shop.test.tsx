import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { GameApp } from "../../../src/app/GameApp";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { PHASE5_SHOP_ITEMS } from "../../../src/domain/shop/shopCatalog";
import type { ShopStatusResponse } from "../../../src/domain/shop/shopContracts";
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

    await waitFor(() => expect(getShop).toHaveBeenCalledTimes(1));
    expect(getShop).toHaveBeenCalledWith(session.accessToken);
    expect(
      await screen.findByRole("heading", { name: "ショップ" }),
    ).toBeVisible();
  });
});
