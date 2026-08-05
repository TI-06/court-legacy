import { expect, test } from "@playwright/test";

test("general roster players render portrait WebP layers without an SVG fallback", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await expect(page.getByRole("heading", { name: "選手一覧" })).toBeVisible();

  const generatedPortraits = page.locator(
    ".player-hub-card .player-art:has(.player-art__layer--base)",
  );
  await expect(generatedPortraits.first()).toBeVisible();
  expect(await generatedPortraits.count()).toBeGreaterThanOrEqual(6);

  const firstPortrait = generatedPortraits.first();
  const bounds = await firstPortrait.boundingBox();
  expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(60);
  expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(80);
  await expect(firstPortrait.locator("svg")).toHaveCount(0);

  const baseLayers = page.locator(
    ".player-hub-card .player-art__layer--base",
  );
  const inspectedLayerCount = Math.min(await baseLayers.count(), 8);
  for (let index = 0; index < inspectedLayerCount; index += 1) {
    const backgroundImage = await baseLayers
      .nth(index)
      .evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(backgroundImage).toContain(".webp");
  }
});
