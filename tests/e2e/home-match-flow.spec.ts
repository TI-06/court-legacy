import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Parameters<typeof test>[0]["page"]) {
  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
}

test("mobile home starts a match and returns with the latest result", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "監督ホーム" })).toBeVisible();
  await page.getByRole("button", { name: "練習試合へ" }).click();
  await expect(page.getByRole("heading", { name: "練習試合" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "試合開始" }).click();
  await expect(
    page.getByRole("heading", { name: "試合ダイジェスト" }),
  ).toBeVisible();
  await expect(page.getByTestId("event-sequence")).toContainText("1 /");

  await page.getByRole("button", { name: "4倍" }).click();
  await expect(page.getByRole("button", { name: "4倍" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "次のプレー" }).click();
  await expect(page.getByTestId("event-sequence")).toContainText("2 /");
  await page.getByRole("button", { name: "結果まで進む" }).click();

  await expect(page.getByRole("heading", { name: "試合結果" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "勝敗を分けた要因" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "次戦への改善提案" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "ホームへ戻る" }).click();
  await expect(page.getByRole("heading", { name: "直近の試合" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("360px home and match preparation stay within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "監督ホーム" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "試合" }).click();
  await expect(page.getByRole("heading", { name: "練習試合" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
