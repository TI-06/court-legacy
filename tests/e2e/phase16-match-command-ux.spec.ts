import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
}

async function expectSheetFits(dialog: Locator, page: Page) {
  const metrics = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      viewport: window.innerWidth,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    };
  });
  expect(metrics.left).toBeGreaterThanOrEqual(-0.5);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewport + 0.5);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  await expectNoHorizontalOverflow(page);
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
      // A candidate can reject the request. Continue with the next school.
    }
  }

  await expect(scheduled).toBeVisible();
}

async function startInteractivePractice(page: Page) {
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "試合", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "練習試合の予定" }),
  ).toBeVisible();
  await schedulePracticeMatch(page);

  await navigation.getByRole("button", { name: "ホーム", exact: true }).click();
  await page.getByRole("button", { name: "今週を進める" }).click();
  await expect(page.getByRole("heading", { name: "試合準備" })).toBeVisible();
  await page.getByRole("button", { name: "この編成・戦術で試合開始" }).click();
  await expect(
    page.getByRole("heading", { name: "試合ダイジェスト" }),
  ).toBeVisible();
}

async function continueUntilResult(page: Page) {
  const resultHeading = page.getByRole("heading", { name: "試合結果" });

  for (let guard = 0; guard < 14; guard += 1) {
    if (await resultHeading.isVisible().catch(() => false)) return;

    const toDecision = page.getByRole("button", {
      name: "次の判断まで進む",
    });
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
      await decision.getByRole("button", { name: "このまま続ける" }).click();
    }
    await expect(decision).toBeHidden();
  }

  throw new Error("interactive practice match did not reach the result");
}

for (const width of [320, 360, 390, 414, 480]) {
  test(`${width}px interactive coaching controls and sheets stay mobile-safe`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 900 });
    await page.goto("/");
    await startInteractivePractice(page);

    await expect(page.getByRole("region", { name: "現在戦術" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "次の判断まで進む" }).click();

    const decision = page.getByRole("region", { name: "監督指示" });
    await expect(decision).toBeVisible();
    await expect(
      decision.getByRole("button", { name: "戦術変更" }),
    ).toBeVisible();
    await expect(
      decision.getByRole("button", { name: "選手交代" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await decision.getByRole("button", { name: "戦術変更" }).click();
    const tactics = page.getByRole("dialog", { name: "戦術変更" });
    await expect(tactics).toBeVisible();
    await expect(
      tactics.getByRole("group", { name: "サーブ方針" }),
    ).toBeVisible();
    await expect(
      tactics.getByRole("group", { name: "攻撃方針" }),
    ).toBeVisible();
    await expect(
      tactics.getByRole("group", { name: "ブロック方針" }),
    ).toBeVisible();
    await expectSheetFits(tactics, page);
    await tactics
      .getByRole("button", { name: "この戦術で続ける" })
      .click({ trial: true });
    await tactics.getByRole("button", { name: "閉じる" }).click();

    await decision.getByRole("button", { name: "選手交代" }).click();
    const substitution = page.getByRole("dialog", { name: "選手交代" });
    await expect(substitution).toBeVisible();
    const court = substitution.getByRole("group", { name: "コートの選手" });
    await expect(court.getByRole("button").first()).toBeVisible();
    await court.getByRole("button").first().click();
    const bench = substitution.getByRole("group", { name: "ベンチ" });
    await expect(bench.getByRole("button").first()).toBeVisible();
    await bench.getByRole("button").first().click();
    await expectSheetFits(substitution, page);
    await substitution
      .getByRole("button", { name: "この交代で続ける" })
      .click({ trial: true });
    await substitution.getByRole("button", { name: "閉じる" }).click();

    const nextSet = decision.getByRole("button", {
      name: "このまま次セットへ",
    });
    if (await nextSet.isVisible().catch(() => false)) {
      await nextSet.click();
    } else {
      await decision.getByRole("button", { name: "このまま続ける" }).click();
    }
    await expect(decision).toBeHidden();

    await continueUntilResult(page);
    await expect(page.getByRole("heading", { name: "試合結果" })).toBeVisible();
    await expect(page.getByRole("region", { name: "監督采配" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
