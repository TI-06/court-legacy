import { expect, test, type Page } from "@playwright/test";

const ACTION_DELAY_KEY = "court-legacy:e2e-action-delay-ms";
const SERVER_SNAPSHOT_KEY = "court-legacy:e2e-server-snapshot";
const LOSE_NEXT_SHOP_RESPONSE_KEY =
  "court-legacy:e2e-shop-lose-next-response";

async function enableVisibleActionDelay(page: Page, delayMs = 600) {
  await page.addInitScript(
    ({ key, value }) => {
      sessionStorage.setItem(key, String(value));
    },
    { key: ACTION_DELAY_KEY, value: delayMs },
  );
}

async function seedRecoverablePlayers(page: Page) {
  await page.evaluate((snapshotKey) => {
    const raw = sessionStorage.getItem(snapshotKey);
    if (!raw) throw new Error("E2E server snapshot is missing");

    const snapshot = JSON.parse(raw) as {
      state: {
        userSchoolId: string;
        schools: Record<string, { playerIds: string[] }>;
        players: Record<
          string,
          { fatigue: number; condition: number }
        >;
      };
    };
    const school = snapshot.state.schools[snapshot.state.userSchoolId];
    if (!school) throw new Error("E2E user school is missing");

    for (const playerId of school.playerIds.slice(0, 4)) {
      const player = snapshot.state.players[playerId];
      if (!player) continue;
      player.fatigue = 80;
      player.condition = 70;
    }

    sessionStorage.setItem(snapshotKey, JSON.stringify(snapshot));
  }, SERVER_SNAPSHOT_KEY);
  await page.reload();
}

async function openShop(page: Page) {
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation
    .getByRole("button", { name: "その他", exact: true })
    .click();
  await page.getByRole("button", { name: "ショップ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ショップ" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "疲労回復" })).toBeVisible();
}

function shopCard(page: Page, itemName: string) {
  return page
    .locator("article.shop-card")
    .filter({ has: page.getByRole("heading", { name: itemName, exact: true }) })
    .first();
}

async function purchaseItem(page: Page, itemName: string) {
  const card = shopCard(page, itemName);
  await card
    .getByRole("button", { name: `${itemName}を購入`, exact: true })
    .click();
  await expect(
    card.getByRole("button", {
      name: `${itemName}を購入処理中…`,
      exact: true,
    }),
  ).toBeDisabled({ timeout: 300 });
  await expect(page.getByText("購入しました ✓")).toBeVisible({
    timeout: 2_500,
  });
}

async function openInventory(page: Page) {
  await page.getByRole("button", { name: "所持品", exact: true }).click();
}

function readRange(text: string, label: "現在能力" | "将来性") {
  const match = text.match(new RegExp(`${label}\\s*(\\d+)〜(\\d+)`));
  if (!match) throw new Error(`${label} range not found: ${text}`);
  return { min: Number(match[1]), max: Number(match[2]) };
}

