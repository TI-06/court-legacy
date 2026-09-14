import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const bodyWidth = await page.locator("body").evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
}

test("mobile app shell keeps primary tabs visible without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("button", { name: "ホーム" })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "選手" })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "学校" })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "大会" })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "その他" })).toBeVisible();

  await expectNoHorizontalOverflow(page);
});

test("mobile home and player flows remain usable", async ({ page }) => {
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await expect(page.getByTestId("player-screen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "選手" })).toBeVisible();

  const firstPlayer = page.locator(".player-card").first();
  await expect(firstPlayer).toBeVisible();
  await firstPlayer.click();
  await expect(page.getByRole("dialog", { name: /選手詳細/ })).toBeVisible();
  await page.getByRole("button", { name: "閉じる" }).click();

  await navigation.getByRole("button", { name: "ホーム", exact: true }).click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("mobile school, tournament, and other navigation remains usable", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });

  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await expect(page.getByRole("heading", { name: "青葉高校" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await navigation.getByRole("button", { name: "大会", exact: true }).click();
  await expect(page.getByRole("heading", { name: "大会" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await navigation.getByRole("button", { name: "その他", exact: true }).click();
  await expect(page.getByRole("heading", { name: "その他" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("mobile roster swap flow validates and saves the lineup", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });

  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await page.getByRole("button", { name: "編成" }).click();

  const lineupDialog = page.getByRole("dialog", { name: "チーム編成" });
  await expect(lineupDialog).toBeVisible();
  const starterButton = lineupDialog.locator(".lineup-slot").first();
  const benchButton = lineupDialog.locator(".bench-slot").first();
  await expect(starterButton).toBeVisible();
  await expect(benchButton).toBeVisible();

  await starterButton.click();
  await benchButton.click();
  await expect(lineupDialog.getByText("編成は有効です")).toBeVisible();

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

test("school management upgrades a facility and calendar resolves saved training while advancing", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });

  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await expect(page.getByRole("heading", { name: "青葉高校" })).toBeVisible();
  await expect(page.getByText("資金 750")).toBeVisible();

  const trainingFacility = page.getByRole("button", {
    name: "トレーニング設備の詳細",
  });
  await trainingFacility.click();
  const facilityDialog = page.getByRole("dialog", { name: "設備を強化" });
  await facilityDialog.getByRole("button", { name: "70を使って強化" }).click();
  await expect(page.getByText("資金 680")).toBeVisible();
  await expect(trainingFacility).toContainText("Lv.1");
  await expect(facilityDialog).toBeVisible();
  await facilityDialog.getByRole("button", { name: "閉じる" }).click();
  await expect(facilityDialog).toBeHidden();

  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await page.locator(".player-training-chip").first().click();
  await page
    .getByRole("dialog", { name: /の個人練習$/ })
    .getByRole("button", { name: /^攻撃/ })
    .click();
  await expect(page.locator(".operation-status")).toHaveText("保存済み ✓");

  await page.getByRole("button", { name: "予定を確認" }).click();
  const calendar = page.getByRole("dialog", { name: "週間カレンダー" });
  await expect(calendar).toBeVisible();
  await expect(calendar.getByText("練習 週送りで実施")).toBeVisible();
  await calendar.getByRole("button", { name: "次の週へ進む" }).click();

  await expect(calendar).toBeHidden();
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(
    page.getByRole("banner").getByText("2026年4月8日"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /今週の練習結果/ }),
  ).toBeVisible();
});

test("worker health endpoint reports ready status", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
