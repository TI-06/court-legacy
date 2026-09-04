import { expect, test } from "@playwright/test";

test("mobile shell keeps all primary navigation actions visible", async ({
  page,
}) => {
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await expect(navigation).toBeVisible();

  for (const label of ["ホーム", "選手", "学校", "試合", "その他"]) {
    await expect(
      navigation.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

test("mobile training saves a plan and resolves it with next-week progression", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();

  await expect(page.getByRole("heading", { name: "選手一覧" })).toBeVisible();
  const trainingChips = page.locator(".player-training-chip");
  await expect(trainingChips).toHaveCount(12);
  await trainingChips.first().click();

  const trainingDialog = page.getByRole("dialog", { name: /の個人練習$/ });
  await expect(
    trainingDialog.locator(".player-training-options button"),
  ).toHaveCount(6);
  await trainingDialog.getByRole("button", { name: /^攻撃/ }).click();
  await expect(page.locator(".operation-status")).toHaveText("保存済み ✓");
  await expect(trainingChips.first()).toContainText("攻撃");

  await navigation.getByRole("button", { name: "ホーム", exact: true }).click();
  await page.getByRole("button", { name: "次の週へ進む" }).click();
  await expect(
    page.getByRole("banner").getByText("2026年4月8日"),
  ).toBeVisible();

  const resultNotification = page.getByRole("button", {
    name: /今週の練習結果/,
  });
  await expect(resultNotification).toBeVisible();
  await resultNotification.click();
  const resultDialog = page.getByRole("dialog", { name: "今週の練習結果" });
  await expect(resultDialog).toBeVisible();
  await expect(
    resultDialog.getByRole("heading", { name: "選手別" }),
  ).toBeVisible();
  await expect(
    resultDialog.locator(".training-result-notification__player"),
  ).toHaveCount(12);
  await resultDialog.getByRole("button", { name: "閉じる" }).click();

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

test("mobile team selection uses a court picker without overflow", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await page.getByRole("button", { name: "編成", exact: true }).click();

  await expect(page.getByRole("heading", { name: "チーム編成" })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "ローテーション1を変更" }),
  ).toBeVisible();
  await expect(page.getByTestId("bench-player")).toHaveCount(5);

  await page.getByRole("button", { name: "ローテーション1を変更" }).click();
  const picker = page.getByRole("dialog", {
    name: "ローテーション1を入れ替え",
  });
  await expect(picker).toBeVisible();
  await expect(picker.getByTestId("player-picker-option")).toHaveCount(12);
  await picker.getByRole("button", { name: "閉じる" }).click();

  await page.getByRole("button", { name: "自動編成" }).click();
  await expect(page.getByText("保存済み ✓", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "安全調整" }).click();
  await expect(page.getByText("保存済み ✓", { exact: true })).toBeVisible();
  await expect(page.getByText("編成は有効です")).toBeVisible();

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
  await expect(page.getByText("資金 300")).toBeVisible();

  const trainingFacility = page.getByRole("button", {
    name: "トレーニング設備の詳細",
  });
  await trainingFacility.click();
  const facilityDialog = page.getByRole("dialog", { name: "設備を強化" });
  await facilityDialog.getByRole("button", { name: "70を使って強化" }).click();
  await expect(page.getByText("資金 230")).toBeVisible();
  await expect(trainingFacility).toContainText("Lv.1");

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