test("mobile shop purchases and uses fatigue recovery with visible progress and annual limits", async ({
  page,
}) => {
  await enableVisibleActionDelay(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await seedRecoverablePlayers(page);
  await openShop(page);

  await purchaseItem(page, "疲労回復");
  await expect(shopCard(page, "疲労回復")).toContainText("所持 1");

  await openInventory(page);
  const inventoryCard = shopCard(page, "疲労回復");
  await expect(inventoryCard).toContainText("×1");
  await inventoryCard
    .getByRole("button", { name: "疲労回復を使用", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "回復する選手を選択" }),
  ).toBeVisible();
  await page.locator(".shop-target-list button").first().click();

  await expect(
    shopCard(page, "疲労回復").getByRole("button", {
      name: "疲労回復を使用処理中…",
      exact: true,
    }),
  ).toBeDisabled({ timeout: 300 });
  await expect(
    page.getByRole("heading", { name: "疲労回復の結果" }),
  ).toBeVisible({ timeout: 2_500 });
  await expect(page.getByText(/疲労 80 → 40/)).toBeVisible();

  for (let remaining = 2; remaining >= 1; remaining -= 1) {
    await page.getByRole("button", { name: "商品", exact: true }).click();
    await purchaseItem(page, "疲労回復");
    await openInventory(page);
    const owned = shopCard(page, "疲労回復");
    await owned
      .getByRole("button", { name: "疲労回復を使用", exact: true })
      .click();
    await page.locator(".shop-target-list button").first().click();
    await expect(page.getByText("使用しました ✓")).toBeVisible({
      timeout: 2_500,
    });
  }

  await page.getByRole("button", { name: "商品", exact: true }).click();
  const exhausted = shopCard(page, "疲労回復");
  await expect(exhausted).toContainText("購入 3 / 3");
  await expect(exhausted).toContainText("使用 3 / 3");
  await expect(exhausted).toContainText("所持 0");
  await expect(
    exhausted.getByRole("button", { name: "疲労回復を購入", exact: true }),
  ).toBeDisabled();

  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(
    360,
  );
});

test("lost purchase response retries the same operation once and stale revision preserves inventory", async ({
  page,
}) => {
  await enableVisibleActionDelay(page, 350);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await seedRecoverablePlayers(page);
  await openShop(page);

  await page.evaluate((key) => {
    sessionStorage.setItem(key, "purchase");
  }, LOSE_NEXT_SHOP_RESPONSE_KEY);

  const product = shopCard(page, "疲労回復");
  await product
    .getByRole("button", { name: "疲労回復を購入", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "購入を再試行" })).toBeVisible({
    timeout: 2_000,
  });
  await page.getByRole("button", { name: "購入を再試行" }).click();
  await expect(page.getByText("購入しました ✓")).toBeVisible({
    timeout: 2_500,
  });
  await expect(shopCard(page, "疲労回復")).toContainText("購入 1 / 3");
  await expect(shopCard(page, "疲労回復")).toContainText("所持 1");

  await openInventory(page);
  await page.evaluate((snapshotKey) => {
    const raw = sessionStorage.getItem(snapshotKey);
    if (!raw) throw new Error("E2E server snapshot is missing");
    const snapshot = JSON.parse(raw) as { revision: number };
    snapshot.revision += 1;
    sessionStorage.setItem(snapshotKey, JSON.stringify(snapshot));
  }, SERVER_SNAPSHOT_KEY);

  await shopCard(page, "疲労回復")
    .getByRole("button", { name: "疲労回復を使用", exact: true })
    .click();
  await page.locator(".shop-target-list button").first().click();

  await expect(
    page.getByText("最新のゲーム状態を読み込みました。もう一度お試しください"),
  ).toBeVisible({ timeout: 2_500 });
  await expect(shopCard(page, "疲労回復")).toContainText("×1");
  await expect(shopCard(page, "疲労回復")).toContainText("使用 0 / 3");
});

test("academic year rollover invalidates prior-year inventory and resets limits", async ({
  page,
}) => {
  await enableVisibleActionDelay(page, 250);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openShop(page);

  await purchaseItem(page, "強化合宿");
  await expect(shopCard(page, "強化合宿")).toContainText("購入 1 / 1");
  await expect(shopCard(page, "強化合宿")).toContainText("所持 1");

  const nextYearIndex = await page.evaluate((snapshotKey) => {
    const raw = sessionStorage.getItem(snapshotKey);
    if (!raw) throw new Error("E2E server snapshot is missing");
    const snapshot = JSON.parse(raw) as {
      revision: number;
      state: { yearIndex: number; calendar: { academicYear: number } };
    };
    snapshot.revision += 1;
    snapshot.state.yearIndex += 1;
    snapshot.state.calendar.academicYear += 1;
    sessionStorage.setItem(snapshotKey, JSON.stringify(snapshot));
    return snapshot.state.yearIndex;
  }, SERVER_SNAPSHOT_KEY);

  await page.reload();
  await openShop(page);
  await expect(page.getByText(`年度 ${nextYearIndex} ・ 所持品は年度更新で失効`)).toBeVisible();
  const fresh = shopCard(page, "強化合宿");
  await expect(fresh).toContainText("購入 0 / 1");
  await expect(fresh).toContainText("使用 0 / 1");
  await expect(fresh).toContainText("所持 0");
  await expect(
    fresh.getByRole("button", { name: "強化合宿を購入", exact: true }),
  ).toBeEnabled();
});

