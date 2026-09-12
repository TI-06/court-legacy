import { expect, test, type Page } from "@playwright/test";

const LOSE_NEXT_PVP_COMMAND_RESPONSE_KEY =
  "court-legacy:e2e-pvp-lose-next-command-response";

async function expectNoBodyOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
}

async function openPvp(page: Page) {
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "試合", exact: true }).click();
  await page.getByRole("button", { name: "対人戦を開く" }).click();
  await expect(page.getByRole("heading", { name: "対人戦" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "対戦する 白波高校" }),
  ).toBeVisible({ timeout: 2_500 });
}

async function startPvpMatch(page: Page) {
  await page.getByRole("button", { name: "対戦する 白波高校" }).click();
  await expect(page.getByRole("heading", { name: "試合準備" })).toBeVisible();
  await expect(page.getByText("この試合だけの編成です")).toBeVisible();
  await expect(
    page.getByText(
      "対人戦では相手選手の詳細能力は非公開です。公開戦力と戦術傾向を見て編成を決めます。",
    ),
  ).toBeVisible();
  await expectNoBodyOverflow(page);

  await page.getByRole("button", { name: "この編成・戦術で試合開始" }).click();
  await expect(
    page.getByRole("heading", { name: "試合ダイジェスト" }),
  ).toBeVisible({ timeout: 2_500 });
  await expect(page.getByRole("heading", { name: "勝利" })).toHaveCount(0);
  await expectNoBodyOverflow(page);
}

async function revealPvpDecision(page: Page) {
  const decision = page.getByRole("region", { name: "監督指示" });
  if (await decision.isVisible().catch(() => false)) return decision;

  const nextDecision = page.getByRole("button", { name: "次の判断まで進む" });
  if (await nextDecision.isEnabled().catch(() => false)) {
    await nextDecision.click();
  }
  await expect(decision).toBeVisible();
  return decision;
}

async function continuePvpUntilRatedResult(
  page: Page,
  { loseFirstCommandResponse = false } = {},
) {
  let injectLoss = loseFirstCommandResponse;
  const resultHeading = page.getByRole("heading", { name: "勝利" });

  for (let guard = 0; guard < 5; guard += 1) {
    if (await resultHeading.isVisible().catch(() => false)) return;

    const decision = await revealPvpDecision(page);
    await expectNoBodyOverflow(page);
    const scoreBefore =
      (await page.locator(".match-scoreboard").textContent()) ?? "missing";

    if (injectLoss) {
      await page.evaluate(
        (key) => sessionStorage.setItem(key, "1"),
        LOSE_NEXT_PVP_COMMAND_RESPONSE_KEY,
      );
      injectLoss = false;
    }

    const nextSet = decision.getByRole("button", {
      name: "このまま次セットへ",
    });
    if (await nextSet.isVisible().catch(() => false)) {
      await nextSet.click();
    } else {
      await decision.getByRole("button", { name: "このまま続ける" }).click();
    }

    await expect
      .poll(async () => {
        if (await resultHeading.isVisible().catch(() => false)) return "result";
        return (
          (await page
            .locator(".match-scoreboard")
            .textContent()
            .catch(() => null)) ?? "missing"
        );
      })
      .not.toBe(scoreBefore);
  }

  await expect(resultHeading).toBeVisible();
}

for (const width of [320, 360, 390, 414, 480]) {
  test(`Phase16 PvP is resumable, rated, and mobile-safe at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width,
      height: width <= 360 ? 800 : width === 414 ? 824 : 900,
    });
    await page.goto("/");
    await openPvp(page);
    await startPvpMatch(page);

    await continuePvpUntilRatedResult(page, {
      loseFirstCommandResponse: width === 360,
    });

    await expect(page.getByRole("heading", { name: "勝利" })).toBeVisible();
    await expect(page.getByText("+16").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "シーズンランキング" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "対戦履歴" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expectNoBodyOverflow(page);
  });
}
