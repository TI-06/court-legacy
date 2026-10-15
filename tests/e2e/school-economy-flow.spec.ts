import { expect, test, type Page } from "@playwright/test";

async function openShop(page: Page) {
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "その他", exact: true }).click();
  await page.getByRole("button", { name: "ショップ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ショップ" })).toBeVisible();
}

function shopCard(page: Page, itemName: string) {
  return page
    .locator("article.shop-card")
    .filter({ has: page.getByRole("heading", { name: itemName, exact: true }) })
    .first();
}

test("free fund grant updates the authoritative balance, survives reload, and appears in the ledger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await openShop(page);

  const grant = shopCard(page, "資金 +300");
  await expect(grant).toContainText("受取回数 0");
  await grant
    .getByRole("button", { name: "資金 +300を受け取る", exact: true })
    .click();

  await expect(page.getByText("資金 +300 / 残高 1,050")).toBeVisible({
    timeout: 2_500,
  });
  await expect(grant).toContainText("受取回数 1");

  await page.getByRole("button", { name: "その他へ戻る", exact: true }).click();
  await page.getByRole("button", { name: "所持品", exact: true }).click();
  await expect(page.getByRole("heading", { name: "所持品" })).toBeVisible();
  await expect(page.getByText("所持アイテムはありません。")).toBeVisible();

  await page.reload();
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "学校", exact: true }).click();

  const fundsButton = page.getByRole("button", {
    name: "資金 1050・履歴を表示",
    exact: true,
  });
  await expect(fundsButton).toBeVisible();
  await fundsButton.click();

  const ledger = page.getByRole("dialog", { name: "資金履歴" });
  await expect(ledger).toBeVisible();
  const latestEntry = ledger.locator("article.funds-ledger__entry").first();
  await expect(latestEntry).toContainText("資金 +300");
  await expect(latestEntry).toContainText("+300");
  await expect(latestEntry).toContainText("残高 1,050");
});

async function expectSchoolNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    schoolClient: document.querySelector(".school-screen")?.clientWidth ?? 0,
    schoolScroll: document.querySelector(".school-screen")?.scrollWidth ?? 0,
  }));

  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  expect(layout.schoolScroll).toBeLessThanOrEqual(layout.schoolClient + 1);
}

async function expectFacilityGridAboveNavigation(page: Page) {
  const grid = page.locator(".facility-grid");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  const gridBox = await grid.boundingBox();
  const navigationBox = await navigation.boundingBox();

  expect(gridBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect((gridBox?.y ?? 0) + (gridBox?.height ?? 0)).toBeLessThanOrEqual(
    navigationBox?.y ?? 0,
  );
}

async function expectCoachGridAboveNavigation(page: Page) {
  const grid = page.locator(".assistant-coach-grid");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  const gridBox = await grid.boundingBox();
  const navigationBox = await navigation.boundingBox();

  expect(gridBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect((gridBox?.y ?? 0) + (gridBox?.height ?? 0)).toBeLessThanOrEqual(
    navigationBox?.y ?? 0,
  );
}

async function expectSeasonRankingAboveNavigation(page: Page) {
  const ranking = page.locator(".school-season-ranking");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  const rankingBox = await ranking.boundingBox();
  const navigationBox = await navigation.boundingBox();

  expect(rankingBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect((rankingBox?.y ?? 0) + (rankingBox?.height ?? 0)).toBeLessThanOrEqual(
    navigationBox?.y ?? 0,
  );
}

test("small 320px school facility paging", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "主要メニュー" })
    .getByRole("button", { name: "学校", exact: true })
    .click();
  const pager = page.getByRole("navigation", {
    name: "設備一覧のページ切替",
  });
  await expect(page.getByTestId("facility-tile")).toHaveCount(1);
  await expect(pager).toContainText("1 / 8");
  await pager.getByRole("button", { name: "次の設備ページ" }).click();
  await expect(pager).toContainText("2 / 8");
  await expect(
    page.getByRole("button", { name: "トレーニング設備の詳細" }),
  ).toBeVisible();
  await expectSchoolNoHorizontalOverflow(page);
});

