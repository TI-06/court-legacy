import { expect, test } from "@playwright/test";

test("mobile scouting acquires a candidate and preserves the result when reopened", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "育成", exact: true }).click();
  await page.getByRole("button", { name: "新入生スカウト" }).click();

  await expect(page.getByRole("heading", { name: "新入生スカウト" })).toBeVisible();
  const recruitButton = page
    .getByRole("button", { name: /^獲得候補にする / })
    .first();
  await expect(recruitButton).toBeVisible();

  const recruitLabel = await recruitButton.getAttribute("aria-label");
  expect(recruitLabel).not.toBeNull();
  const candidateName = recruitLabel!.replace("獲得候補にする ", "");

  await recruitButton.click();
  await expect(
    page.getByRole("button", { name: `獲得済み ${candidateName}` }),
  ).toBeDisabled();

  const bodyWidth = await page.locator("body").evaluate((body) => body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(360);

  await page.getByRole("button", { name: "育成へ戻る" }).click();
  await expect(page.getByRole("heading", { name: "週間練習" })).toBeVisible();
  await page.getByRole("button", { name: "新入生スカウト" }).click();

  await expect(
    page.getByRole("button", { name: `獲得済み ${candidateName}` }),
  ).toBeDisabled();
  await expect(page.getByText("獲得 1人")).toHaveCount(0);

  const reopenedBodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  expect(reopenedBodyWidth).toBeLessThanOrEqual(360);
});
