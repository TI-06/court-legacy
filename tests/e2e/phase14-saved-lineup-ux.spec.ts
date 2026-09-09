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
  test(`${width}px saves a lineup and loads it only for the upcoming match`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 900 });
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "主要メニュー" });

    await navigation.getByRole("button", { name: "選手", exact: true }).click();
    await page.getByRole("button", { name: "編成", exact: true }).click();
    await expect(page.getByRole("heading", { name: "保存編成" })).toBeVisible();

    for (const slot of [1, 2, 3]) {
      await expect(page.getByTestId(`saved-lineup-slot-${slot}`)).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);

    const slot1 = page.getByTestId("saved-lineup-slot-1");
    await slot1.getByLabel("保存編成名 スロット1").fill("E2E編成");
    await slot1.getByRole("button", { name: "現在の編成を保存" }).click();

    await expect(page.getByText("保存済み ✓", { exact: true })).toBeVisible();
    await expect(slot1.getByText("使用可能", { exact: true })).toBeVisible();
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
    await expect(page.getByRole("button", { name: "ベスト" })).toBeVisible();
    const savedPreset = page.getByRole("button", { name: "保存編成 E2E編成" });
    await expect(savedPreset).toBeVisible();
    await expect(savedPreset).toBeEnabled();
    await expectNoHorizontalOverflow(page);

    await savedPreset.click();
    await page.getByRole("button", { name: "元に戻す" }).click();
    await savedPreset.click();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "この編成で試合開始" }).click();
    await expect(
      page.getByRole("heading", { name: "試合ダイジェスト" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
