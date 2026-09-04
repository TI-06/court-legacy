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
  userId: "user-shop-result",
  email: "coach@example.com",
  accessToken: "shop-result-token",
};

function snapshot(revision: number): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: session.userId,
    schoolDbId: "shop-result-school",
    revision,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function authClient(): AuthClient {
  return {
    getSession: vi.fn().mockResolvedValue(session),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    signInWithCredentials: vi.fn().mockResolvedValue(undefined),
    registerAccount: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    isPasswordRecovery: vi.fn().mockReturnValue(false),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

function status(revision: number, owned: boolean): ShopStatusResponse {
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
      purchasedCount: item.itemId === "training-camp" ? 1 : 0,
      usedCount: item.itemId === "training-camp" && !owned ? 1 : 0,
      quantityOwned: item.itemId === "training-camp" && owned ? 1 : 0,
      canPurchase: false,
      purchaseBlockedReason: "purchase_limit_reached",
      canUse: item.itemId === "training-camp" && owned,
      useBlockedReason:
        item.itemId === "training-camp" && owned ? null : "inventory_empty",
    })),
  };
}

describe("GameApp shop result presentation", () => {
  it("keeps the server use result visible after adopting the authoritative snapshot", async () => {
    const initial = snapshot(1);
    const updated = snapshot(2);
    const getShop = vi
      .fn<NonNullable<GameApiClient["getShop"]>>()
      .mockResolvedValueOnce(status(1, true))
      .mockResolvedValueOnce(status(2, false));
    const useShopItem = vi.fn<NonNullable<GameApiClient["useShopItem"]>>(
      async (_accessToken, request) => ({
        operationId: request.operationId,
        operationType: "use",
        revision: 2,
        academicYearIndex: 1,
        itemId: "training-camp",
        quantityOwned: 0,
        purchasedCount: 1,
        usedCount: 1,
        result: {
          participantCount: 12,
          grewPlayerCount: 10,
          totalAbilityGrowth: 36,
          averageFatigueChange: 11.5,
          injuredPlayerIds: ["player-z"],
        },
      }),
    );
    const api: GameApiClient = {
      bootstrap: vi.fn().mockResolvedValue({ status: "ready", game: updated }),
      onboard: vi.fn(),
      applyAction: vi.fn(),
      getShop,
      useShopItem,
    };

    render(
      <GameApp
        api={api}
        auth={authClient()}
        session={session}
        snapshot={initial}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.click(screen.getByRole("button", { name: "ショップ" }));
    await waitFor(() => expect(getShop).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "所持品" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "強化合宿を使用" }),
    );

    await waitFor(() => expect(useShopItem).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole("heading", { name: "強化合宿の結果" }),
    ).toBeVisible();
    expect(screen.getByText("能力成長 +36")).toBeVisible();
  });
});
