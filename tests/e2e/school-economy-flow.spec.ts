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

  await expect(page.getByText("資金 +300 / 残高 1,000")).toBeVisible({
    timeout: 2_500,
  });
  await expect(grant).toContainText("年度残り 2 / 3");

  await page.getByRole("button", { name: "所持品", exact: true }).click();
  await expect(
    page.getByText("今年度の所持アイテムはありません。"),
  ).toBeVisible();

  await page.reload();
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "学校", exact: true }).click();

  const fundsButton = page.getByRole("button", {
    name: "資金 1000・履歴を表示",
    exact: true,
  });
  await expect(fundsButton).toBeVisible();
  await fundsButton.click();

  const ledger = page.getByRole("dialog", { name: "資金履歴" });
  await expect(ledger).toBeVisible();
  const latestEntry = ledger.locator("article.funds-ledger__entry").first();
  await expect(latestEntry).toContainText("資金 +300");
  await expect(latestEntry).toContainText("+300");
  await expect(latestEntry).toContainText("残高 1,000");
});
