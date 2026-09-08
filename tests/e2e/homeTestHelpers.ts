import type { Page } from "@playwright/test";

export async function advanceWeekFromHome(page: Page): Promise<void> {
  await page.getByRole("button", { name: "今週を進める" }).click();

  const warning = page.getByRole("dialog", {
    name: "未回答の申し込みがあります",
  });
  if ((await warning.count()) > 0) {
    await warning.getByRole("button", { name: "そのまま進む" }).click();
  }
}
