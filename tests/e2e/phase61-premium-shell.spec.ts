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

test("mobile navigation motion respects reduced-motion settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  const home = navigation.getByRole("button", { name: "ホーム" });
  const player = navigation.getByRole("button", { name: "選手" });

  const animation = async () =>
    page
      .locator(".bottom-game-nav__item[aria-current='page'] .game-icon")
      .evaluate((element) => getComputedStyle(element).animationName);

  await expect(home).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".game-page-frame")).toHaveAttribute(
    "data-reduced-motion",
    "false",
  );
  const gameContent = page.locator(".game-page-frame__content");
  const originalContent = await gameContent.elementHandle();
  const date = page.locator(".game-header__date");
  expect(
    await date.evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("phase63-week-update");
  expect(await animation()).toBe("game-nav-icon-select");
  await player.click();
  await expect(player).toHaveAttribute("aria-current", "page");
  expect(await originalContent?.evaluate((element) => element.isConnected)).toBe(
    true,
  );
  expect(await animation()).toBe("game-nav-icon-select");

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await animation()).toBe("none");
  expect(
    await date.evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  const playerTabs = page.locator(".player-hub__tabs");
  await expect(playerTabs).toBeVisible();
  expect(
    await playerTabs.evaluate(
      (element) => getComputedStyle(element).animationName,
    ),
  ).toBe("none");

  const width = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(width.body).toBeLessThanOrEqual(width.viewport);
});
