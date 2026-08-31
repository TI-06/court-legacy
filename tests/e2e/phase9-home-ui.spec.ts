import { expect, test } from "@playwright/test";

test(
  "phase9 home keeps the weekly CTA in the initial 360x800 viewport",
  async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");

    await expect(page.getByTestId("home-screen")).toBeVisible();
    await expect(page.getByTestId("home-team-status")).toBeVisible();

    const nextWeek = page.getByRole("button", { name: "次の週へ進む" });
    const nav = page.getByRole("navigation", { name: "主要メニュー" });
    const nextWeekBox = await nextWeek.boundingBox();
    const navBox = await nav.boundingBox();

    expect(nextWeekBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(
      (nextWeekBox?.y ?? 0) + (nextWeekBox?.height ?? 0),
    ).toBeLessThanOrEqual(navBox?.y ?? 0);
  },
);

test(
  "phase9 home exposes official summary in the initial 390x844 viewport",
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const official = page.locator(".home-official-card");
    await expect(official).toBeVisible();
    const officialBox = await official.boundingBox();
    const navBox = await page
      .getByRole("navigation", { name: "主要メニュー" })
      .boundingBox();

    expect(officialBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(officialBox?.y ?? 9999).toBeLessThan(navBox?.y ?? 0);
  },
);
