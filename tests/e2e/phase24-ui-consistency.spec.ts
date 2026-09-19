import { expect, test, type Locator } from "@playwright/test";

async function expectDarkSurface(locator: Locator) {
  await expect(locator).toBeVisible();
  const backgroundColor = await locator.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(backgroundColor).not.toBe("rgb(255, 255, 255)");
  expect(backgroundColor).not.toBe("rgb(246, 249, 250)");
}

test("Phase24 management screens keep the dark game theme through editing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });

  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  const playerTabs = page.getByRole("navigation", {
    name: "選手画面の表示切替",
  });
  await expect(playerTabs.getByRole("button")).toHaveCount(4);
  await expect(
    playerTabs.getByRole("button", { name: "選手", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await playerTabs.getByRole("button", { name: "編成", exact: true }).click();
  await expectDarkSurface(page.locator(".team-panel").first());
  await expectDarkSurface(page.locator(".court-player-button").first());

  await page.getByRole("button", { name: "ローテーション1を変更" }).click();
  await expectDarkSurface(page.locator(".ui-bottom-sheet"));
  await expectDarkSurface(page.locator(".ui-player-tile").first());
  await page
    .getByRole("dialog", { name: "ローテーション1を入れ替え" })
    .getByRole("button", { name: "閉じる" })
    .click();

  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await expectDarkSurface(page.locator(".school-panel").first());

  const managementTab = page.getByRole("tab", { name: "運営", exact: true });
  await expect(managementTab).toHaveAttribute("aria-selected", "true");
  await expect(managementTab).toHaveCSS(
    "background-color",
    "rgb(244, 122, 24)",
  );

  await page.getByRole("button", { name: "トレーニング設備の詳細" }).click();
  await expectDarkSurface(page.locator(".ui-bottom-sheet"));

  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
});
