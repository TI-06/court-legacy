import { expect, test } from "@playwright/test";

test("gameplay management controls use tap-first mobile UI at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();

  const filter = page.getByRole("group", { name: "選手絞り込み" });
  const sort = page.getByRole("group", { name: "並び替え" });
  await expect(filter.getByRole("button", { name: "全員" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await filter.getByRole("button", { name: "1年" }).click();
  await expect(filter.getByRole("button", { name: "1年" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await sort.getByRole("button", { name: "将来性順" }).click();
  await expect(sort.getByRole("button", { name: "将来性順" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".player-hub select")).toHaveCount(0);

  const playerHubTabs = page.getByRole("navigation", {
    name: "選手画面の表示切替",
  });
  await playerHubTabs
    .getByRole("button", { name: "チーム", exact: true })
    .click();

  await page.getByRole("button", { name: "主将", exact: true }).click();
  const captainPicker = page.getByRole("dialog", { name: "主将を選ぶ" });
  await expect(
    captainPicker.getByRole("group", { name: "役職候補" }),
  ).toBeVisible();
  await captainPicker.getByRole("button", { name: "閉じる" }).click();
  await expect(page.locator(".team-dynamics select")).toHaveCount(0);

  await playerHubTabs
    .getByRole("button", { name: "編成", exact: true })
    .click();
  const injuryPolicy = page.getByRole("switch", {
    name: "怪我時はベンチを許可",
  });
  const before = await injuryPolicy.getAttribute("aria-checked");
  await injuryPolicy.click();
  await expect(injuryPolicy).toHaveAttribute(
    "aria-checked",
    before === "true" ? "false" : "true",
  );
  await expect(
    page.locator('.team-policy-panel input[type="checkbox"]'),
  ).toHaveCount(0);

  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  const advancedCoach = page.getByTestId("assistant-coach-advanced");
  const specialty = advancedCoach.getByRole("group", {
    name: "上級コーチの専門",
  });
  await specialty.getByRole("button", { name: "攻撃" }).click();
  await expect(specialty.getByRole("button", { name: "攻撃" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(advancedCoach.locator("select")).toHaveCount(0);

  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
});
