import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`team and tactics inner tabs at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "主要メニュー" })
      .getByRole("button", { name: "選手", exact: true })
      .click();

    const primary = page.getByRole("navigation", {
      name: "選手画面の表示切替",
    });
    await primary.getByRole("button", { name: "チーム" }).click();
    const teamTabs = page.getByRole("tablist", { name: "チーム内メニュー" });
    await expect(teamTabs.getByRole("tab")).toHaveCount(4);
    await expect(
      page.getByRole("heading", { name: "結束の内訳" }),
    ).toBeVisible();

    await teamTabs.getByRole("tab", { name: "役職" }).click();
    await expect(
      page.getByRole("button", { name: "役職を保存" }),
    ).toBeVisible();
    await teamTabs.getByRole("tab", { name: "主将候補" }).click();
    await expect(page.getByRole("heading", { name: "主将適性" })).toBeVisible();
    await teamTabs.getByRole("tab", { name: "注意点" }).click();
    await expect(
      page.getByRole("heading", { name: "気になる選手" }),
    ).toBeVisible();

    await primary.getByRole("button", { name: "戦術" }).click();
    const tacticTabs = page.getByRole("tablist", { name: "戦術内メニュー" });
    await expect(tacticTabs.getByRole("tab")).toHaveCount(3);
    await expect(page.getByRole("group", { name: "サーブ戦術" })).toBeVisible();

    await tacticTabs.getByRole("tab", { name: "守備配置" }).click();
    await expect(page.getByRole("group", { name: "守備配置" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "守備配置を保存" }),
    ).toBeVisible();

    await tacticTabs.getByRole("tab", { name: "チーム哲学" }).click();
    await expect(
      page.getByRole("group", { name: "チーム哲学を選択" }),
    ).toBeVisible();

    const bounds = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(bounds.body).toBeLessThanOrEqual(bounds.viewport);
    expect(bounds.document).toBeLessThanOrEqual(bounds.viewport);
  });
}
