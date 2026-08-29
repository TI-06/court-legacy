import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, ComponentType } from "react";
import { vi } from "vitest";
import {
  createDemoGame,
  gameData,
} from "../../../../src/app/createDemoGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import {
  PHASE5_SHOP_ITEMS,
  type ShopItemId,
} from "../../../../src/domain/shop/shopCatalog";
import type {
  ShopStatusResponse,
  ShopUseTarget,
} from "../../../../src/domain/shop/shopContracts";
import type { ScoutReport } from "../../../../src/domain/scouting/scoutReport";
import { ScoutingScreen } from "../../../../src/features/scouting/ScoutingScreen";
import { ShopScreen } from "../../../../src/features/shop/ShopScreen";
import { TrainingScreen } from "../../../../src/features/training/TrainingScreen";

function shopStatusWithOwned(
  ownedItemIds: readonly ShopItemId[],
): ShopStatusResponse {
  return {
    revision: 12,
    academicYearIndex: 3,
    items: PHASE5_SHOP_ITEMS.map((item) => {
      const owned = ownedItemIds.includes(item.itemId);
      return {
        itemId: item.itemId,
        displayName: item.displayName,
        description: item.description,
        priceYen: 0,
        annualPurchaseLimit: item.annualPurchaseLimit,
        annualUseLimit: item.annualUseLimit,
        purchasedCount: owned ? 1 : 0,
        usedCount: 0,
        quantityOwned: owned ? 1 : 0,
        canPurchase: !owned,
        purchaseBlockedReason: owned ? "purchase_limit_reached" : null,
        canUse: owned,
        useBlockedReason: owned ? null : "inventory_empty",
      };
    }),
  };
}

type TargetableShopProps = Omit<ComponentProps<typeof ShopScreen>, "onUse"> & {
  state: GameState;
  onUse: (itemId: ShopItemId, target?: ShopUseTarget) => void;
};

const TargetableShopScreen = ShopScreen as ComponentType<TargetableShopProps>;

type ShopAwareScoutingProps = ComponentProps<typeof ScoutingScreen> & {
  shopStatus: ShopStatusResponse | null;
  shopPendingItemId: ShopItemId | null;
  shopPendingCandidateId: PlayerId | null;
  onUseShopItem: (itemId: ShopItemId, target: ShopUseTarget) => void;
};

const ShopAwareScoutingScreen = ScoutingScreen as ComponentType<ShopAwareScoutingProps>;

function userSchoolPlayers(state: GameState) {
  const school = state.schools[state.userSchoolId]!;
  return school.playerIds.map((id) => state.players[id]!);
}

