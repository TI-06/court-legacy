import { expect, test } from "@playwright/test";

async function completeTrainingAndAdvance(
  page: import("@playwright/test").Page,
) {
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "育成", exact: true }).click();
  await page.getByRole("button", { name: "練習を実行" }).click();
  await page
    .getByRole("dialog", { name: "練習内容を確認" })
    .getByRole("button", { name: "この内容で実行" })
    .click();
  await expect(
    page.getByRole("heading", { name: "今週の練習結果" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("保存済み ✓");

  await navigation.getByRole("button", { name: "ホーム", exact: true }).click();
  await page.getByRole("button", { name: "次の週へ進む" }).click();
  await expect(page.getByRole("status")).toHaveText("保存済み ✓");
}

test("weekly progression surfaces a non-dismissible event with tradeoffs", async ({
  page,
}) => {
  await page.goto("/");

  await completeTrainingAndAdvance(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await completeTrainingAndAdvance(page);
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
  await expect(eventDialog).toBeHidden();
  await expect(page.getByText("イベント結果を保存済み")).toBeVisible();

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});
