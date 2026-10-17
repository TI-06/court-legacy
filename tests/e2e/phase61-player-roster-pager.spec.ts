import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 568, rows: 1 },
  { width: 360, height: 667, rows: 2 },
  { width: 390, height: 800, rows: 4 },
  { width: 390, height: 844, rows: 5 },
  { width: 430, height: 932, rows: 5 },
]) {
  test(`Player roster ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "主要メニュー" });
    await nav.getByRole("button", { name: "選手" }).click();

    const pager = page.getByRole("navigation", {
      name: "選手一覧のページ切替",
    });
    const rows = page.getByTestId("roster-player-row");
    await expect(pager).toBeVisible();
    await expect(rows).toHaveCount(viewport.rows);

    const firstPlayer = await rows
      .first()
      .getByRole("button", { name: /^選手詳細 / })
      .getAttribute("aria-label");
    const nextPage = pager.getByRole("button", { name: "次の選手ページ" });
    await nextPage.click();
    await expect(
      pager.getByRole("button", { name: "前の選手ページ" }),
    ).toBeEnabled();
    await expect(
      rows.first().getByRole("button", { name: /^選手詳細 / }),
    ).not.toHaveAttribute("aria-label", firstPlayer ?? "");

    const geometry = await page.evaluate(() => {
      const parent = document.querySelector(".player-hub--paged")!;
      const pager = document.querySelector(".player-hub__pager")!;
      const nav = document.querySelector(".bottom-game-nav")!;
      const rows = document.querySelector(".player-roster")!;
      return {
        bodyHeight: document.documentElement.scrollHeight,
        viewportHeight: document.documentElement.clientHeight,
        bodyWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        hubHeight: parent.scrollHeight,
        hubClientHeight: parent.clientHeight,
        pagerBottom: pager.getBoundingClientRect().bottom,
        navTop: nav.getBoundingClientRect().top,
        lastRowBottom:
          rows.lastElementChild?.getBoundingClientRect().bottom ?? 0,
        rosterBottom: rows.getBoundingClientRect().bottom,
        headingHeight: document
          .querySelector(".player-hub__heading")!
          .getBoundingClientRect().height,
        controlsHeight: document
          .querySelector(".player-hub__controls")!
          .getBoundingClientRect().height,
      };
    });
    expect(geometry.headingHeight).toBeLessThanOrEqual(26);
    expect(geometry.controlsHeight).toBeLessThanOrEqual(54);
    expect(geometry.bodyWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.bodyHeight).toBeLessThanOrEqual(
      geometry.viewportHeight + 1,
    );
    expect(geometry.hubHeight).toBeLessThanOrEqual(
      geometry.hubClientHeight + 1,
    );
    expect(geometry.lastRowBottom).toBeLessThanOrEqual(
      geometry.rosterBottom + 1,
    );
    expect(geometry.lastRowBottom).toBeLessThanOrEqual(
      geometry.navTop + 1,
    );
    expect(geometry.pagerBottom).toBeLessThanOrEqual(geometry.navTop + 1);
  });
}
