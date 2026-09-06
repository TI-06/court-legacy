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
  userId: "user-school-economy",
  email: "coach@example.com",
  accessToken: "school-economy-token",
};

function createSnapshot(revision: number, funds: number): CloudGameSnapshot {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  state.schools[state.userSchoolId] = { ...school, funds };
  return {
    userId: session.userId,
    schoolDbId: "school-economy-db",
    revision,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function createStatus(
  revision: number,
  purchasedGrantCount: number,
): ShopStatusResponse {
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
      purchasedCount:
        item.itemId === "funds-grant-300" ? purchasedGrantCount : 0,
      usedCount: 0,
      quantityOwned: 0,
      canPurchase: item.itemId !== "funds-grant-300" || purchasedGrantCount < 3,
      purchaseBlockedReason:
        item.itemId === "funds-grant-300" && purchasedGrantCount >= 3
          ? "purchase_limit_reached"
          : null,
      canUse: false,
      useBlockedReason: "inventory_empty",
    })),
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

describe("GameApp school economy shop flow", () => {
  it("shows the authoritative balance returned by an immediate fund grant", async () => {
    const initial = createSnapshot(1, 700);
    const granted = createSnapshot(2, 1000);
    const getShop = vi
      .fn<NonNullable<GameApiClient["getShop"]>>()
      .mockResolvedValueOnce(createStatus(1, 0))
      .mockResolvedValueOnce(createStatus(2, 1));
    const purchaseShopItem = vi.fn<
      NonNullable<GameApiClient["purchaseShopItem"]>
    >(async (_accessToken, request) => ({
      operationId: request.operationId,
      operationType: "purchase",
      revision: 2,
      academicYearIndex: 1,
      itemId: "funds-grant-300",
      quantityOwned: 0,
      purchasedCount: 1,
      usedCount: 0,
      result: { fundsGranted: 300, balanceAfter: 1000 },
    }));
    const bootstrap = vi
      .fn<GameApiClient["bootstrap"]>()
      .mockResolvedValueOnce({ status: "ready", game: granted });
    const api: GameApiClient = {
      bootstrap,
      onboard: vi.fn(),
      applyAction: vi.fn(),
      getShop,
      purchaseShopItem,
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

    fireEvent.click(
      await screen.findByRole("button", { name: "資金 +300を受け取る" }),
    );

    await waitFor(() => expect(purchaseShopItem).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(bootstrap).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getShop).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("資金 +300 / 残高 1,000")).toBeVisible();
    expect(screen.getByText("年度残り 2 / 3")).toBeVisible();
  });
});
