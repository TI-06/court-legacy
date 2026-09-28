import { expect, test, type Page } from "@playwright/test";

async function openShop(page: Page) {
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "その他", exact: true }).click();
  await page.getByRole("button", { name: "ショップ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ショップ" })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page, viewportWidth: number) {
  await expect
    .poll(async () =>
      page.evaluate(() =>
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ),
      ),
    )
    .toBeLessThanOrEqual(viewportWidth);
}

// prettier-ignore
test(
  "shop uses a compact two-column card grid on mobile",
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await openShop(page);

    const products = page.locator('[aria-label="商品一覧"]');
    await expect(products).toBeVisible();
    const productColumns = await products.evaluate((element) => {
      const columns = getComputedStyle(element).gridTemplateColumns;
      return columns.split(" ").filter(Boolean).length;
    });
    expect(productColumns).toBe(2);

    await page
      .getByRole("button", { name: "その他へ戻る", exact: true })
      .click();
    await page.getByRole("button", { name: "所持品", exact: true }).click();

    const inventory = page.locator('[aria-label="所持品一覧"]');
    await expect(inventory).toBeVisible();
    const inventoryColumns = await inventory.evaluate((element) => {
      const columns = getComputedStyle(element).gridTemplateColumns;
      return columns.split(" ").filter(Boolean).length;
    });
    expect(inventoryColumns).toBe(2);
  },
);

for (const width of [320, 360, 390, 480]) {
  test(`shop has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await openShop(page);

    await expect(page.getByRole("heading", { name: "疲労回復" })).toBeVisible();
    await expectNoHorizontalOverflow(page, width);

    await page
      .getByRole("button", { name: "その他へ戻る", exact: true })
      .click();
    await page.getByRole("button", { name: "所持品", exact: true }).click();
    await expect(page.getByRole("heading", { name: "所持品" })).toBeVisible();
    await expectNoHorizontalOverflow(page, width);
  });
}
