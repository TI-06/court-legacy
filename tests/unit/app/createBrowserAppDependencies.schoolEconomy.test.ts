import { describe, expect, it } from "vitest";
import { createBrowserAppDependencies } from "../../../src/app/createBrowserAppDependencies";

describe("browser shop school economy harness", () => {
  it("applies an immediate fund grant once without creating inventory", async () => {
    const { api } = createBrowserAppDependencies({ MODE: "test" });
    expect(api.getShop).toBeDefined();
    expect(api.purchaseShopItem).toBeDefined();

    const initial = await api.bootstrap("e2e-access-token");
    expect(initial.status).toBe("ready");
    if (initial.status !== "ready") return;
    expect(
      initial.game.state.schools[initial.game.state.userSchoolId]!.funds,
    ).toBe(700);

    const status = await api.getShop!("e2e-access-token");
    const request = {
      operationId: "school-economy-grant-001",
      revision: status.revision,
      itemId: "funds-grant-300" as const,
    };
    const granted = await api.purchaseShopItem!("e2e-access-token", request);

    expect(granted).toMatchObject({
      revision: 2,
      itemId: "funds-grant-300",
      quantityOwned: 0,
      purchasedCount: 1,
      usedCount: 0,
      result: { fundsGranted: 300, balanceAfter: 1000 },
    });

    const after = await api.bootstrap("e2e-access-token");
    expect(after.status).toBe("ready");
    if (after.status !== "ready") return;
    expect(after.game.state.schools[after.game.state.userSchoolId]!.funds).toBe(
      1000,
    );
    expect(after.game.state.schoolManagement.fundsHistory.at(-1)).toMatchObject({
      id: "shop-grant:school-economy-grant-001",
      kind: "shop-grant",
      amount: 300,
      balanceAfter: 1000,
      relatedId: "funds-grant-300",
    });

    const replay = await api.purchaseShopItem!("e2e-access-token", request);
    expect(replay).toEqual(granted);
    const replayedState = await api.bootstrap("e2e-access-token");
    expect(replayedState.status).toBe("ready");
    if (replayedState.status !== "ready") return;
    expect(
      replayedState.game.state.schoolManagement.fundsHistory.filter(
        (entry) => entry.id === "shop-grant:school-economy-grant-001",
      ),
    ).toHaveLength(1);

    const finalStatus = await api.getShop!("e2e-access-token");
    expect(
      finalStatus.items.find((item) => item.itemId === "funds-grant-300"),
    ).toMatchObject({
      purchasedCount: 1,
      quantityOwned: 0,
      canUse: false,
      useBlockedReason: "inventory_empty",
    });
  });
});
