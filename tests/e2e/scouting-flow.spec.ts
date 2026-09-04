import { expect, test } from "@playwright/test";

test("mobile scouting acquires a candidate and preserves the result when reopened", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await page.getByRole("tab", { name: "スカウト", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "新入生スカウト" }),
  ).toBeVisible();
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

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(360);

  await page.getByRole("button", { name: "学校へ戻る" }).click();
  await expect(page.getByRole("heading", { name: "青葉高校" })).toBeVisible();
  await page.getByRole("tab", { name: "スカウト", exact: true }).click();

  await expect(
    page.getByRole("button", { name: `獲得済み ${candidateName}` }),
  ).toBeDisabled();
  const reopenedBodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  expect(reopenedBodyWidth).toBeLessThanOrEqual(360);
});
