import { expect, test } from "@playwright/test";
import { createDemoGame } from "../../src/app/createDemoGame";

test("crossing April graduates seniors and opens the new-year summary", async ({
  page,
}) => {
  const state = createDemoGame();
  state.date = "2027-03-31";
  state.calendar.currentDate = state.date;
  state.calendar.weekOfYear = 52;
  state.calendar.completedActivityIds = ["week:2027-03-31:training"];
  state.world.nextGenerationalTalentYear = 2;

  await page.goto("/");
  await page.getByRole("button", { name: "セーブ・ロードを開く" }).click();
  const saveSheet = page.getByRole("dialog", { name: "セーブ・ロード" });
  await saveSheet.getByLabel("JSONファイルをインポート").setInputFiles({
    name: "academic-year.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(saveSheet.getByText("スロット1へインポートしました")).toBeVisible();
  await saveSheet.getByRole("button", { name: "閉じる" }).click();

  await page.getByRole("button", { name: "次の週へ進む" }).click();
  const yearDialog = page.getByRole("dialog", { name: "2年目の新年度" });
  await expect(yearDialog).toBeVisible();
  await expect(yearDialog.getByText("卒業")).toBeVisible();
  await expect(yearDialog.getByText("新入生")).toBeVisible();
  await expect(yearDialog.getByText("世代級選手が入学")).toBeVisible();
  await expect(yearDialog.getByRole("button", { name: "閉じる" })).toHaveCount(0);

  const bodyWidth = await page.locator("body").evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);

  await yearDialog.getByRole("button", { name: "新年度を始める" }).click();
  await expect(yearDialog).toBeHidden();
  await expect(page.getByText("2年目")).toBeVisible();
});
