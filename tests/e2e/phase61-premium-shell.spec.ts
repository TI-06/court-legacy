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
