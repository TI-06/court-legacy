import { expect, test, type Locator } from "@playwright/test";

async function fontSize(locator: Locator): Promise<number> {
  return locator.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
}

test("phase9 shell keeps readable labels and compact controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  const navItem = page.locator(".bottom-game-nav__item").first();
  const calendar = page.getByRole("button", { name: "予定を確認" });
  const calendarBox = await calendar.boundingBox();

  expect(await fontSize(navItem)).toBeGreaterThanOrEqual(12);
  await expect(page.locator(".game-header__meta")).toContainText("就任");
  expect(
    await fontSize(page.locator(".game-header__meta")),
  ).toBeGreaterThanOrEqual(12);
  expect(calendarBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(calendarBox?.height ?? 0).toBeGreaterThanOrEqual(44);
});
