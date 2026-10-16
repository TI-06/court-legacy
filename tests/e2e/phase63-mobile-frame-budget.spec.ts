import { expect, test } from "@playwright/test";

/**
 * Captures browser-only mobile rendering evidence. Frame cadence is recorded,
 * not used as a machine-dependent CI pass/fail threshold.
 */
for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`Phase63 mobile animation budget ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");

    const home = page.getByTestId("home-screen");
    await expect(home).toBeVisible();

    const measurements = await page.evaluate(async () => {
      const timestamps: number[] = [];
      await new Promise<void>((resolve) => {
        const sample = (timestamp: number) => {
          timestamps.push(timestamp);
          if (timestamps.length >= 40) {
            resolve();
          } else {
            requestAnimationFrame(sample);
          }
        };
        requestAnimationFrame(sample);
      });

      const intervals = timestamps
        .slice(1)
        .map((timestamp, index) => timestamp - timestamps[index]!)
        .sort((left, right) => left - right);
      const percentile = (fraction: number) =>
        intervals[Math.floor((intervals.length - 1) * fraction)] ?? 0;
      const runningInfiniteAnimations = document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === "running" &&
            animation.effect?.getComputedTiming().iterations === Infinity,
        ).length;
      return {
        p50FrameMs: Math.round(percentile(0.5) * 10) / 10,
        p95FrameMs: Math.round(percentile(0.95) * 10) / 10,
        samples: intervals.length,
        runningInfiniteAnimations,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    test.info().annotations.push({
      type: "headless-mobile-frame-budget",
      description: JSON.stringify({ viewport, ...measurements }),
    });
    expect(measurements.samples).toBe(39);
    expect(measurements.documentWidth).toBeLessThanOrEqual(
      measurements.viewportWidth + 1,
    );
    expect(measurements.runningInfiniteAnimations).toBe(0);

    const nav = page.getByRole("navigation", { name: "主要メニュー" });
    await nav.getByRole("button", { name: "選手" }).click();
    await expect(nav.getByRole("button", { name: "選手" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await nav.getByRole("button", { name: "ホーム" }).click();
    await expect(home).toBeVisible();

    await page.emulateMedia({ reducedMotion: "reduce" });
    const dateMotion = await page
      .locator(".home-command-summary__date")
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(dateMotion).toBe("none");

    const widthAfterNavigation = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(widthAfterNavigation).toBeLessThanOrEqual(viewport.width + 1);
  });
}
