import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`School management fits ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "主要メニュー" })
      .getByRole("button", { name: "学校" })
      .click();

    const operations = page.getByRole("tablist", { name: "運営メニュー" });
    const pager = page.getByRole("navigation", {
      name: "学校運営のページ切替",
    });

    for (const [tab, selector] of [
      ["設備", ".facility-tile"],
      ["コーチ", ".assistant-coach-card"],
      ["強化予算", ".school-investment-card"],
      ["特別事業", ".school-special-project-card"],
    ] as const) {
      await operations.getByRole("tab", { name: tab }).click();
      await expect(page.locator(selector).first()).toBeVisible();
      if ((await pager.count()) > 0) {
        const first = await page.locator(selector).first().textContent();
        await pager.getByRole("button", { name: "次の学校運営ページ" }).click();
        await expect(
          pager.getByRole("button", { name: "前の学校運営ページ" }),
        ).toBeEnabled();
        await expect(page.locator(selector).first()).not.toHaveText(
          first ?? "",
        );
      }

      const sizes = await page.evaluate((itemSelector) => {
        const school = document.querySelector(".school-screen--one-screen")!;
        const panel = document.querySelector(".school-panel--management")!;
        const items = document.querySelectorAll(itemSelector);
        const item = items[items.length - 1]!;
        const pager = document.querySelector(".school-management-pager");
        const nav = document.querySelector(".bottom-game-nav")!;
        const panelBottom = panel.getBoundingClientRect().bottom;
        return {
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          viewportHeight: document.documentElement.clientHeight,
          documentHeight: document.documentElement.scrollHeight,
          schoolHeight: school.clientHeight,
          schoolScrollHeight: school.scrollHeight,
          panelBottom,
          itemBottom: item.getBoundingClientRect().bottom,
          pagerTop: pager?.getBoundingClientRect().top ?? panelBottom,
          pagerBottom: pager?.getBoundingClientRect().bottom ?? panelBottom,
          navTop: nav.getBoundingClientRect().top,
        };
      }, selector);
      expect(sizes.documentWidth).toBeLessThanOrEqual(sizes.viewportWidth + 1);
      expect(sizes.documentHeight).toBeLessThanOrEqual(
        sizes.viewportHeight + 1,
      );
      expect(sizes.schoolScrollHeight).toBeLessThanOrEqual(
        sizes.schoolHeight + 1,
      );
      expect(sizes.itemBottom).toBeLessThanOrEqual(sizes.pagerTop + 1);
      expect(sizes.pagerBottom).toBeLessThanOrEqual(sizes.navTop + 1);
      expect(sizes.panelBottom).toBeLessThanOrEqual(sizes.navTop + 1);
    }
  });
}
