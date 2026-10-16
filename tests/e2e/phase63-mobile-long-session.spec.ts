import { expect, test, type Page } from "@playwright/test";

const tabNames = ["選手", "学校", "試合", "その他", "ホーム"] as const;
const mebibyte = 1024 * 1024;

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) * fraction)] ?? 0;
}

async function sampleFrames(page: Page) {
  return page.evaluate(async () => {
    const timestamps: number[] = [];
    await new Promise<void>((resolve) => {
      const collect = (timestamp: number) => {
        timestamps.push(timestamp);
        if (timestamps.length === 46) {
          resolve();
        } else {
          requestAnimationFrame(collect);
        }
      };
      requestAnimationFrame(collect);
    });
    return timestamps.slice(1).map((time, index) => time - timestamps[index]!);
  });
}

async function installNavigationProbe(page: Page) {
  await page.evaluate(() => {
    const navigation = document.querySelector<HTMLElement>(
      'nav[aria-label="主要メニュー"]',
    );
    if (!navigation) throw new Error("Navigation missing");
    const navigationMs: number[] = [];
    const longTaskMs: number[] = [];
    let pendingClickAt: number | null = null;

    navigation.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest("button");
        if (button && button.getAttribute("aria-current") !== "page") {
          pendingClickAt = performance.now();
        }
      },
      { capture: true },
    );

    const observer = new MutationObserver((changes) => {
      if (
        pendingClickAt !== null &&
        changes.some(
          (change) =>
            change.attributeName === "aria-current" &&
            change.target instanceof HTMLButtonElement,
        )
      ) {
        navigationMs.push(performance.now() - pendingClickAt);
        pendingClickAt = null;
      }
    });
    observer.observe(navigation, {
      attributes: true,
      attributeFilter: ["aria-current"],
      subtree: true,
    });

    let longTaskObserver: PerformanceObserver | null = null;
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTaskMs.push(entry.duration);
        }
      });
      longTaskObserver.observe({ entryTypes: ["longtask"] });
    }

    const monitoredWindow = window as typeof window & {
      __phase63LongSession?: {
        navigationMs: number[];
        longTaskMs: number[];
        disconnect: () => void;
      };
    };
    monitoredWindow.__phase63LongSession = {
      navigationMs,
      longTaskMs,
      disconnect: () => {
        observer.disconnect();
        longTaskObserver?.disconnect();
      },
    };
  });
}

async function inspectPerformance(page: Page) {
  return page.evaluate(() => {
    const monitoredWindow = window as typeof window & {
      __phase63LongSession?: {
        navigationMs: number[];
        longTaskMs: number[];
        disconnect: () => void;
      };
    };
    const probe = monitoredWindow.__phase63LongSession;
    if (!probe) throw new Error("Performance probe missing");
    probe.disconnect();
    const infiniteAnimations = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === "running" &&
          animation.effect?.getComputedTiming().iterations === Infinity,
      ).length;
    return {
      navigationMs: [...probe.navigationMs],
      longTaskMs: [...probe.longTaskMs],
      infiniteAnimations,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });
}

for (const scenario of [
  { width: 320, height: 568, rounds: 8 },
  { width: 390, height: 844, rounds: 30 },
  { width: 430, height: 932, rounds: 8 },
]) {
  test(`Phase63 long mobile session ${scenario.width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({
      width: scenario.width,
      height: scenario.height,
    });
    await page.goto("/");
    const home = page.getByTestId("home-screen");
    await expect(home).toBeVisible();

    const navigation = page.getByRole("navigation", { name: "主要メニュー" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    // Warm up all five screens before taking a memory baseline.
    for (const label of tabNames) {
      const button = navigation.getByRole("button", { name: label, exact: true });
      await button.click();
      await expect(button).toHaveAttribute("aria-current", "page");
    }
    await expect(home).toBeVisible();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const readMetrics = async () => {
      await cdp.send("HeapProfiler.collectGarbage");
      const result = await cdp.send("Performance.getMetrics");
      const metrics = new Map(
        result.metrics.map((metric: { name: string; value: number }) => [
          metric.name,
          metric.value,
        ]),
      );
      return {
        heapBytes: metrics.get("JSHeapUsedSize") ?? 0,
        nodes: metrics.get("Nodes") ?? 0,
        documents: metrics.get("Documents") ?? 0,
        listeners: metrics.get("JSEventListeners") ?? 0,
        taskSeconds: metrics.get("TaskDuration") ?? 0,
        layoutSeconds: metrics.get("LayoutDuration") ?? 0,
      };
    };

    const before = await readMetrics();
    const initialFrames = await sampleFrames(page);
    await installNavigationProbe(page);
    for (let round = 0; round < scenario.rounds; round += 1) {
      for (const label of tabNames) {
        const button = navigation.getByRole("button", {
          name: label,
          exact: true,
        });
        await button.click();
        await expect(button).toHaveAttribute("aria-current", "page");
      }
    }
    await expect(home).toBeVisible();
    const after = await readMetrics();
    const finalFrames = await sampleFrames(page);
    const probe = await inspectPerformance(page);
    await cdp.detach();

    const result = {
      viewport: scenario,
      transitions: scenario.rounds * tabNames.length,
      before,
      after,
      heapIncreaseBytes: after.heapBytes - before.heapBytes,
      nodeIncrease: after.nodes - before.nodes,
      p50NavigationMs: percentile(probe.navigationMs, 0.5),
      p95NavigationMs: percentile(probe.navigationMs, 0.95),
      p95InitialFrameMs: percentile(initialFrames, 0.95),
      p95FinalFrameMs: percentile(finalFrames, 0.95),
      longTaskCount: probe.longTaskMs.length,
      longTaskTotalMs: probe.longTaskMs.reduce(
        (sum, duration) => sum + duration,
        0,
      ),
      pageErrors: errors,
    };
    await testInfo.attach("mobile-long-session.json", {
      body: Buffer.from(JSON.stringify(result, null, 2)),
      contentType: "application/json",
    });
    testInfo.annotations.push({
      type: "headless-long-session",
      description: JSON.stringify({
        width: scenario.width,
        transitions: result.transitions,
        p95NavigationMs: result.p95NavigationMs,
        heapIncreaseBytes: result.heapIncreaseBytes,
        nodeIncrease: result.nodeIncrease,
        longTaskCount: result.longTaskCount,
      }),
    });

    expect(probe.navigationMs).toHaveLength(result.transitions);
    expect(errors).toEqual([]);
    expect(probe.documentWidth).toBeLessThanOrEqual(probe.viewportWidth + 1);
    expect(probe.infiniteAnimations).toBe(0);
    // Permissive CI regression guard: report precise values instead of
    // mistaking a shared headless runner for a physical smartphone benchmark.
    expect(result.p95NavigationMs).toBeLessThan(1500);
    expect(after.nodes).toBeLessThanOrEqual(before.nodes * 1.3 + 400);
    expect(after.documents).toBeLessThanOrEqual(before.documents + 2);
    expect(after.listeners).toBeLessThanOrEqual(before.listeners + 200);
    expect(after.heapBytes - before.heapBytes).toBeLessThanOrEqual(
      Math.max(32 * mebibyte, before.heapBytes * 0.6),
    );
    expect(initialFrames).toHaveLength(45);
    expect(finalFrames).toHaveLength(45);
  });
}