describe("Phase 5 targeted shop UX", () => {
  it("sorts fatigue-recovery targets by fatigue and submits the selected player", () => {
    const state = createDemoGame();
    const players = userSchoolPlayers(state);
    for (const player of players) {
      player.fatigue = 0;
      player.condition = 100;
    }
    players[0]!.fatigue = 25;
    players[1]!.fatigue = 80;
    players[2]!.fatigue = 50;

    const onUse = vi.fn();
    render(
      <TargetableShopScreen
        error={null}
        loading={false}
        onBack={vi.fn()}
        onPurchase={vi.fn()}
        onRetry={vi.fn()}
        onUse={onUse}
        state={state}
        status={shopStatusWithOwned(["fatigue-recovery"])}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "所持品" }));
    fireEvent.click(
      screen.getByRole("button", { name: "疲労回復を使用" }),
    );

    expect(
      screen.getByRole("heading", { name: "回復する選手を選択" }),
    ).toBeVisible();
    const targetButtons = screen.getAllByRole("button", { name: /疲労 \d+$/ });
    expect(targetButtons).toHaveLength(3);
    expect(targetButtons[0]).toHaveAccessibleName(
      `${players[1]!.lastName} ${players[1]!.firstName} 疲労 80`,
    );
    expect(targetButtons[1]).toHaveAccessibleName(
      `${players[2]!.lastName} ${players[2]!.firstName} 疲労 50`,
    );

    fireEvent.click(targetButtons[0]!);
    expect(onUse).toHaveBeenCalledWith("fatigue-recovery", {
      type: "player",
      playerId: players[1]!.id,
    });
  });

  it("excludes injured players from special-coach targets and then asks for one of six focuses", () => {
    const state = createDemoGame();
    const players = userSchoolPlayers(state);
    players[1]!.injury = {
      injuryId: "ankle",
      severity: "minor",
      remainingWeeks: 1,
      recurrenceRisk: 5,
    };
    const onUse = vi.fn();

    render(
      <TargetableShopScreen
        error={null}
        loading={false}
        onBack={vi.fn()}
        onPurchase={vi.fn()}
        onRetry={vi.fn()}
        onUse={onUse}
        state={state}
        status={shopStatusWithOwned(["special-coach"])}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "所持品" }));
    fireEvent.click(
      screen.getByRole("button", { name: "特別コーチを使用" }),
    );

    expect(
      screen.getByRole("heading", { name: "特別コーチの対象選手を選択" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: `${players[1]!.lastName} ${players[1]!.firstName}を選択`,
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: `${players[0]!.lastName} ${players[0]!.firstName}を選択`,
      }),
    );
    expect(
      screen.getByRole("heading", { name: "重点育成を選択" }),
    ).toBeVisible();
    for (const label of [
      "スパイク",
      "サーブ",
      "レシーブ",
      "ブロック",
      "フィジカル",
      "判断力",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeVisible();
    }

    fireEvent.click(screen.getByRole("button", { name: "スパイク" }));
    expect(onUse).toHaveBeenCalledWith("special-coach", {
      type: "special-coach",
      playerId: players[0]!.id,
      focus: "spike",
    });
  });

  it("offers scouting research and appraisal directly on each candidate card", () => {
    const state = createDemoGame();
    const candidateId = "candidate-shop-a" as PlayerId;
    const reports: ScoutReport[] = [
      {
        candidateId,
        displayName: "青木 蓮",
        heightCm: 188,
        position: "OH",
        handedness: "right",
        middleSchoolAchievement: "prefectural-selection",
        evaluationStars: 4,
        estimatedOverall: { min: 58, max: 72 },
        estimatedPotential: { min: 72, max: 89 },
        confidence: "medium",
        comments: ["攻撃力に目を引くものがある"],
      },
    ];
    const onUseShopItem = vi.fn();

    render(
      <ShopAwareScoutingScreen
        error={null}
        loading={false}
        onBack={vi.fn()}
        onRecruit={vi.fn()}
        onRetry={vi.fn()}
        onUseShopItem={onUseShopItem}
        recruitingCandidateId={null}
        reports={reports}
        shopPendingCandidateId={null}
        shopPendingItemId={null}
        shopStatus={shopStatusWithOwned([
          "scout-research",
          "potential-appraisal",
        ])}
        state={state}
      />,
    );

    const research = screen.getByRole("button", {
      name: "スカウト再調査 青木 蓮",
    });
    const appraisal = screen.getByRole("button", {
      name: "潜在能力鑑定 青木 蓮",
    });
    expect(research).toBeEnabled();
    expect(appraisal).toBeEnabled();

    fireEvent.click(research);
    expect(onUseShopItem).toHaveBeenCalledWith("scout-research", {
      type: "scouting-candidate",
      candidateId,
    });
  });

  it("shows the pending next-training +20% boost until normal training consumes it", () => {
    const state = createDemoGame();
    state.shopEffects = {
      nextTrainingGrowthBoost: {
        percent: 20,
        remainingUses: 1,
        sourceItemId: "training-efficiency-boost",
      },
    };

    const { rerender } = render(
      <TrainingScreen
        completed={false}
        data={gameData}
        latestResult={null}
        onExecute={vi.fn()}
        state={state}
      />,
    );

    expect(screen.getByText("次回練習 成長効率 +20%")).toBeVisible();

    const clearedState = structuredClone(state);
    clearedState.shopEffects = undefined;
    rerender(
      <TrainingScreen
        completed={false}
        data={gameData}
        latestResult={null}
        onExecute={vi.fn()}
        state={clearedState}
      />,
    );
    expect(screen.queryByText("次回練習 成長効率 +20%")).toBeNull();
  });
});
