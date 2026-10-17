import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`Match entry ${viewport.width}x${viewport.height} shows practice schedule without page scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "主要メニュー" });
    await nav.getByRole("button", { name: "試合" }).click();

    const hub = page.locator(".match-hub-screen:has(> .practice-planning)");
    const official = hub.locator(".match-official-entry");
    const pvp = hub.locator(".match-pvp-entry");
    const practice = hub.locator(".practice-planning");

    await expect(official).toBeVisible();
    await expect(pvp).toBeVisible();
    await expect(
      practice.getByRole("heading", { name: "練習試合の予定" }),
    ).toBeVisible();
    await expect(
      official.getByRole("button", { name: "大会表を見る" }),
    ).toBeVisible();
    await expect(
      pvp.getByRole("button", { name: "対人戦を開く" }),
    ).toBeVisible();

    await expect(pvp.getByText("公開チームで全国の監督と対戦。")).toBeVisible();

    const sizes = await page.evaluate(() => {
      const position = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect();
      const official = position(".match-official-entry");
      const pvp = position(".match-pvp-entry");
      const practice = document.querySelector(
        ".match-hub-screen > .practice-planning",
      )!;
      const practiceRect = practice.getBoundingClientRect();
      const heading = position(".practice-planning__heading");
      const nav = position(".bottom-game-nav");
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: document.documentElement.clientHeight,
        officialHeight: official.height,
        pvpHeight: pvp.height,
        officialBottom: official.bottom,
        pvpTop: pvp.top,
        pvpBottom: pvp.bottom,
        practiceTop: practiceRect.top,
        practiceBottom: practiceRect.bottom,
        practiceHeight: practiceRect.height,
        headingBottom: heading.bottom,
        navigationTop: nav.top,
        practiceScrollHeight: practice.scrollHeight,
        practiceClientHeight: practice.clientHeight,
      };
    });

    expect(sizes.pageWidth).toBeLessThanOrEqual(sizes.viewportWidth + 1);
    expect(sizes.pageHeight).toBeLessThanOrEqual(sizes.viewportHeight + 1);
    expect(sizes.officialHeight).toBeLessThanOrEqual(105);
    expect(sizes.pvpHeight).toBeLessThanOrEqual(76);
    expect(sizes.officialBottom).toBeLessThanOrEqual(sizes.pvpTop + 1);
    expect(sizes.pvpBottom).toBeLessThanOrEqual(sizes.practiceTop + 1);
    expect(sizes.practiceHeight).toBeGreaterThan(120);
    expect(sizes.headingBottom).toBeLessThanOrEqual(sizes.navigationTop - 12);
    expect(sizes.practiceBottom).toBeLessThanOrEqual(sizes.navigationTop + 1);

    // The practice cards remain operable without scrolling the entire game page.
    const candidates = practice.getByRole("button", { name: /に申し込む$/ });
    if ((await candidates.count()) > 0) {
      const last = candidates.last();
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      const after = await page.evaluate(() => ({
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: document.documentElement.clientHeight,
      }));
      expect(after.documentHeight).toBeLessThanOrEqual(
        after.viewportHeight + 1,
      );
    }
  });
}
