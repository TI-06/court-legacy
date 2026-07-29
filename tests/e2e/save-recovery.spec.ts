import { expect, test } from "@playwright/test";

test("manual save survives reload and keeps the previous version as backup", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "セーブ・ロードを開く" }).click();
  let saveSheet = page.getByRole("dialog", { name: "セーブ・ロード" });
  await saveSheet.getByRole("button", { name: "スロット1に保存" }).click();
  await expect(saveSheet.getByText("スロット1へ保存しました")).toBeVisible();
  await saveSheet.getByRole("button", { name: "閉じる" }).click();

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await page.getByRole("button", { name: "トレーニング設備を強化" }).click();
  await page
    .getByRole("dialog", { name: "設備を強化" })
    .getByRole("button", { name: "70を使って強化" })
    .click();
  await expect(page.getByText("資金 230")).toBeVisible();

  await page.getByRole("button", { name: "セーブ・ロードを開く" }).click();
  saveSheet = page.getByRole("dialog", { name: "セーブ・ロード" });
  await saveSheet.getByRole("button", { name: "スロット1に保存" }).click();
  await expect(saveSheet.getByText("バックアップ 1件")).toBeVisible();
  await saveSheet.getByRole("button", { name: "閉じる" }).click();

  await page.reload();
  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await expect(page.getByText("資金 230")).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "トレーニング設備を強化" })
      .locator("xpath=ancestor::article")
      .getByText("Lv.1"),
  ).toBeVisible();

  await page.getByRole("button", { name: "セーブ・ロードを開く" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "セーブ・ロード" })
      .getByText("バックアップ 1件"),
  ).toBeVisible();
});
