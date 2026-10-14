import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`Home keeps its command desk visible without scrolling at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const home = page.getByTestId("home-screen");
    const summary = page.getByTestId("home-command-summary");
    const action = page.getByTestId("home-command-advance");
    const desk = page.getByRole("region", { name: "ホームの確認事項" });
    const nav = page.getByRole("navigation", { name: "主要メニュー" });

    await expect(home).toBeVisible();
    await expect(summary).toBeVisible();
    await expect(desk).toBeVisible();
    await expect(action.getByRole("button", { name: "今週を進める" })).toBeVisible();

    const positions = await page.evaluate(() => {
      const selectors = [
        ".game-header",
        ".home-command-summary",
        ".home-command-section--tasks",
        ".home-command-advance",
        ".bottom-game-nav",
      ];
      const rects = selectors.map((selector) =>
        document.querySelector(selector)!.getBoundingClientRect(),
      );
      const home = document.querySelector(".home-screen")!;
      const content = document.querySelector(".home-command-center")!;
      return {
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: document.documentElement.clientHeight,
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        homeScrollHeight: home.scrollHeight,
        homeClientHeight: home.clientHeight,
        centerScrollHeight: content.scrollHeight,
        centerClientHeight: content.clientHeight,
        headerBottom: rects[0].bottom,
        summaryBottom: rects[1].bottom,
        deskTop: rects[2].top,
        deskBottom: rects[2].bottom,
        actionTop: rects[3].top,
        actionBottom: rects[3].bottom,
        navTop: rects[4].top,
      };
    });

    expect(positions.pageHeight).toBeLessThanOrEqual(positions.viewportHeight + 1);
    expect(positions.pageWidth).toBeLessThanOrEqual(positions.viewportWidth + 1);
    expect(positions.homeScrollHeight).toBeLessThanOrEqual(
      positions.homeClientHeight + 1,
    );
    expect(positions.centerScrollHeight).toBeLessThanOrEqual(
      positions.centerClientHeight + 1,
    );
    expect(positions.summaryBottom).toBeLessThanOrEqual(
      positions.deskTop + 1,
    );
    expect(positions.deskBottom).toBeLessThanOrEqual(
      positions.actionTop + 1,
    );
    expect(positions.actionBottom).toBeLessThanOrEqual(positions.navTop + 1);
    expect(positions.headerBottom).toBeLessThanOrEqual(positions.summaryBottom);

    const briefingTabs = page.getByRole("tablist", { name: "ホーム情報の表示切替" });
    if ((await briefingTabs.count()) > 0) {
      const tabs = briefingTabs.getByRole("tab");
      expect(await tabs.count()).toBeGreaterThan(1);
      await tabs.last().click();
      await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("#home-briefing-panel")).toBeVisible();
    }

    const newsTab = page.getByRole("tab", { name: /最近の動き/ });
    if ((await newsTab.count()) > 0) {
      await newsTab.click();
      await expect(page.getByRole("heading", { name: "最近の動き" })).toBeVisible();
      await page.getByRole("tab", { name: /やること/ }).click();
    }

    await expect(page.getByRole("heading", { name: "今週やること" })).toBeVisible();
    await expect(nav).toBeVisible();
  });
}
