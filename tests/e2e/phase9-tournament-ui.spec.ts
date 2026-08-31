import { expect, test } from "@playwright/test";

test(
  "phase9 tournament uses one horizontal line per match and no self label",
  async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: "大会表を見る" }).click();

    const lines = page.getByTestId("tournament-match-line");
    await expect(lines).toHaveCount(8);
    await expect(page.getByText("自校", { exact: true })).toHaveCount(0);

    const first = lines.first();
    const leftBox = await first
      .locator(".tournament-match-row__school--home")
      .boundingBox();
    const centerBox = await first
      .locator(".tournament-match-row__center")
      .boundingBox();
    const rightBox = await first
      .locator(".tournament-match-row__school--away")
      .boundingBox();

    expect(leftBox).not.toBeNull();
    expect(centerBox).not.toBeNull();
    expect(rightBox).not.toBeNull();
    expect(Math.abs((leftBox?.y ?? 0) - (centerBox?.y ?? 0))).toBeLessThan(8);
    expect(Math.abs((rightBox?.y ?? 0) - (centerBox?.y ?? 0))).toBeLessThan(8);
  },
);
