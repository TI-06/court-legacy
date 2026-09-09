import { expect, test, type Page } from "@playwright/test";

const widths = [320, 360, 390, 414, 480] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
}

async function schedulePracticeMatch(page: Page) {
  const scheduled = page.getByText("対戦決定", { exact: true });
  if (await scheduled.isVisible().catch(() => false)) return;

  const acceptOffer = page.getByRole("button", { name: "受ける" });
  if (await acceptOffer.isVisible().catch(() => false)) {
    await acceptOffer.click();
    await expect(scheduled).toBeVisible();
    return;
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const requestButton = page
      .locator("button")
      .filter({ hasText: "申し込む" })
      .first();
    if (!(await requestButton.isVisible().catch(() => false))) break;

    await requestButton.click();
    try {
      await expect(scheduled).toBeVisible({ timeout: 900 });
      return;
    } catch {
      // A candidate can reject the request. Continue with the next available school.
    }
  }

  await expect(scheduled).toBeVisible();
}

for (const width of widths) {
  test(`${width}px tactics save and match-only override fit`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 900 });
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "主要メニュー" });

    await navigation.getByRole("button", { name: "選手", exact: true }).click();
    await page.getByRole("button", { name: "戦術", exact: true }).click();
    await expect(page.getByRole("heading", { name: "基本戦術" })).toBeVisible();
    await expect(page.getByRole("group", { name: "サーブ戦術" })).toBeVisible();
    await expect(page.getByRole("group", { name: "攻撃戦術" })).toBeVisible();
    await expect(page.getByRole("group", { name: "ブロック戦術" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /^強気/ }).click();
    const saveButton = page.getByRole("button", { name: "基本戦術を保存" });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(page.getByText("保存済み ✓", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await navigation.getByRole("button", { name: "試合", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "練習試合の予定" }),
    ).toBeVisible();
    await schedulePracticeMatch(page);

    await navigation
      .getByRole("button", { name: "ホーム", exact: true })
      .click();
    await page.getByRole("button", { name: "今週を進める" }).click();

    await expect(page.getByRole("heading", { name: "試合準備" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "今回の戦術" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "基本戦術に戻す" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "この編成・戦術で試合開始" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /^高速/ }).click();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "基本戦術に戻す" }).click();
    await expectNoHorizontalOverflow(page);

    await page
      .getByRole("button", { name: "この編成・戦術で試合開始" })
      .click();
    await expect(
      page.getByRole("heading", { name: "試合ダイジェスト" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