for (const width of [320, 360, 390, 414, 480] as const) {
  test(`${width}px school management navigation fits`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "学校", exact: true }).click();

    const primary = page.getByRole("tablist", { name: "学校運営メニュー" });
    await expect(primary.getByRole("tab")).toHaveCount(3);
    await expect(page.getByRole("heading", { name: "運営" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "設備" })).toBeVisible();
    await expect(page.getByTestId("facility-tile")).toHaveCount(4);
    const pager = page.getByRole("navigation", {
      name: "設備一覧のページ切替",
    });
    await expect(pager).toContainText("1 / 2");
    await pager.getByRole("button", { name: "次の設備ページ" }).click();
    await expect(page.getByTestId("facility-tile")).toHaveCount(4);
    await expect(pager).toContainText("2 / 2");
    await expect(
      page.getByRole("button", { name: "学習設備の詳細" }),
    ).toBeVisible();
    await pager.getByRole("button", { name: "前の設備ページ" }).click();
    await expect(pager).toContainText("1 / 2");
    await expect(page.getByText("強化可能 8/8")).toBeVisible();
    await expectSchoolNoHorizontalOverflow(page);
    if (width <= 360) {
      await expectFacilityGridAboveNavigation(page);
    }

    const management = page.getByRole("tablist", {
      name: "運営メニュー",
      exact: true,
    });
    await expect(management.getByRole("tab")).toHaveCount(4);
    await management.getByRole("tab", { name: "コーチ" }).click();
    await expect(page.getByRole("heading", { name: "スタッフ" })).toBeVisible();
    await expect(page.getByText("4候補")).toBeVisible();
    const coachPager = page.getByRole("navigation", {
      name: "コーチ一覧のページ切替",
    });
    await expect(page.locator(".assistant-coach-card")).toHaveCount(2);
    await expect(coachPager).toContainText("1 / 2");
    await coachPager.getByRole("button", { name: "次のコーチページ" }).click();
    await expect(coachPager).toContainText("2 / 2");
    await expect(page.locator(".assistant-coach-card")).toHaveCount(2);
    await coachPager.getByRole("button", { name: "前のコーチページ" }).click();
    await expectSchoolNoHorizontalOverflow(page);
    if (width <= 360) {
      await expectCoachGridAboveNavigation(page);
    }

    await management.getByRole("tab", { name: "強化予算" }).click();
    await expect(
      page.getByRole("heading", { name: "年間強化予算" }),
    ).toBeVisible();
    await expect(page.locator(".school-investment-card")).toHaveCount(4);
    await expectSchoolNoHorizontalOverflow(page);

    await management.getByRole("tab", { name: "特別事業" }).click();
    await expect(page.getByRole("heading", { name: "特別事業" })).toBeVisible();
    await expect(page.locator(".school-special-project-card")).toHaveCount(4);
    const projectTabs = page.getByRole("tablist", {
      name: "特別事業の表示切替",
    });
    await expect(projectTabs.getByRole("tab")).toHaveCount(2);
    await projectTabs.getByRole("tab", { name: "特別活動" }).click();
    await expect(page.locator(".school-special-project-card")).toHaveCount(4);
    await expect(
      page.getByRole("button", { name: "全国招待大会の詳細" }),
    ).toBeVisible();
    await projectTabs.getByRole("tab", { name: "年間契約" }).click();
    await expect(
      page.getByRole("button", { name: "全国データバンクの詳細" }),
    ).toBeVisible();
    await expect(page.getByText("年度利用 0/2")).toBeVisible();
    await expectSchoolNoHorizontalOverflow(page);

    await primary.getByRole("tab", { name: "記録" }).click();
    const recordTabs = page.getByRole("tablist", { name: "学校記録メニュー" });
    await expect(recordTabs.getByRole("tab")).toHaveCount(3);
    await expect(
      page.getByRole("region", { name: "今季ランキング" }),
    ).toBeVisible();
    await expectSchoolNoHorizontalOverflow(page);
    if (width <= 360) {
      await expectSeasonRankingAboveNavigation(page);
      await page
        .getByRole("button", { name: "県内周辺校を見る", exact: true })
        .click();
      const rankingDialog = page.getByRole("dialog", {
        name: "県内ランキング",
      });
      await expect(rankingDialog).toBeVisible();
      await rankingDialog
        .getByRole("button", { name: "閉じる", exact: true })
        .click();
    }

    await recordTabs.getByRole("tab", { name: "戦績" }).click();
    await expect(page.getByTestId("school-record-results")).toBeVisible();
    await expectSchoolNoHorizontalOverflow(page);
    if (width <= 360) {
      expect(
        await page.getByTestId("school-match-record").count(),
      ).toBeLessThanOrEqual(3);
      const allMatches = page.getByRole("button", {
        name: /直近\d+試合をすべて見る/,
      });
      if (await allMatches.isVisible()) {
        await allMatches.click();
        await expect(
          page.getByRole("dialog", { name: "直近の試合一覧" }),
        ).toBeVisible();
        await page
          .getByRole("dialog", { name: "直近の試合一覧" })
          .getByRole("button", { name: "閉じる" })
          .click();
      }
    }

    await recordTabs.getByRole("tab", { name: "歴史" }).click();
    await expect(
      page.getByRole("heading", { name: "卒業生記録" }),
    ).toBeVisible();
    await expectSchoolNoHorizontalOverflow(page);
  });
}

test("short 320px screen pages through all assistant coaches", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByRole("button", { name: "学校", exact: true }).click();
  await page
    .getByRole("tablist", { name: "運営メニュー", exact: true })
    .getByRole("tab", { name: "コーチ" })
    .click();

  const cards = page.locator(".assistant-coach-card");
  const pager = page.getByRole("navigation", {
    name: "コーチ一覧のページ切替",
  });
  await expect(cards).toHaveCount(1);
  await expect(pager).toContainText("1 / 4");
  const firstCoach = await cards.first().textContent();
  for (let pageIndex = 2; pageIndex <= 4; pageIndex += 1) {
    await pager.getByRole("button", { name: "次のコーチページ" }).click();
    await expect(cards).toHaveCount(1);
    await expect(pager).toContainText(`${pageIndex} / 4`);
  }
  await expect(pager.getByRole("button", { name: "次のコーチページ" })).toBeDisabled();
  await pager.getByRole("button", { name: "前のコーチページ" }).click();
  await expect(pager).toContainText("3 / 4");
  for (let pageIndex = 2; pageIndex >= 1; pageIndex -= 1) {
    await pager.getByRole("button", { name: "前のコーチページ" }).click();
  }
  await expect(cards.first()).toHaveText(firstCoach ?? "");
  await expectSchoolNoHorizontalOverflow(page);
});
