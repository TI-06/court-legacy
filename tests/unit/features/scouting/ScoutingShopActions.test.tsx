import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { playerId } from "../../../../src/domain/model/identifiers";
import type { ScoutReport } from "../../../../src/domain/scouting/scoutReport";
import type { ShopStatusResponse } from "../../../../src/domain/shop/shopContracts";
import { ScoutingScreen } from "../../../../src/features/scouting/ScoutingScreen";

const candidateId = playerId("candidate-visible-item-action");

const report: ScoutReport = {
  candidateId,
  displayName: "中村 陸",
  heightCm: 179,
  position: "S",
  handedness: "right",
  middleSchoolAchievement: "unknown",
  evaluationStars: 2,
  estimatedOverall: { min: 31, max: 49 },
  estimatedPotential: { min: 58, max: 84 },
  confidence: "medium",
  comments: ["トスワークの感覚が良い", "現在のポジションで伸びしろがありそう"],
};

const shopStatus: ShopStatusResponse = {
  revision: 27,
  academicYearIndex: 1,
  items: [
    {
      itemId: "scout-research",
      displayName: "スカウト再調査",
      description: "指定した候補のスカウト情報を高精度で再調査します。",
      priceYen: 0,
      annualPurchaseLimit: 2,
      annualUseLimit: 2,
      purchasedCount: 1,
      usedCount: 0,
      quantityOwned: 1,
      canPurchase: true,
      purchaseBlockedReason: null,
      canUse: true,
      useBlockedReason: null,
    },
  ],
};

describe("ScoutingScreen shop actions", () => {
  it("presents owned scouting items as a clear action area with quantity", () => {
    const onUseShopItem = vi.fn();

    render(
      <ScoutingScreen
        state={createDemoGame()}
        reports={[report]}
        loading={false}
        error={null}
        recruitingCandidateId={null}
        shopStatus={shopStatus}
        onBack={vi.fn()}
        onRetry={vi.fn()}
        onRecruit={vi.fn()}
        onUseShopItem={onUseShopItem}
      />,
    );

    const itemActions = screen.getByRole("region", { name: "所持アイテム" });
    expect(within(itemActions).getByText("所持 1")).toBeVisible();
    const useButton = within(itemActions).getByRole("button", {
      name: "スカウト再調査 中村 陸",
    });
    expect(useButton).toHaveClass("scouting-shop-actions__button");

    fireEvent.click(useButton);
    expect(onUseShopItem).toHaveBeenCalledWith("scout-research", {
      type: "scouting-candidate",
      candidateId,
    });
  });
});
