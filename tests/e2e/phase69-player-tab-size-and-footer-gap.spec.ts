import { expect, test } from "@playwright/test";

/**
 * A compact, stable navigation rail must not grow when the team
 * content changes. Each scrollable pane should end next to the
 * fixed bottom navigation rather than leave a ghost action-bar gap.
 */
for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`player navigation and panels stay compact at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await page
      .getByRole("navigation", { name: "主要メニュー" })
      .getByRole("button", { name: "選手", exact: true })
      .click();

    const switcher = page.getByRole("navigation", {
      name: "選手画面の表示切替",
    });

    // Repeated switching catches mode-specific flex/grid sizing regressions.
    for (const mode of ["選手", "編成", "戦術", "チーム", "編成", "選手"]) {
      await switcher.getByRole("button", { name: mode, exact: true }).click();

      const metrics = await page.evaluate(() => {
        const headerTabs = document.querySelector(".player-hub__tabs");
        const fixedNav = document.querySelector(".bottom-game-nav");
        const panel = document.querySelector(
          '.team-lineup-pane[data-active="true"], .team-tactics__pane[data-active="true"], .team-dynamics__pane[data-active="true"]',
        );
        const section = document.querySelector(
          ".player-hub--lineup > .team-screen--direct, .player-hub--mobile-panels > .team-tactics, .player-hub--mobile-panels > .team-dynamics",
        );
        if (!headerTabs || !fixedNav)
          throw new Error("mobile navigation missing");

        const tabs = headerTabs.getBoundingClientRect();
        const nav = fixedNav.getBoundingClientRect();
        const pane = panel?.getBoundingClientRect();
        return {
          tabHeight: tabs.height,
          sectionGap: section
            ? section.getBoundingClientRect().top - tabs.bottom
            : null,
          paneToNavGap: pane ? nav.top - pane.bottom : null,
          navTop: nav.top,
          tabBottom: tabs.bottom,
          documentHeight: document.documentElement.scrollHeight,
          documentWidth: document.documentElement.scrollWidth,
          viewportHeight: document.documentElement.clientHeight,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      const expectedHeight = viewport.height <= 740 ? 48 : 58;
      expect(metrics.tabHeight).toBeGreaterThanOrEqual(expectedHeight - 1);
      expect(metrics.tabHeight).toBeLessThanOrEqual(expectedHeight + 1);
      expect(metrics.tabBottom).toBeLessThan(metrics.navTop);
      expect(metrics.documentHeight).toBeLessThanOrEqual(
        metrics.viewportHeight + 1,
      );
      expect(metrics.documentWidth).toBeLessThanOrEqual(
        metrics.viewportWidth + 1,
      );
      if (mode !== "選手") {
        expect(metrics.sectionGap).not.toBeNull();
        expect(metrics.sectionGap!).toBeGreaterThanOrEqual(0);
        expect(metrics.sectionGap!).toBeLessThanOrEqual(12);
        expect(metrics.paneToNavGap).not.toBeNull();
        expect(metrics.paneToNavGap!).toBeGreaterThanOrEqual(0);
        expect(metrics.paneToNavGap!).toBeLessThanOrEqual(12);
      }
    }
  });
}
