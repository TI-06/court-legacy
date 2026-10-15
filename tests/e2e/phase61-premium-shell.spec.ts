import { expect, test } from "@playwright/test";

for (const width of [320, 390, 480]) {
  const label = `Phase61 premium shell fits ${width}px without losing navigation`;
  test(label, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");

    const header = page.locator(".game-header");
    await expect(header.locator(".game-header__mark")).toHaveText("CL");
    await expect(header.locator(".game-header__brand")).toHaveText(
      "COURT LEGACY",
    );

    const navigation = page.getByRole("navigation", { name: "主要メニュー" });
    await expect(navigation.getByRole("button")).toHaveCount(5);
    const home = navigation.getByRole("button", { name: "ホーム" });
    await expect(home).toHaveAttribute("aria-current", "page");

    const colors = await page.evaluate(() => ({
      bg: getComputedStyle(document.documentElement)
        .getPropertyValue("--game-bg")
        .trim(),
      accent: getComputedStyle(document.documentElement)
        .getPropertyValue("--game-accent")
        .trim(),
      bodyWidth: document.body.scrollWidth,
      pageWidth: document.documentElement.clientWidth,
    }));
    expect(colors.bg).toBe("#07131f");
    expect(colors.accent).toBe("#ff9862");
    expect(colors.bodyWidth).toBeLessThanOrEqual(colors.pageWidth);

    const navBox = await navigation.boundingBox();
    expect(navBox).not.toBeNull();
    const navBottom = (navBox?.y ?? 0) + (navBox?.height ?? 0);
    expect(Math.abs(navBottom - 800)).toBeLessThan(2);

    const playerTab = navigation.getByRole("button", { name: "選手" });
    const playerBox = await playerTab.boundingBox();
    expect(playerBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await playerTab.click();
    await expect(playerTab).toHaveAttribute("aria-current", "page");
  });
}

test("Phase63 animations respond to navigation and respect reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const frame = page.locator(".game-page-frame");
  const scene = page.locator(".game-page-frame__content");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await expect(frame).toHaveAttribute("data-reduced-motion", "false");

  const motionName = await scene.evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  expect(motionName).toContain("phase63-scene-enter");
  const initialScene = await scene.elementHandle();
  await navigation.getByRole("button", { name: "選手" }).click();
  await expect(
    navigation.getByRole("button", { name: "選手" }),
  ).toHaveAttribute("aria-current", "page");
  expect(await initialScene?.evaluate((element) => element.isConnected)).toBe(
    false,
  );

  const calendarMotion = await page
    .locator(".game-header__date")
    .evaluate((element) => getComputedStyle(element).animationName);
  expect(calendarMotion).toContain("phase63-week-update");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await navigation.getByRole("button", { name: "学校" }).click();
  await expect(
    navigation.getByRole("button", { name: "学校" }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    await scene.evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  expect(
    await page
      .locator(".game-header__date")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  const widths = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(widths.documentWidth).toBeLessThanOrEqual(widths.viewportWidth + 1);
});
