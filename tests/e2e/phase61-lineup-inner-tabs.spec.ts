import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`lineup inner tabs remain usable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "主要メニュー" })
      .getByRole("button", { name: "選手", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "選手画面の表示切替" })
      .getByRole("button", { name: "編成", exact: true })
      .click();

    const tabs = page.getByRole("tablist", { name: "編成内メニュー" });
    await expect(tabs.getByRole("tab")).toHaveCount(3);
    await expect(tabs.getByRole("tab", { name: "コート" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("court-player")).toHaveCount(6);
    await expect(
      page.getByRole("button", { name: "リベロを変更" }),
    ).toBeVisible();

    await tabs.getByRole("tab", { name: "ベンチ" }).click();
    await expect(page.getByTestId("bench-player")).toHaveCount(5);
    await expect(page.getByTestId("bench-player").first()).toBeVisible();
    await tabs.getByRole("tab", { name: "設定" }).click();
    await expect(
      page.getByRole("button", { name: "保存編成を開く" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "交代方針を開く" }),
    ).toBeVisible();
    await tabs.getByRole("tab", { name: "コート" }).click();
    await expect(
      page.getByRole("button", { name: "ローテーション1を変更" }),
    ).toBeVisible();

    const layout = await page.evaluate(() => {
      const root = document.querySelector(".player-hub--lineup")!;
      const tabs = document.querySelector(".team-lineup-sections")!;
      const nav = document.querySelector(".bottom-game-nav")!;
      const active = document.querySelector(
        '.team-lineup-pane[data-active="true"]',
      )!;
      return {
        pageHeight: document.documentElement.scrollHeight,
        screenHeight: document.documentElement.clientHeight,
        pageWidth: document.documentElement.scrollWidth,
        screenWidth: document.documentElement.clientWidth,
        rootHeight: root.scrollHeight,
        rootClientHeight: root.clientHeight,
        tabsBottom: tabs.getBoundingClientRect().bottom,
        navTop: nav.getBoundingClientRect().top,
        paneBottom: active.getBoundingClientRect().bottom,
      };
    });
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.screenWidth + 1);
    expect(layout.pageHeight).toBeLessThanOrEqual(layout.screenHeight + 1);
    expect(layout.rootHeight).toBeLessThanOrEqual(layout.rootClientHeight + 1);
    expect(layout.paneBottom).toBeLessThanOrEqual(layout.navTop + 1);
    expect(layout.tabsBottom).toBeLessThanOrEqual(layout.navTop + 1);
  });
}
