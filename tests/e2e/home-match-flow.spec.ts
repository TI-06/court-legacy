import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(
  page: Parameters<typeof test>[0]["page"],
) {
  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
}

async function schedulePracticeMatch(page: Parameters<typeof test>[0]["page"]) {
  const scheduled = page.getByText("対戦決定", { exact: true });
  if (await scheduled.isVisible().catch(() => false)) return;

  const acceptOffer = page.getByRole("button", { name: "受ける" });
  if (await acceptOffer.isVisible().catch(() => false)) {
    await acceptOffer.click();
    await expect(scheduled).toBeVisible();
    return;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const requestButton = page
      .locator("button")
      .filter({ hasText: "申し込む" })
      .first();
    if (!(await requestButton.isVisible().catch(() => false))) break;

    await requestButton.click();
    try {
      await expect(scheduled).toBeVisible({ timeout: 800 });
      return;
    } catch {
      // The request can be rejected. Try the next available candidate.
    }
  }

  await expect(scheduled).toBeVisible();
}

test("mobile home starts a match and returns with the latest result", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("home-screen")).toBeVisible();
  await page
    .locator(".home-week-card__actions")
    .getByRole("button", { name: "試合", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "練習試合の予定" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await schedulePracticeMatch(page);
  await expect(
    page.getByRole("heading", { name: "練習試合", exact: true }),
  ).toBeVisible();
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
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.locator(".home-recent-status")).toContainText("勝利");
  await expectNoHorizontalOverflow(page);
});

test("360px home and match preparation stay within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "試合", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "練習試合の予定" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
