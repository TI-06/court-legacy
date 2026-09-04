import { expect, test } from "@playwright/test";

const AUTH_STATE_KEY = "court-legacy:e2e-auth-state";
const GAME_STATE_KEY = "court-legacy:e2e-game-state";
const SNAPSHOT_KEY = "court-legacy:e2e-server-snapshot";
const FLOW_INITIALIZED_KEY = "court-legacy:e2e-flow-initialized";

test("login, onboarding, mutation, and reload keep the cloud game", async ({
  page,
}) => {
  await page.addInitScript(
    ({ authStateKey, gameStateKey, snapshotKey, flowInitializedKey }) => {
      if (sessionStorage.getItem(flowInitializedKey) === "true") {
        return;
      }
      sessionStorage.setItem(flowInitializedKey, "true");
      sessionStorage.setItem(authStateKey, "signed-out");
      sessionStorage.setItem(gameStateKey, "needs-onboarding");
      sessionStorage.removeItem(snapshotKey);
    },
    {
      authStateKey: AUTH_STATE_KEY,
      gameStateKey: GAME_STATE_KEY,
      snapshotKey: SNAPSHOT_KEY,
      flowInitializedKey: FLOW_INITIALIZED_KEY,
    },
  );

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "監督として始める" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Googleで始める" }).click();
  await expect(
    page.getByRole("heading", { name: "学校をつくる" }),
  ).toBeVisible();

  await page.getByLabel("表示名").fill("E2E監督");
  await page.getByLabel("学校名").fill("E2E高校");
  await page.getByLabel("略称").fill("E2E");
  await page.getByLabel("監督名").fill("高城 監督");
  await page.getByLabel("都道府県").selectOption("region.chiba");
  await page.getByRole("button", { name: "学校を作成" }).click();

  await expect(page.getByRole("main", { name: "ホーム" })).toBeVisible();
  await expect(page.getByText("E2E高校", { exact: true })).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await page.locator(".player-training-chip").first().click();
  await page
    .getByRole("dialog", { name: /の個人練習$/ })
    .getByRole("button", { name: /^攻撃/ })
    .click();
  await expect(page.locator(".operation-status")).toHaveText("保存済み ✓");

  await navigation.getByRole("button", { name: "ホーム", exact: true }).click();
  await page.getByRole("button", { name: "次の週へ進む" }).click();
  await expect(page.locator(".operation-status")).toHaveText("保存済み ✓");
  await expect
    .poll(() =>
      page.evaluate((snapshotKey) => {
        const raw = sessionStorage.getItem(snapshotKey);
        return raw ? JSON.parse(raw).revision : null;
      }, SNAPSHOT_KEY),
    )
    .toBe(3);

  await page.reload();

  await expect(page.getByRole("main", { name: "ホーム" })).toBeVisible();
  await expect(page.getByText("E2E高校", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((snapshotKey) => {
        const raw = sessionStorage.getItem(snapshotKey);
        return raw ? JSON.parse(raw).revision : null;
      }, SNAPSHOT_KEY),
    )
    .toBe(3);
});
