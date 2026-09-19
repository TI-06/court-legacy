import { expect, test, type Page } from "@playwright/test";

async function openShop(page: Page) {
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "その他", exact: true }).click();
  await page.getByRole("button", { name: "ショップ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ショップ" })).toBeVisible();
}

function shopCard(page: Page, itemName: string) {
  return page
    .locator("article.shop-card")
    .filter({ has: page.getByRole("heading", { name: itemName, exact: true }) })
    .first();
}

test("free fund grant updates the authoritative balance, survives reload, and appears in the ledger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await openShop(page);

  const grant = shopCard(page, "資金 +300");
  await expect(grant).toContainText("年度残り 3 / 3");
  await grant
    .getByRole("button", { name: "資金 +300を受け取る", exact: true })
    .click();

  await expect(page.getByText("資金 +300 / 残高 1,050")).toBeVisible({
    timeout: 2_500,
  });
  await expect(grant).toContainText("年度残り 2 / 3");

  await page.getByRole("button", { name: "その他へ戻る", exact: true }).click();
  await page.getByRole("button", { name: "所持品", exact: true }).click();
  await expect(page.getByRole("heading", { name: "所持品" })).toBeVisible();
  await expect(page.getByText("所持アイテムはありません。")).toBeVisible();

  await page.reload();
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "学校", exact: true }).click();

  const fundsButton = page.getByRole("button", {
    name: "資金 1050・履歴を表示",
    exact: true,
  });
  await expect(fundsButton).toBeVisible();
  await fundsButton.click();

  const ledger = page.getByRole("dialog", { name: "資金履歴" });
  await expect(ledger).toBeVisible();
  const latestEntry = ledger.locator("article.funds-ledger__entry").first();
  await expect(latestEntry).toContainText("資金 +300");
  await expect(latestEntry).toContainText("+300");
  await expect(latestEntry).toContainText("残高 1,050");
});

async function expectSchoolNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    schoolClient: document.querySelector(".school-screen")?.clientWidth ?? 0,
    schoolScroll: document.querySelector(".school-screen")?.scrollWidth ?? 0,
  }));

  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  expect(layout.schoolScroll).toBeLessThanOrEqual(layout.schoolClient + 1);
}

for (const width of [320, 360, 390, 414, 480] as const) {
  test(`${width}px school management navigation fits`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "学校", exact: true }).click();

    const primary = page.getByRole("tablist", { name: "学校運営メニュー" });
    await expect(primary.getByRole("tab")).toHaveCount(3);
    await expect(page.getByRole("heading", { name: "運営" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "設備" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "スタッフ" })).toBeVisible();
    await expectSchoolNoHorizontalOverflow(page);

    await primary.getByRole("tab", { name: "記録" }).click();
    const recordTabs = page.getByRole("tablist", { name: "学校記録メニュー" });
    await expect(recordTabs.getByRole("tab")).toHaveCount(3);
    await expect(
      page.getByRole("region", { name: "今季ランキング" }),
    ).toBeVisible();
    await expectSchoolNoHorizontalOverflow(page);

    await recordTabs.getByRole("tab", { name: "戦績" }).click();
    await expect(page.getByTestId("school-record-results")).toBeVisible();
    await expectSchoolNoHorizontalOverflow(page);

    await recordTabs.getByRole("tab", { name: "歴史" }).click();
    await expect(
      page.getByRole("heading", { name: "卒業生記録" }),
    ).toBeVisible();
    await expectSchoolNoHorizontalOverflow(page);
  });
}