test("scouting research and appraisal tighten only public report ranges", async ({
  page,
}) => {
  await enableVisibleActionDelay(page, 300);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await openShop(page);

  await purchaseItem(page, "スカウト再調査");
  await purchaseItem(page, "潜在能力鑑定");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "育成", exact: true }).click();
  await page.getByRole("button", { name: "新入生スカウト" }).click();
  await expect(page.getByRole("heading", { name: "新入生スカウト" })).toBeVisible();

  const candidate = page.locator("article.scouting-card").first();
  await expect(candidate).toBeVisible();
  const beforeText = (await candidate.textContent()) ?? "";
  const beforeOverall = readRange(beforeText, "現在能力");
  const beforePotential = readRange(beforeText, "将来性");

  await candidate
    .getByRole("button", { name: /^スカウト再調査 / })
    .click();
  await expect(
    page.getByRole("heading", { name: "スカウト再調査の結果" }),
  ).toBeVisible({ timeout: 2_500 });
  const researchedText = (await candidate.textContent()) ?? "";
  const researchedOverall = readRange(researchedText, "現在能力");
  const researchedPotential = readRange(researchedText, "将来性");
  expect(researchedOverall.max - researchedOverall.min).toBeLessThan(
    beforeOverall.max - beforeOverall.min,
  );
  expect(researchedPotential.max - researchedPotential.min).toBeLessThan(
    beforePotential.max - beforePotential.min,
  );
  expect(researchedText).toContain("調査精度 高");

  await candidate
    .getByRole("button", { name: /^潜在能力鑑定 / })
    .click();
  await expect(
    page.getByRole("heading", { name: "潜在能力鑑定の結果" }),
  ).toBeVisible({ timeout: 2_500 });
  const appraisedText = (await candidate.textContent()) ?? "";
  const appraisedPotential = readRange(appraisedText, "将来性");
  expect(appraisedPotential.max - appraisedPotential.min).toBeLessThanOrEqual(4);

  const html = await page.content();
  expect(html).not.toContain("hiddenTraits");
  expect(html).not.toContain("growthPeak");
  expect(html).not.toContain("injuryResistance");
  expect(html).not.toContain("appearanceSeed");
});

test("training efficiency boost is visibly pending, applies once, and disappears after training", async ({
  page,
}) => {
  await enableVisibleActionDelay(page, 400);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await openShop(page);

  await purchaseItem(page, "練習効率アップ");
  await openInventory(page);
  const boost = shopCard(page, "練習効率アップ");
  await boost
    .getByRole("button", { name: "練習効率アップを使用", exact: true })
    .click();
  await expect(
    boost.getByRole("button", {
      name: "練習効率アップを使用処理中…",
      exact: true,
    }),
  ).toBeDisabled({ timeout: 300 });
  await expect(
    page.getByText("次回練習の成長効率 +20% を有効化しました"),
  ).toBeVisible({ timeout: 2_500 });

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "育成", exact: true }).click();
  await expect(page.getByText("次回練習 成長効率 +20%")).toBeVisible();

  await page.getByRole("button", { name: "練習を実行" }).click();
  await page
    .getByRole("dialog", { name: "練習内容を確認" })
    .getByRole("button", { name: "この内容で実行" })
    .click();
  await expect(page.getByRole("heading", { name: "今週の練習結果" })).toBeVisible({
    timeout: 2_500,
  });
  await expect(page.getByText("次回練習 成長効率 +20%")).toHaveCount(0);
});
