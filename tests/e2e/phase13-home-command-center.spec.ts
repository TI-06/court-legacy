import { expect, test } from "@playwright/test";

for (const width of [320, 360, 390, 414, 480]) {
  test(`${width}px Home command center fits`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 900 });
    await page.goto("/");

    await expect(page.getByTestId("home-command-summary")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "今週やること" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "今週を進める" }),
    ).toBeVisible();

    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(layout.body).toBeLessThanOrEqual(layout.viewport);
    expect(layout.document).toBeLessThanOrEqual(layout.viewport);

    const home = await page.getByTestId("home-screen").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(home.scrollWidth).toBeLessThanOrEqual(home.clientWidth + 1);
  });
}

test("unanswered practice offer warns before week advance", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "今週を進める" }).click();

  const dialog = page.getByRole("dialog", {
    name: "未回答の申し込みがあります",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("このまま次週へ進みますか");
  await dialog.getByRole("button", { name: "戻る" }).click();
  await expect(dialog).toHaveCount(0);
});

test("management task deep-links to the requested School view", async ({
  page,
}) => {
  await page.goto("/");

  const facilityTask = page.getByRole("button", {
    name: /強化可能な設備.*設備を見る/,
  });
  await expect(facilityTask).toBeVisible();
  await facilityTask.click();

  await expect(
    page.getByRole("tab", { name: "設備", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "トレーニング設備の詳細" }),
  ).toBeVisible();
});
