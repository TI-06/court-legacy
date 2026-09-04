import { expect, test } from "@playwright/test";

async function saveTrainingAndAdvance(page: import("@playwright/test").Page) {
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
}

test("weekly progression surfaces a non-dismissible event with tradeoffs", async ({
  page,
}) => {
  await page.goto("/");

  await saveTrainingAndAdvance(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await saveTrainingAndAdvance(page);
  const eventDialog = page.getByRole("dialog");
  await expect(eventDialog).toBeVisible();
  await expect(
    eventDialog.getByText(
      "監督として対応を選んでください。結果には利点と負担があります。",
    ),
  ).toBeVisible();
  await expect(eventDialog.getByRole("button", { name: "閉じる" })).toHaveCount(
    0,
  );
  const choices = eventDialog.locator(".event-choice");
  await expect(choices).toHaveCount(2);
  await choices.first().click();

  const resultDialog = page.getByRole("dialog", { name: "対応結果" });
  await expect(resultDialog).toBeVisible();
  await expect(resultDialog.getByText("選んだ対応")).toBeVisible();
  await expect(
    resultDialog.getByRole("region", { name: "対応による変化" }),
  ).toBeVisible();
  await resultDialog.getByRole("button", { name: "結果を確認した" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".operation-status")).toHaveText("保存済み ✓");

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});
