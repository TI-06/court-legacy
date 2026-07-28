import { expect, test } from "@playwright/test";

test("mobile shell keeps all primary navigation actions visible", async ({
  page,
}) => {
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await expect(navigation).toBeVisible();

  for (const label of ["ホーム", "チーム", "育成", "試合", "学校"]) {
    await expect(page.getByRole("button", { name: label })).toBeVisible();
  }

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

test("mobile training flow executes without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "育成" }).click();

  await expect(page.getByRole("heading", { name: "週間練習" })).toBeVisible();
  await page.getByRole("button", { name: "練習を実行" }).click();
  await expect(
    page.getByRole("heading", { name: "今週の練習結果" }),
  ).toBeVisible();
  await expect(page.getByTestId("training-result-player")).toHaveCount(12);

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

test("mobile team selection stays valid without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "チーム" }).click();

  await expect(page.getByRole("heading", { name: "チーム編成" })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "ローテーション1" }),
  ).toBeVisible();
  await expect(page.getByTestId("bench-player")).toHaveCount(5);
  await page.getByRole("button", { name: "自動編成" }).click();
  await page.getByRole("button", { name: "安全調整" }).click();
  await expect(page.getByText("編成は有効です")).toBeVisible();

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

test("worker health endpoint reports ready status", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
