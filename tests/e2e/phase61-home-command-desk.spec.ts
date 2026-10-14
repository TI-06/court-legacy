import { expect, test } from "@playwright/test";

for (const width of [320, 390, 430]) {
  test(`Phase61-2 Home coach desk remains usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 760 });
    await page.goto("/");

    const home = page.getByTestId("home-screen");
    await expect(home).toBeVisible();
    const briefing = page.getByTestId("home-command-summary");
    const weekAction = page.getByRole("button", { name: "今週を進める" });
    const nav = page.getByRole("navigation", { name: "主要メニュー" });

    await expect(briefing).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "今週やること" }),
    ).toBeVisible();
    await expect(weekAction).toBeVisible();
    await expect(weekAction).toBeEnabled();

    const layout = await page.evaluate(() => {
      const action = document.querySelector(".home-command-advance")!;
      const navigation = document.querySelector(".bottom-game-nav")!;
      const hero = document.querySelector(".home-command-summary")!;
      const actionRect = action.getBoundingClientRect();
      const navRect = navigation.getBoundingClientRect();
      return {
        width: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth,
        actionBottom: actionRect.bottom,
        navTop: navRect.top,
        actionLeft: actionRect.left,
        actionRight: actionRect.right,
        heroClientWidth: hero.clientWidth,
        heroScrollWidth: hero.scrollWidth,
      };
    });
    expect(layout.width).toBeLessThanOrEqual(layout.viewport);
    expect(layout.heroScrollWidth).toBeLessThanOrEqual(layout.heroClientWidth);
    expect(layout.actionBottom).toBeLessThanOrEqual(layout.navTop + 2);
    expect(layout.actionRight).toBeLessThanOrEqual(width + 1);
    expect(layout.actionLeft).toBeGreaterThanOrEqual(-1);

    await expect(nav.getByRole("button", { name: "ホーム" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await nav.getByRole("button", { name: "選手" }).click();
    await expect(nav.getByRole("button", { name: "選手" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
}
