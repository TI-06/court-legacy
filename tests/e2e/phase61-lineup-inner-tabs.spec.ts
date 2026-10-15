import { expect, test, type Page } from "@playwright/test";

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

async function expectPlayerPanelFits(page: Page) {
  const geometry = await page.evaluate(() => {
    const root = document.querySelector(".player-hub--mobile-panels")!;
    const nav = document.querySelector(".bottom-game-nav")!;
    const menu = root.querySelector(".team-inner-nav")!;
    const active = root.querySelector(
      '.team-dynamics__pane[data-active="true"], .team-tactics__pane[data-active="true"]',
    )!;
    return {
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: document.documentElement.clientHeight,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rootHeight: root.scrollHeight,
      rootClientHeight: root.clientHeight,
      menuBottom: menu.getBoundingClientRect().bottom,
      paneBottom: active.getBoundingClientRect().bottom,
      navTop: nav.getBoundingClientRect().top,
      navBottom: nav.getBoundingClientRect().bottom,
    };
  });
  expect(geometry.documentHeight).toBeLessThanOrEqual(
    geometry.viewportHeight + 1,
  );
  expect(geometry.documentWidth).toBeLessThanOrEqual(
    geometry.viewportWidth + 1,
  );
  expect(geometry.rootHeight).toBeLessThanOrEqual(
    geometry.rootClientHeight + 1,
  );
  expect(geometry.menuBottom).toBeLessThanOrEqual(geometry.navTop + 1);
  expect(geometry.paneBottom).toBeLessThanOrEqual(geometry.navTop + 1);
  expect(geometry.navBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`team management fits one screen at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "主要メニュー" })
      .getByRole("button", { name: "選手", exact: true })
      .click();
    const hubTabs = page.getByRole("navigation", {
      name: "選手画面の表示切替",
    });
    await hubTabs.getByRole("button", { name: "チーム", exact: true }).click();

    const teamTabs = page.getByRole("tablist", { name: "チーム内メニュー" });
    await expect(teamTabs.getByRole("tab")).toHaveCount(3);
    for (const name of ["結束・連携", "主将・副主将", "選手の状態"]) {
      await teamTabs.getByRole("tab", { name }).click();
      await expectPlayerPanelFits(page);
    }
    await teamTabs.getByRole("tab", { name: "結束・連携" }).click();
    const cohesionPane = page.locator(
      '.team-dynamics__pane[data-active="true"]',
    );
    await cohesionPane
      .getByRole("button", { name: /今週は連携練習/ })
      .scrollIntoViewIfNeeded();
    await expectPlayerPanelFits(page);

    await hubTabs.getByRole("button", { name: "戦術", exact: true }).click();
    const tacticTabs = page.getByRole("tablist", { name: "戦術内メニュー" });
    await expect(tacticTabs.getByRole("tab")).toHaveCount(3);
    for (const name of ["基本戦術", "守備配置", "チーム哲学"]) {
      await tacticTabs.getByRole("tab", { name }).click();
      const active = page.locator('.team-tactics__pane[data-active="true"]');
      await active
        .getByRole("button", { name: /を保存$/ })
        .scrollIntoViewIfNeeded();
      await expectPlayerPanelFits(page);
    }
  });
}
