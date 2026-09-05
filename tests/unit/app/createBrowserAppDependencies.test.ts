import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createBrowserAppDependencies,
  E2E_SERVER_SNAPSHOT_KEY,
} from "../../../src/app/createBrowserAppDependencies";
import { ApiError } from "../../../src/services/api/GameApiClient";

describe("createBrowserAppDependencies E2E harness", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("starts in persistent local mode when Supabase auth is not configured", async () => {
    const first = createBrowserAppDependencies({});
    const session = await first.auth.getSession();

    expect(session).toMatchObject({
      userId: "e2e-user",
      accessToken: "e2e-access-token",
    });

    const initial = await first.api.bootstrap(session!.accessToken);
    expect(initial.status).toBe("ready");
    if (initial.status !== "ready") return;

    await first.api.applyAction(session!.accessToken, {
      operationId: "op-local-fallback-1",
      revision: initial.game.revision,
      action: { type: "facility-upgrade", facility: "trainingRoom" },
    });

    const second = createBrowserAppDependencies({});
    const reloaded = await second.api.bootstrap(session!.accessToken);
    expect(reloaded.status).toBe("ready");
    if (reloaded.status !== "ready") return;
    expect(reloaded.game.revision).toBe(initial.game.revision + 1);
  });

  it("migrates a persisted pre-Phase10 local snapshot before bootstrap", async () => {
    const first = createBrowserAppDependencies({});
    const session = await first.auth.getSession();
    const initial = await first.api.bootstrap(session!.accessToken);
    expect(initial.status).toBe("ready");
    if (initial.status !== "ready") return;

    const legacyState = Object.fromEntries(
      Object.entries(initial.game.state).filter(
        ([key]) => key !== "notifications" && key !== "schoolManagement",
      ),
    );
    legacyState.schemaVersion = 5;
    window.sessionStorage.setItem(
      E2E_SERVER_SNAPSHOT_KEY,
      JSON.stringify({
        ...initial.game,
        state: legacyState,
      }),
    );

    const second = createBrowserAppDependencies({});
    const reloaded = await second.api.bootstrap(session!.accessToken);
    expect(reloaded.status).toBe("ready");
    if (reloaded.status !== "ready") return;
    expect(reloaded.game.state.schemaVersion).toBe(7);
    expect(reloaded.game.state.notifications).toEqual({ items: [] });
    expect(reloaded.game.state.schoolManagement).toEqual({
      assistantCoach: null,
      fundsHistory: [],
      lastAnnualBudgetYearIndex: reloaded.game.state.yearIndex,
    });
  });

  it("does not import server-only scouting or shop authority into the browser adapter", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/createBrowserAppDependencies.ts"),
      "utf8",
    );

    expect(source).not.toContain("worker/scouting/serverScoutingBoard");
    expect(source).not.toContain("worker/data/ScoutingStore");
    expect(source).not.toContain("worker/data/ShopStore");
    expect(source).not.toContain("SupabaseShopStore");
    expect(source).not.toContain("worker/shop/");
  });

  it("persists authoritative game actions across bootstrap calls", async () => {
    const { api } = createBrowserAppDependencies({ MODE: "test" });

    const initial = await api.bootstrap("e2e-access-token");
    expect(initial.status).toBe("ready");
    if (initial.status !== "ready") return;
    expect(initial.game.revision).toBe(1);
    expect(
      initial.game.state.schools[initial.game.state.userSchoolId]!.funds,
    ).toBe(700);

    const response = await api.applyAction("e2e-access-token", {
      operationId: "op-facility-1",
      revision: initial.game.revision,
      action: { type: "facility-upgrade", facility: "trainingRoom" },
    });

    expect(response.game.revision).toBe(2);
    expect(
      response.game.state.schools[response.game.state.userSchoolId]!.funds,
    ).toBe(630);

    const reloaded = await api.bootstrap("e2e-access-token");
    expect(reloaded.status).toBe("ready");
    if (reloaded.status !== "ready") return;
    expect(reloaded.game.revision).toBe(2);
    expect(
      reloaded.game.state.schools[reloaded.game.state.userSchoolId]!.funds,
    ).toBe(630);
  });

  it("restores the E2E server snapshot when a new browser API client is created", async () => {
    const first = createBrowserAppDependencies({
      VITE_E2E_AUTH_BYPASS: "true",
    });
    const initial = await first.api.bootstrap("e2e-access-token");
    expect(initial.status).toBe("ready");
    if (initial.status !== "ready") return;

    await first.api.applyAction("e2e-access-token", {
      operationId: "op-reload-1",
      revision: initial.game.revision,
      action: { type: "facility-upgrade", facility: "trainingRoom" },
    });

    const second = createBrowserAppDependencies({
      VITE_E2E_AUTH_BYPASS: "true",
    });
    const reloaded = await second.api.bootstrap("e2e-access-token");
    expect(reloaded.status).toBe("ready");
    if (reloaded.status !== "ready") return;
    expect(reloaded.game.revision).toBe(2);
    expect(
      reloaded.game.state.schools[reloaded.game.state.userSchoolId]!.funds,
    ).toBe(630);
  });

  it("replays the same shop purchase without granting the item twice", async () => {
    const { api } = createBrowserAppDependencies({ MODE: "test" });
    expect(api.getShop).toBeDefined();
    expect(api.purchaseShopItem).toBeDefined();

    const initial = await api.getShop!("e2e-access-token");
    const request = {
      operationId: "shop-harness-replay-001",
      revision: initial.revision,
      itemId: "fatigue-recovery" as const,
    };

    const first = await api.purchaseShopItem!("e2e-access-token", request);
    const replay = await api.purchaseShopItem!("e2e-access-token", request);
    const status = await api.getShop!("e2e-access-token");
    const item = status.items.find(
      (candidate) => candidate.itemId === "fatigue-recovery",
    );

    expect(replay).toEqual(first);
    expect(first.quantityOwned).toBe(1);
    expect(first.purchasedCount).toBe(1);
    expect(item).toMatchObject({ quantityOwned: 1, purchasedCount: 1 });
  });

  it("enforces the annual purchase limit without mutating shop state", async () => {
    const { api } = createBrowserAppDependencies({ MODE: "test" });
    expect(api.getShop).toBeDefined();
    expect(api.purchaseShopItem).toBeDefined();

    const initial = await api.getShop!("e2e-access-token");
    const first = await api.purchaseShopItem!("e2e-access-token", {
      operationId: "shop-harness-limit-001",
      revision: initial.revision,
      itemId: "training-camp",
    });

    const error = await api.purchaseShopItem!("e2e-access-token", {
      operationId: "shop-harness-limit-002",
      revision: first.revision,
      itemId: "training-camp",
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "purchase_limit_reached",
    });

    const status = await api.getShop!("e2e-access-token");
    const item = status.items.find(
      (candidate) => candidate.itemId === "training-camp",
    );
    expect(item).toMatchObject({ quantityOwned: 1, purchasedCount: 1 });
  });
});
