import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { HomeQuickItems } from "../../../../src/features/home/HomeQuickItems";

describe("home quick-item feedback", () => {
  it("renders one scheduled camp result, not three stacked reservation notices", () => {
    const state = createDemoGame();
    state.shopEffects = {
      ...state.shopEffects,
      pendingTrainingCamp: {
        sourceItemId: "training-camp",
        scheduledDate: "2026-04-01",
      },
    };

    render(
      <HomeQuickItems
        error={null}
        latestUseResult={{
          itemId: "training-camp",
          result: { pending: true, scheduledDate: "2026-04-01" },
        }}
        loading={false}
        onOpenShop={vi.fn()}
        onRetry={vi.fn()}
        onRetryMutation={vi.fn()}
        onUse={vi.fn()}
        pending={false}
        resultMessage="合宿を予約しました ✓"
        retryAvailable={false}
        state={state}
        status={null}
      />,
    );

    expect(
      screen.getByRole("status", { name: "" }),
    ).toHaveTextContent("強化合宿：予約中（次週結果）");
    expect(screen.queryByRole("heading", { name: "強化合宿を予約しました" })).toBeNull();
    expect(screen.queryByText("合宿を予約しました ✓")).toBeNull();
    expect(screen.queryByText(/使用できるアイテムはありません/)).toBeNull();
  });

  it("keeps the camp reservation to one line even if more camp items remain", () => {
    const state = createDemoGame();
    state.shopEffects = {
      ...state.shopEffects,
      pendingTrainingCamp: {
        sourceItemId: "training-camp",
        scheduledDate: "2026-04-01",
      },
    };

    render(
      <HomeQuickItems
        error={null}
        latestUseResult={{
          itemId: "training-camp",
          result: { pending: true },
        }}
        loading={false}
        onOpenShop={vi.fn()}
        onRetry={vi.fn()}
        onRetryMutation={vi.fn()}
        onUse={vi.fn()}
        pending={false}
        resultMessage="合宿を予約しました ✓"
        retryAvailable={false}
        state={state}
        status={{
          revision: 1,
          academicYearIndex: 1,
          items: [{
            itemId: "training-camp",
            displayName: "強化合宿",
            description: "合宿",
            priceYen: 0,
            annualPurchaseLimit: 20,
            annualUseLimit: 20,
            inventoryLimit: null,
            purchasedCount: 2,
            usedCount: 1,
            quantityOwned: 1,
            canPurchase: true,
            purchaseBlockedReason: null,
            canUse: false,
            useBlockedReason: "use_limit_reached",
          }],
        }}
      />,
    );

    expect(screen.getAllByText("強化合宿：予約中（次週結果）")).toHaveLength(1);
    expect(screen.queryByText("適用中")).toBeNull();
    expect(screen.queryByText("強化合宿を予約しました")).toBeNull();
  });

  it("keeps other item effect details visible while a camp is reserved", () => {
    const state = createDemoGame();
    state.shopEffects = {
      ...state.shopEffects,
      pendingTrainingCamp: {
        sourceItemId: "training-camp",
        scheduledDate: "2026-04-01",
      },
    };
    render(
      <HomeQuickItems
        error={null}
        latestUseResult={{
          itemId: "training-efficiency-boost",
          result: { pending: true, percent: 15 },
        }}
        loading={false}
        onOpenShop={vi.fn()}
        onRetry={vi.fn()}
        onRetryMutation={vi.fn()}
        onUse={vi.fn()}
        pending={false}
        resultMessage="使用しました ✓"
        retryAvailable={false}
        state={state}
        status={null}
      />,
    );

    expect(screen.getByText("次回練習の成長効率 +15% を有効化しました")).toBeVisible();
    expect(screen.queryByText("強化合宿：予約中（次週結果）")).toBeNull();
  });

  it("retains a text confirmation when no detailed item result exists", () => {
    render(
      <HomeQuickItems
        error={null}
        loading={false}
        onOpenShop={vi.fn()}
        onRetry={vi.fn()}
        onRetryMutation={vi.fn()}
        onUse={vi.fn()}
        pending={false}
        resultMessage="使用しました ✓"
        retryAvailable={false}
        state={createDemoGame()}
        status={null}
      />,
    );

    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
      "使用しました ✓",
    );
  });
});
