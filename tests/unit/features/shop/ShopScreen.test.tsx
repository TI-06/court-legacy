import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { PHASE5_SHOP_ITEMS } from "../../../../src/domain/shop/shopCatalog";
import type { ShopStatusResponse } from "../../../../src/domain/shop/shopContracts";
import { ShopScreen } from "../../../../src/features/shop/ShopScreen";

function createStatus(): ShopStatusResponse {
  return {
    revision: 8,
    academicYearIndex: 4,
    items: PHASE5_SHOP_ITEMS.map((item, index) => ({
      itemId: item.itemId,
      displayName: item.displayName,
      description: item.description,
      priceYen: 0,
      annualPurchaseLimit: item.annualPurchaseLimit,
      annualUseLimit: item.annualUseLimit,
      purchasedCount:
        item.itemId === "funds-grant-300"
          ? 1
          : index === 0
            ? item.annualPurchaseLimit
            : index === 4
              ? 2
              : 0,
      usedCount: index === 4 ? 1 : 0,
      quantityOwned:
        item.itemId === "funds-grant-300" ? 0 : index === 4 ? 2 : 0,
      canPurchase: index !== 0,
      purchaseBlockedReason: index === 0 ? "purchase_limit_reached" : null,
      canUse: index === 4,
      useBlockedReason: index === 4 ? null : "inventory_empty",
    })),
  };
}

function renderShop(
  overrides: Partial<React.ComponentProps<typeof ShopScreen>> = {},
) {
  const props: React.ComponentProps<typeof ShopScreen> = {
    status: createStatus(),
    loading: false,
    error: null,
    pendingAction: null,
    pendingItemId: null,
    resultMessage: null,
    onBack: vi.fn(),
    onRetry: vi.fn(),
    onPurchase: vi.fn(),
    onUse: vi.fn(),
    ...overrides,
  };
  render(<ShopScreen {...props} />);
  return props;
}

describe("ShopScreen", () => {
  it("keeps a visible loading state with Japanese labels instead of rendering a blank screen", () => {
    renderShop({ status: null, loading: true });

    expect(screen.getByRole("heading", { name: "ショップ" })).toBeVisible();
    expect(screen.getByText("ショップ案内")).toBeVisible();
    expect(screen.getByText("テスト中 / すべて¥0")).toBeVisible();
    expect(screen.queryByText("SHOP")).toBeNull();
    expect(screen.queryByText("TEST / ALL ¥0")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "ショップ情報を読み込んでいます…",
    );
  });

  it("renders all zero-yen products with annual limits and blocked purchase reasons", () => {
    renderShop();

    expect(screen.getByRole("button", { name: "商品" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "所持品" })).toBeVisible();

    for (const item of PHASE5_SHOP_ITEMS) {
      expect(screen.getByText(item.displayName)).toBeVisible();
    }
    expect(screen.getAllByText("¥0")).toHaveLength(PHASE5_SHOP_ITEMS.length);
    expect(screen.getByText("今年度の上限に達しました")).toBeVisible();
    expect(screen.getByText("購入 1 / 1")).toBeVisible();
    expect(screen.getByText("所持 2")).toBeVisible();
  });

  it("renders fund grants as immediate claims and keeps them out of inventory", () => {
    const props = renderShop();

    expect(screen.getByText("年度残り 2 / 3")).toBeVisible();
    const button = screen.getByRole("button", {
      name: "資金 +300を受け取る",
    });
    expect(button).toHaveTextContent("¥0で受け取る");
    fireEvent.click(button);
    expect(props.onPurchase).toHaveBeenCalledWith("funds-grant-300");

    fireEvent.click(screen.getByRole("button", { name: "所持品" }));
    expect(screen.queryByText("資金 +300")).not.toBeInTheDocument();
  });

  it("does not reuse a previous fund grant message for a later shop action", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    state.schools[state.userSchoolId] = { ...school, funds: 1000 };
    const baseProps: React.ComponentProps<typeof ShopScreen> = {
      status: createStatus(),
      loading: false,
      error: null,
      state,
      resultMessage: null,
      onBack: vi.fn(),
      onRetry: vi.fn(),
      onPurchase: vi.fn(),
      onUse: vi.fn(),
    };
    const { rerender } = render(<ShopScreen {...baseProps} />);

    fireEvent.click(
      screen.getByRole("button", { name: "資金 +300を受け取る" }),
    );
    rerender(<ShopScreen {...baseProps} resultMessage="購入しました ✓" />);
    expect(screen.getByText("資金 +300 / 残高 1,000")).toBeVisible();

    rerender(<ShopScreen {...baseProps} resultMessage="使用しました ✓" />);
    expect(screen.getByText("使用しました ✓")).toBeVisible();
    expect(
      screen.queryByText("資金 +300 / 残高 1,000"),
    ).not.toBeInTheDocument();
  });

  it("shows only owned items in inventory and delegates use actions", () => {
    const props = renderShop();

    fireEvent.click(screen.getByRole("button", { name: "所持品" }));

    expect(screen.getByText("疲労回復")).toBeVisible();
    expect(screen.getByText("×2")).toBeVisible();
    expect(screen.getByText("今年度のみ有効")).toBeVisible();
    expect(screen.queryByText("強化合宿")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "疲労回復を使用" }));
    expect(props.onUse).toHaveBeenCalledWith("fatigue-recovery");
  });

  it("shows pending, success, and error states with retry controls", () => {
    const onRetry = vi.fn();
    renderShop({
      error: "ショップ情報を読み込めませんでした",
      pendingAction: "purchase",
      pendingItemId: "fatigue-recovery",
      resultMessage: "購入しました ✓",
      onRetry,
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "ショップ情報を読み込めませんでした",
    );
    expect(screen.getByText("購入しました ✓")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "疲労回復を購入処理中…" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
