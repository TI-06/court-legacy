import { expect, test } from "@playwright/test";

test("general roster players render distinct modular WebP art without an SVG fallback", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await expect(page.getByRole("heading", { name: "選手一覧" })).toBeVisible();

  const generatedPortraits = page.locator(
    ".player-hub-card .player-art:has(.player-art__layer--body)",
  );
  await expect(generatedPortraits.first()).toBeVisible();
  const generatedCount = await generatedPortraits.count();
  expect(generatedCount).toBeGreaterThanOrEqual(4);

  const signatures = await generatedPortraits.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-art-signature")),
  );
  expect(signatures.every(Boolean)).toBe(true);
  expect(new Set(signatures).size).toBeGreaterThanOrEqual(
    Math.ceil(generatedCount * 0.85),
  );

  const firstPortrait = generatedPortraits.first();
  const initialSignature =
    await firstPortrait.getAttribute("data-art-signature");
  const bounds = await firstPortrait.boundingBox();
  expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(60);
  expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(80);
  await expect(firstPortrait.locator("svg")).toHaveCount(0);
  const cardLayerCount = await firstPortrait
    .locator(".player-art__layer")
    .count();
  expect(cardLayerCount).toBeGreaterThanOrEqual(10);
  expect(cardLayerCount).toBeLessThanOrEqual(12);

  const bodyBackground = await firstPortrait
    .locator(".player-art__layer--body")
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(bodyBackground).toContain("url(");
  expect(bodyBackground).not.toBe("none");

  const frontHairMask = await firstPortrait
    .locator(".player-art__layer--front-hair")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return style.webkitMaskImage || style.maskImage;
    });
  expect(frontHairMask).toContain("url(");
  expect(frontHairMask).not.toBe("none");

  await firstPortrait.locator("xpath=ancestor::button[1]").click();
  const detailPortrait = page.locator(
    ".player-detail .player-art:has(.player-art__layer--body)",
  );
  await expect(detailPortrait).toBeVisible();
  await expect(detailPortrait).toHaveAttribute(
    "data-art-signature",
    initialSignature ?? "",
  );
  const detailLayerCount = await detailPortrait
    .locator(".player-art__layer")
    .count();
  expect(detailLayerCount).toBeGreaterThanOrEqual(10);
  expect(detailLayerCount).toBeLessThanOrEqual(12);
});
