import { expect, test, type Page } from "@playwright/test";

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

for (const width of [320, 360, 390, 414, 480]) {
  test(`${width}px Home progression resolves a scheduled practice match and advances the week`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 900 });
    await page.goto("/");

    const home = page.getByTestId("home-screen");
    const navigation = page.getByRole("navigation", { name: "主要メニュー" });
    const weekHeading = page.locator("#home-week-heading");
    await expect(home).toBeVisible();
    const initialWeek = await weekHeading.textContent();
    await expectNoHorizontalOverflow(page);

    await navigation.getByRole("button", { name: "試合", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "練習試合の予定" }),
    ).toBeVisible();
    await schedulePracticeMatch(page);
    await expect(
      page.getByText("ホームの「次の週へ進む」で実施"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "試合開始" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await navigation
      .getByRole("button", { name: "ホーム", exact: true })
      .click();
    await expect(home).toBeVisible();
    await page.getByRole("button", { name: "次の週へ進む" }).click();

    await expect(
      page.getByRole("heading", { name: "試合ダイジェスト" }),
    ).toBeVisible();
    await expect(page.getByTestId("event-sequence")).toContainText("1 /");
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "結果まで進む" }).click();
    await expect(page.getByRole("heading", { name: "試合結果" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "結果を確認して次へ" }).click();
    await expect(home).toBeVisible();
    if (initialWeek) {
      await expect(weekHeading).not.toHaveText(initialWeek);
    }
    await expect(page.locator(".home-notification-list")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page
      .getByRole("button", { name: /今週の練習結果/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "今週の練習結果" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('[data-tone="positive"]').first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
