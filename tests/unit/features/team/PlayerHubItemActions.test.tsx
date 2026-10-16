import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame, gameData } from "../../../src/app/createDemoGame";
import { PHASE5_SHOP_ITEMS } from "../../../src/domain/shop/shopCatalog";
import type { ShopStatusResponse } from "../../../src/domain/shop/shopContracts";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import { PlayerHubScreen } from "../../../src/features/team/PlayerHubScreen";

function makeStatus(owned: number): ShopStatusResponse {
  return {
    revision: 1,
    academicYearIndex: 1,
    items: PHASE5_SHOP_ITEMS.map((item) => ({
      itemId: item.itemId,
      displayName: item.displayName,
      description: item.description,
      priceYen: 0,
      annualPurchaseLimit: item.annualPurchaseLimit,
      annualUseLimit: item.annualUseLimit,
      inventoryLimit: item.inventoryLimit,
      purchasedCount: owned,
      usedCount: 0,
      quantityOwned: owned,
      canPurchase: false,
      purchaseBlockedReason: "purchase_limit_reached",
      canUse: owned > 0,
      useBlockedReason: owned > 0 ? null : "inventory_empty",
    })),
  };
}

function renderItemActions(owned: number) {
  const state = createDemoGame();
  for (const playerId of state.schools[state.userSchoolId]!.playerIds) {
    const player = state.players[playerId]!;
    player.fatigue = 40;
    player.condition = 80;
    player.injury = null;
  }
  const onUseShopItem = vi.fn();
  const onLoadShopItems = vi.fn();
  const onOpenItemShop = vi.fn();
  render(
    <PlayerHubScreen
      data={gameData}
      onAssignLeadership={vi.fn()}
      onChange={vi.fn()}
      onLoadShopItems={onLoadShopItems}
      onOpenItemShop={onOpenItemShop}
      onUseShopItem={onUseShopItem}
      selection={autoSelectTeam({ state, schoolId: state.userSchoolId })}
      shopStatus={makeStatus(owned)}
      state={state}
    />,
  );
  fireEvent.click(screen.getAllByRole("button", { name: /^選手詳細 / })[0]!);
  fireEvent.click(screen.getByRole("button", { name: "アイテムを使う" }));
  return {
    onUseShopItem,
    onLoadShopItems,
    onOpenItemShop,
    sheet: screen.getByRole("dialog", { name: "選手アイテム" }),
  };
}

describe("player detail item actions", () => {
  it("uses fatigue recovery and special coach on the selected player", () => {
    const { onUseShopItem, onLoadShopItems, sheet } = renderItemActions(1);
    expect(onLoadShopItems).toHaveBeenCalledTimes(1);
    fireEvent.click(within(sheet).getByRole("button", { name: /疲労回復/ }));
    expect(onUseShopItem).toHaveBeenCalledWith(
      "fatigue-recovery",
      expect.objectContaining({
        type: "player",
        playerId: expect.any(String),
      }),
    );
    const playerId = onUseShopItem.mock.calls[0]![1].playerId;
    fireEvent.click(within(sheet).getByRole("button", { name: /特別コーチ/ }));
    fireEvent.click(within(sheet).getByRole("button", { name: "レシーブ" }));
    expect(onUseShopItem).toHaveBeenCalledWith("special-coach", {
      type: "special-coach",
      playerId,
      focus: "receive",
    });
  });

  it("disables item use when stock is empty and keeps shop access available", () => {
    const { onUseShopItem, onOpenItemShop, sheet } = renderItemActions(0);
    expect(within(sheet).getByRole("button", { name: /疲労回復/ })).toBeDisabled();
    expect(within(sheet).getByRole("button", { name: /特別コーチ/ })).toBeDisabled();
    fireEvent.click(within(sheet).getByRole("button", { name: "ショップへ" }));
    expect(onOpenItemShop).toHaveBeenCalledTimes(1);
    expect(onUseShopItem).not.toHaveBeenCalled();
  });
});
