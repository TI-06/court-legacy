import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
}

async function schedulePracticeMatch(page: Page) {
  const scheduled = page.getByText("対戦決定", { exact: true });
  if (await scheduled.isVisible().catch(() => false)) return;

  const acceptOffer = page.getByRole("button", { name: "受ける" });
  if (await acceptOffer.isVisible().catch(() => false)) {
    await acceptOffer.click();
    await expect(scheduled).toBeVisible();
    return;
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const requestButton = page
      .locator("button")
      .filter({ hasText: "申し込む" })
      .first();
    if (!(await requestButton.isVisible().catch(() => false))) break;

    await requestButton.click();
    try {
      await expect(scheduled).toBeVisible({ timeout: 900 });
      return;
    } catch {
      // A candidate can reject the request. Continue with the next available school.
    }
  }

  await expect(scheduled).toBeVisible();
}

async function issueOpponentTargetAtNextDecision(page: Page) {
  const resultHeading = page.getByRole("heading", { name: "試合結果" });

  for (let guard = 0; guard < 8; guard += 1) {
    if (await resultHeading.isVisible().catch(() => false)) {
      throw new Error(
        "match completed before Phase52 targeting became available",
      );
    }

    const decision = page.getByRole("region", { name: "監督指示" });
    if (!(await decision.isVisible().catch(() => false))) {
      const toDecision = page.getByRole("button", { name: "次の判断まで進む" });
      await expect(toDecision).toBeVisible();
      await toDecision.click();
      await expect(decision).toBeVisible();
    }

    const targeting = decision.getByRole("button", { name: "相手を狙う" });
    if (await targeting.isVisible().catch(() => false)) {
      await targeting.click();
      const dialog = page.getByRole("dialog", { name: "相手を狙う" });
      await expect(dialog).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const viewport = page.viewportSize();
      const box = await dialog.boundingBox();
      expect(viewport).not.toBeNull();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

      const serveTarget = dialog
        .getByRole("button", { name: /^サーブで狙う / })
        .first();
      await expect(serveTarget).toBeVisible();
      await serveTarget.click();
      return;
    }

    const nextSet = decision.getByRole("button", {
      name: "このまま次セットへ",
    });
    await expect(nextSet).toBeVisible();
    await nextSet.click();
    await expect(decision).toBeHidden();
  }

  throw new Error("Phase52 targeting did not become available");
}

async function finishInteractiveMatch(page: Page) {
  const resultHeading = page.getByRole("heading", { name: "試合結果" });

  for (let guard = 0; guard < 14; guard += 1) {
    if (await resultHeading.isVisible().catch(() => false)) return;

    const toDecision = page.getByRole("button", { name: "次の判断まで進む" });
    const toResult = page.getByRole("button", { name: "結果まで進む" });
    if (await toDecision.isVisible().catch(() => false)) {
      await toDecision.click();
    } else if (await toResult.isVisible().catch(() => false)) {
      await toResult.click();
    }

    if (await resultHeading.isVisible().catch(() => false)) return;

    const decision = page.getByRole("region", { name: "監督指示" });
    await expect(decision).toBeVisible();
    const nextSet = decision.getByRole("button", {
      name: "このまま次セットへ",
    });
    if (await nextSet.isVisible().catch(() => false)) {
      await nextSet.click();
    } else {
      await decision
        .getByRole("button", { name: /^このまま(?:続ける|勝負する)$/ })
        .click();
    }
    await expect(decision).toBeHidden();
  }

  throw new Error("interactive practice match did not reach the result");
}

