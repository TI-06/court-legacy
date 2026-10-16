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
      screen.getByRole("heading", { name: "強化合宿を予約しました" }),
    ).toBeVisible();
    expect(screen.queryByText("合宿を予約しました ✓")).toBeNull();
    expect(screen.queryByText(/強化合宿を予約中/)).toBeNull();
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
