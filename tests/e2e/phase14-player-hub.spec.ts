import { expect, test, type Page } from "@playwright/test";

const widths = [320, 360, 390, 414, 480] as const;

async function expectPlayerHubNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    hubClient: document.querySelector(".player-hub")?.clientWidth ?? 0,
    hubScroll: document.querySelector(".player-hub")?.scrollWidth ?? 0,
  }));

  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  expect(layout.hubScroll).toBeLessThanOrEqual(layout.hubClient + 1);
}

for (const width of widths) {
  test(`${width}px Player Hub fits`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "選手" }).click();

    await expect(
      page.getByRole("heading", { name: "選手一覧" }),
    ).toBeVisible();
    await expect(page.getByLabel("選手絞り込み")).toBeVisible();
    await expect(page.getByLabel("並び替え")).toBeVisible();
    await expectPlayerHubNoHorizontalOverflow(page);

    await page.getByLabel("選手絞り込み").selectOption("grade-1");
    await expect(page.getByTestId("roster-player-row").first()).toBeVisible();
    await expectPlayerHubNoHorizontalOverflow(page);

    await page.getByLabel("選手絞り込み").selectOption("all");
    const firstPlayer = page.getByTestId("roster-player-row").first();
    await expect(firstPlayer).toBeVisible();
    await firstPlayer.getByRole("button", { name: /^選手詳細 / }).click();

    await expect(
      page.getByRole("heading", { name: "最近の成長" }),
    ).toBeVisible();
    await expectPlayerHubNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "選手一覧へ戻る" }).click();
    const trainingButton = page.locator(".player-training-chip").first();
    const navigation = page.getByRole("navigation", { name: "主要メニュー" });
    await expect(trainingButton).toBeVisible();
    await expect(navigation).toBeVisible();

    const [trainingBox, navigationBox] = await Promise.all([
      trainingButton.boundingBox(),
      navigation.boundingBox(),
    ]);
    if (!trainingBox || !navigationBox) {
      throw new Error("Player Hub training/navigation geometry is unavailable");
    }

    expect(trainingBox.y + trainingBox.height).toBeLessThanOrEqual(
      navigationBox.y + 1,
    );
    await expectPlayerHubNoHorizontalOverflow(page);
  });
}

test("Player Hub persists a development priority", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "選手" }).click();

  const addButton = page
    .getByRole("button", { name: /^重点育成に追加 / })
    .first();
  await expect(addButton).toBeEnabled();

  const addLabel = await addButton.getAttribute("aria-label");
  if (!addLabel) {
    throw new Error("Priority button accessible name is unavailable");
  }
  const playerName = addLabel.replace(/^重点育成に追加 /, "");

  await addButton.click();

  await expect(
    page.getByRole("button", {
      name: `重点育成から外す ${playerName}`,
    }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("保存済み ✓");
});
