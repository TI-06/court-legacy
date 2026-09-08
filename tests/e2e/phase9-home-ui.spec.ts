import { expect, test } from "@playwright/test";

test("phase13 home keeps the weekly CTA above navigation in the initial 360x800 viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByTestId("home-command-summary")).toBeVisible();
  await expect(page.getByTestId("home-team-status")).toBeVisible();

  const advance = page.locator(".home-command-advance");
  await expect(page.getByRole("button", { name: "今週を進める" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "主要メニュー" });
  const advanceBox = await advance.boundingBox();
  const navBox = await nav.boundingBox();

  expect(advanceBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(
    (advanceBox?.y ?? 0) + (advanceBox?.height ?? 0),
  ).toBeLessThanOrEqual(navBox?.y ?? 0);
});

test("phase13 home exposes the official objective from the command summary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const summary = page.getByTestId("home-command-summary");
  const officialAction = page.getByRole("button", { name: "大会表を見る" });
  await expect(summary).toBeVisible();
  await expect(officialAction).toBeVisible();

  const officialBox = await officialAction.boundingBox();
  const navBox = await page
    .getByRole("navigation", { name: "主要メニュー" })
    .boundingBox();

  expect(officialBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(officialBox?.y ?? 9999).toBeLessThan(navBox?.y ?? 0);
});
