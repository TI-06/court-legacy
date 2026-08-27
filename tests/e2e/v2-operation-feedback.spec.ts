import { expect, test } from "@playwright/test";

const ACTION_DELAY_KEY = "court-legacy:e2e-action-delay-ms";

test("authoritative mutations show visible feedback within 300ms", async ({
  page,
}) => {
  await page.addInitScript((delayKey) => {
    sessionStorage.setItem(delayKey, "800");
  }, ACTION_DELAY_KEY);

  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "その他", exact: true }).click();
  await page.getByRole("button", { name: "学校管理" }).click();
  await page.getByRole("button", { name: "トレーニング設備を強化" }).click();

  const confirm = page
    .getByRole("dialog", { name: "設備を強化" })
    .getByRole("button", { name: "70を使って強化" });
  const startedAt = Date.now();
  await confirm.click();

  const status = page.getByRole("status");
  await expect(status).toHaveText("保存中…", { timeout: 300 });
  expect(Date.now() - startedAt).toBeLessThan(300);

  await page.waitForTimeout(350);
  await expect(status).toHaveText("保存中…");

  await expect(status).toHaveText("保存済み ✓", { timeout: 1_200 });
  await expect(page.getByText("資金 230")).toBeVisible();
});
