import { render, screen } from "@testing-library/react";
import type { ComponentProps, ComponentType } from "react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import type { ScoutReport } from "../../../../src/domain/scouting/scoutReport";
import {
  PHASE5_SHOP_ITEMS,
  type ShopItemId,
} from "../../../../src/domain/shop/shopCatalog";
import type {
  ShopStatusResponse,
  ShopUseTarget,
} from "../../../../src/domain/shop/shopContracts";
import { ScoutingScreen } from "../../../../src/features/scouting/ScoutingScreen";
import { ShopScreen } from "../../../../src/features/shop/ShopScreen";

interface ShopUsePresentation {
  itemId: ShopItemId;
  result: Record<string, unknown>;
  target?: ShopUseTarget;
  beforeScoutReport?: ScoutReport;
  afterScoutReport?: ScoutReport;
}

type ResultShopProps = ComponentProps<typeof ShopScreen> & {
  latestUseResult: ShopUsePresentation | null;
};

const ResultShopScreen = ShopScreen as ComponentType<ResultShopProps>;

type ResultScoutingProps = ComponentProps<typeof ScoutingScreen> & {
  latestShopUseResult: ShopUsePresentation | null;
};

const ResultScoutingScreen =
  ScoutingScreen as ComponentType<ResultScoutingProps>;

function emptyStatus(): ShopStatusResponse {
  return {
    revision: 8,
    academicYearIndex: 2,
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

function renderResultShop(latestUseResult: ShopUsePresentation) {
  const state = createDemoGame();
  render(
    <ResultShopScreen
      error={null}
      latestUseResult={latestUseResult}
      loading={false}
      onBack={vi.fn()}
      onRetry={vi.fn()}
      state={state}
      status={emptyStatus()}
    />,
  );
  return state;
}

function report(
  candidateId: PlayerId,
  overall: [number, number],
  potential: [number, number],
  confidence: ScoutReport["confidence"],
): ScoutReport {
  return {
    candidateId,
    displayName: "青木 蓮",
    heightCm: 188,
    position: "OH",
    handedness: "right",
    middleSchoolAchievement: "prefectural-selection",
    evaluationStars: 4,
    estimatedOverall: { min: overall[0], max: overall[1] },
    estimatedPotential: { min: potential[0], max: potential[1] },
    confidence,
    comments: ["攻撃力に目を引くものがある"],
  };
}

describe("Phase 5 shop use result UX", () => {
  it("shows fatigue and condition before/after instead of only a generic success message", () => {
    renderResultShop({
      itemId: "fatigue-recovery",
      result: {
        playerId: "player-a",
        before: { fatigue: 80, condition: 70 },
        after: { fatigue: 40, condition: 80 },
      },
    });

    expect(
      screen.getByRole("heading", { name: "疲労回復の結果" }),
    ).toBeVisible();
    expect(screen.getByText("疲労 80 → 40")).toBeVisible();
    expect(screen.getByText("状態 70 → 80")).toBeVisible();
  });

  it("shows a compact training-camp summary with growth, fatigue, and injuries", () => {
    renderResultShop({
      itemId: "training-camp",
      result: {
        participantCount: 12,
        grewPlayerCount: 10,
        totalAbilityGrowth: 36,
        averageFatigueChange: 11.5,
        injuredPlayerIds: ["player-z"],
      },
    });

    expect(
      screen.getByRole("heading", { name: "強化合宿の結果" }),
    ).toBeVisible();
    expect(screen.getByText("参加 12人")).toBeVisible();
    expect(screen.getByText("能力成長 +36")).toBeVisible();
    expect(screen.getByText("平均疲労 +11.5")).toBeVisible();
    expect(screen.getByText("怪我 1人")).toBeVisible();
  });

  it("shows special-coach growth details for the selected player", () => {
    const state = createDemoGame();
    const school = state.schools[state.userSchoolId]!;
    const player = state.players[school.playerIds[0]!]!;

    render(
      <ResultShopScreen
        error={null}
        latestUseResult={{
          itemId: "special-coach",
          result: {
            playerId: player.id,
            focus: "spike",
            totalAbilityGrowth: 5,
            abilityChanges: { spike: 3, jump: 2 },
            fatigueChange: 6,
            conditionChange: -2,
            injury: null,
          },
          target: {
            type: "special-coach",
            playerId: player.id,
            focus: "spike",
          },
        }}
        loading={false}
        onBack={vi.fn()}
        onRetry={vi.fn()}
        state={state}
        status={emptyStatus()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "特別コーチの結果" }),
    ).toBeVisible();
    expect(
      screen.getByText(`${player.lastName} ${player.firstName}`),
    ).toBeVisible();
    expect(screen.getByText("能力成長 +5")).toBeVisible();
    expect(screen.getByText("スパイク +3")).toBeVisible();
    expect(screen.getByText("ジャンプ +2")).toBeVisible();
    expect(screen.getByText("疲労 +6")).toBeVisible();
  });

  it("confirms the next-training boost as a persistent pending effect", () => {
    renderResultShop({
      itemId: "training-efficiency-boost",
      result: { pending: true, percent: 20 },
    });

    expect(
      screen.getByRole("heading", { name: "練習効率アップの結果" }),
    ).toBeVisible();
    expect(
      screen.getByText("次回練習の成長効率 +20% を有効化しました"),
    ).toBeVisible();
  });

  it("shows scouting range and confidence changes after research", () => {
    const state = createDemoGame();
    const candidateId = "candidate-result-a" as PlayerId;
    const beforeScoutReport = report(candidateId, [58, 72], [72, 89], "medium");
    const afterScoutReport = report(candidateId, [62, 68], [78, 84], "high");

    render(
      <ResultScoutingScreen
        error={null}
        latestShopUseResult={{
          itemId: "scout-research",
          result: {
            candidateId,
            overallPrecision: "researched",
            potentialPrecision: "researched",
          },
          target: { type: "scouting-candidate", candidateId },
          beforeScoutReport,
          afterScoutReport,
        }}
        loading={false}
        onBack={vi.fn()}
        onRecruit={vi.fn()}
        onRetry={vi.fn()}
        recruitingCandidateId={null}
        reports={[afterScoutReport]}
        state={state}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "スカウト再調査の結果" }),
    ).toBeVisible();
    expect(screen.getByText("現在能力 58〜72 → 62〜68")).toBeVisible();
    expect(screen.getByText("将来性 72〜89 → 78〜84")).toBeVisible();
    expect(screen.getByText("調査精度 中 → 高")).toBeVisible();
  });
});