for (const width of [320, 360, 390, 414, 480]) {
  test(`${width}px Home progression resolves a scheduled practice match and advances the week`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 900 });
    await page.goto("/");

    const home = page.getByTestId("home-screen");
    const navigation = page.getByRole("navigation", { name: "主要メニュー" });
    const weekHeading = page.locator("#home-week-heading");
    await expect(home).toBeVisible();
    const initialWeek = await weekHeading.textContent();
    await expectNoHorizontalOverflow(page);

    await navigation.getByRole("button", { name: "試合", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "練習試合の予定" }),
    ).toBeVisible();
    await schedulePracticeMatch(page);
    await expect(
      page.getByText("ホームの「今週を進める」で実施"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "試合開始" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await navigation
      .getByRole("button", { name: "ホーム", exact: true })
      .click();
    await expect(home).toBeVisible();
    await page.getByRole("button", { name: "今週を進める" }).click();

    await expect(page.getByRole("heading", { name: "試合準備" })).toBeVisible();
    await expect(page.getByText("この試合だけの編成です")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page
      .getByRole("button", { name: "この編成・戦術で試合開始" })
      .click();

    await expect(
      page.getByRole("heading", { name: "試合ダイジェスト" }),
    ).toBeVisible();
    await expect(page.getByTestId("event-sequence")).toContainText("1 /");
    if (width === 390) {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expect(page.getByTestId("match-live-home-points")).toBeVisible();
      await expect(page.getByTestId("match-live-away-points")).toBeVisible();
      await expect(page.locator(".match-screen--live")).toHaveAttribute(
        "data-reduced-motion",
        "false",
      );
    }
    await expectNoHorizontalOverflow(page);

    if (width === 390) {
      await issueOpponentTargetAtNextDecision(page);
      await expectNoHorizontalOverflow(page);
    }

    await finishInteractiveMatch(page);
    await expect(page.getByRole("heading", { name: "試合結果" })).toBeVisible();
    if (width === 390) {
      const verdictMotion = await page
        .getByTestId("match-result-verdict")
        .evaluate((element) => getComputedStyle(element).animationName);
      expect(verdictMotion).toBe("phase63-result-stamp");
    }
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "結果を確認して次へ" }).click();
    await expect(home).toBeVisible();
    if (initialWeek) {
      await expect(weekHeading).not.toHaveText(initialWeek);
    }
    await expectNoHorizontalOverflow(page);

    await page.getByRole("tab", { name: /最近の動き/ }).click();
    const trainingResult = page
      .getByRole("button", { name: /今週の練習結果/ })
      .first();
    await expect(trainingResult).toBeVisible();
    if (width === 390) {
      await expect(trainingResult).toHaveAttribute(
        "data-event-motion",
        /^(training|rank-up)$/,
      );
      const animation = await trainingResult.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          name: style.animationName,
          duration: style.animationDuration,
          iterations: style.animationIterationCount,
        };
      });
      expect(animation.name).toMatch(/^home-news-/);
      expect(parseFloat(animation.duration)).toBeLessThanOrEqual(0.4);
      expect(animation.iterations).toBe("1");
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(
        await trainingResult.evaluate(
          (element) => getComputedStyle(element).animationName,
        ),
      ).toBe("none");
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
    await trainingResult.click();
    const dialog = page.getByRole("dialog", { name: "今週の練習結果" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('[data-tone="positive"]').first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 360, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`match screens fit ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "主要メニュー" });
    await navigation.getByRole("button", { name: "試合" }).click();
    await schedulePracticeMatch(page);
    await navigation.getByRole("button", { name: "ホーム" }).click();
    await page.getByRole("button", { name: "今週を進める" }).click();

    const clearance = async (content: string, action: string) =>
      page.evaluate(
        ({ content, action }) => {
          const target = document.querySelector(content)!;
          const controls = document.querySelector(action)!;
          const nav = document.querySelector(".bottom-game-nav")!;
          return {
            contentBottom: target.getBoundingClientRect().bottom,
            actionTop: controls.getBoundingClientRect().top,
            actionBottom: controls.getBoundingClientRect().bottom,
            navTop: nav.getBoundingClientRect().top,
            bodyWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
          };
        },
        { content, action },
      );

    await expect(page.getByRole("heading", { name: "試合準備" })).toBeVisible();
    const preMatch = await clearance(
      ".pre-match-lineup__versus",
      ".pre-match-lineup__start",
    );
    expect(preMatch.actionBottom).toBeLessThanOrEqual(preMatch.navTop + 1);
    expect(preMatch.bodyWidth).toBeLessThanOrEqual(preMatch.viewportWidth + 1);

    await page
      .getByRole("button", { name: "この編成・戦術で試合開始" })
      .click();
    await expect(
      page.getByRole("heading", { name: "試合ダイジェスト" }),
    ).toBeVisible();
    const live = await clearance(".match-scoreboard", ".match-controls");
    expect(live.actionBottom).toBeLessThanOrEqual(live.navTop + 1);
    expect(live.bodyWidth).toBeLessThanOrEqual(live.viewportWidth + 1);

    await finishInteractiveMatch(page);
    const growth = page.getByRole("dialog", { name: "試合後の成長" });
    if (await growth.isVisible().catch(() => false)) {
      await growth.getByRole("button", { name: "閉じる" }).click();
    }
    const tabs = page.getByRole("tablist", { name: "試合結果の表示切替" });
    await expect(tabs.getByRole("tab")).toHaveCount(4);

    const heroTypography = await page
      .locator(".match-result-score b")
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(heroTypography).toBeGreaterThanOrEqual(28);

    for (const [tab, visible] of [
      ["総合評価", ".match-review-summary"],
      ["チーム", ".match-box-score"],
      ["選手", ".match-player-review"],
      ["振り返り", ".practice-match-review"],
    ] as const) {
      await tabs.getByRole("tab", { name: tab }).click();
      await expect(tabs.getByRole("tab", { name: tab })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.getByRole("tabpanel", { name: tab })).toBeVisible();
      await expect(page.locator(visible)).toBeVisible();
      const typographyTarget =
        tab === "総合評価"
          ? ".match-review-summary__categories small"
          : tab === "チーム"
            ? ".match-box-score__row span"
            : tab === "選手"
              ? ".match-player-review__metrics small"
              : ".practice-match-review__facts small";
      const fontSize = await page
        .locator(typographyTarget)
        .first()
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      expect(
        fontSize,
        `${tab} typography at ${viewport.width}px`,
      ).toBeGreaterThanOrEqual(11);
      const result = await clearance(
        ".match-result-body",
        ".match-result-actions--fixed",
      );
      expect(result.contentBottom).toBeLessThanOrEqual(result.actionTop + 1);
      expect(result.actionBottom).toBeLessThanOrEqual(result.navTop + 1);
      expect(result.bodyWidth).toBeLessThanOrEqual(result.viewportWidth + 1);
      if (tab === "選手") {
        const details = page.locator(".match-result-body");
        const scrolled = await details.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
          return element.scrollTop;
        });
        expect(scrolled).toBeGreaterThan(0);
        await tabs.getByRole("tab", { name: "振り返り" }).click();
        await expect(
          tabs.getByRole("tab", { name: "振り返り" }),
        ).toHaveAttribute("aria-selected", "true");
        expect(await details.evaluate((element) => element.scrollTop)).toBe(0);
      }
    }

    if (viewport.width === 390) {
      await tabs.getByRole("tab", { name: "チーム" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(tabs.getByRole("tab", { name: "選手" })).toBeFocused();
      await expect(tabs.getByRole("tab", { name: "選手" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.keyboard.press("Home");
      await expect(tabs.getByRole("tab", { name: "総合評価" })).toBeFocused();
      await page.keyboard.press("End");
      await expect(tabs.getByRole("tab", { name: "振り返り" })).toBeFocused();
    }

    const height = await page.evaluate(() => ({
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: document.documentElement.clientHeight,
    }));
    expect(height.documentHeight).toBeLessThanOrEqual(
      height.viewportHeight + 1,
    );
    await page.getByRole("button", { name: "結果を確認して次へ" }).click();
    await expect(page.getByTestId("home-screen")).toBeVisible();
  });
}
