import { expect, test } from "@playwright/test";

const ACTION_DELAY_KEY = "court-legacy:e2e-action-delay-ms";

test("mobile PvP publishes, challenges, and keeps visible progress and results", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript((delayKey) => {
    sessionStorage.setItem(delayKey, "800");
  }, ACTION_DELAY_KEY);
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "試合", exact: true }).click();
  await page.getByRole("button", { name: "対人戦を開く" }).click();

  await expect(page.getByRole("heading", { name: "対人戦" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "対人戦データを読み込んでいます…",
    { timeout: 300 },
  );

  const challenge = page.getByRole("button", { name: "対戦する 白波高校" });
  await expect(challenge).toBeVisible({ timeout: 1_500 });

  const publish = page.getByRole("button", { name: "チームを公開" });
  await publish.click();
  await expect(
    page.getByRole("button", { name: "チーム公開中…" }),
  ).toBeDisabled({ timeout: 300 });
  await expect(page.getByText("公開中")).toBeVisible({ timeout: 1_500 });

  await challenge.click();
  await expect(
    page.getByRole("button", { name: "対戦中… 白波高校" }),
  ).toBeDisabled({ timeout: 300 });
  await expect(page.getByText("対戦結果を計算中…")).toBeVisible({
    timeout: 300,
  });

  await expect(page.getByRole("heading", { name: "勝利" })).toBeVisible({
    timeout: 2_500,
  });
  await expect(page.getByText("+16").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "シーズンランキング" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "対戦履歴" })).toBeVisible();

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(360);

  await page.getByRole("button", { name: "通常試合へ" }).click();
  await expect(page.getByRole("button", { name: "対人戦を開く" })).toBeVisible();
  await page.getByRole("button", { name: "対人戦を開く" }).click();

  await expect(page.getByRole("heading", { name: "対人戦" })).toBeVisible();
  await expect(page.getByText("公開中")).toBeVisible();
  await expect(page.getByRole("heading", { name: "勝利" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "対戦履歴" })).toBeVisible();

  const reopenedBodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  expect(reopenedBodyWidth).toBeLessThanOrEqual(360);
});
