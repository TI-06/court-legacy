from pathlib import Path

browser_path = Path("src/app/createBrowserAppDependencies.ts")
browser = browser_path.read_text()

old_constants = '''export const E2E_SHOP_LOSE_NEXT_RESPONSE_KEY =
  "court-legacy:e2e-shop-lose-next-response";
'''
new_constants = '''export const E2E_SHOP_LOSE_NEXT_RESPONSE_KEY =
  "court-legacy:e2e-shop-lose-next-response";
export const E2E_PVP_LOSE_NEXT_COMMAND_RESPONSE_KEY =
  "court-legacy:e2e-pvp-lose-next-command-response";
'''
assert old_constants in browser
browser = browser.replace(old_constants, new_constants, 1)

old_shop_consumer = '''function consumeHarnessLostShopResponse(
  operationType: "purchase" | "use",
): boolean {
  if (readSessionStorage(E2E_SHOP_LOSE_NEXT_RESPONSE_KEY) !== operationType) {
    return false;
  }
  writeSessionStorage(E2E_SHOP_LOSE_NEXT_RESPONSE_KEY, "");
  return true;
}
'''
new_shop_consumer = old_shop_consumer + '''
function consumeHarnessLostPvpCommandResponse(): boolean {
  if (readSessionStorage(E2E_PVP_LOSE_NEXT_COMMAND_RESPONSE_KEY) !== "1") {
    return false;
  }
  writeSessionStorage(E2E_PVP_LOSE_NEXT_COMMAND_RESPONSE_KEY, "");
  return true;
}
'''
assert old_shop_consumer in browser
browser = browser.replace(old_shop_consumer, new_shop_consumer, 1)

old_maps = '''  private readonly pvpCompletedSessions = new Map<
    string,
    PvpChallengeResponse
  >();
'''
new_maps = old_maps + '''  private readonly pvpCommandResponses = new Map<
    string,
    PvpChallengeSessionResponse
  >();
'''
assert old_maps in browser
browser = browser.replace(old_maps, new_maps, 1)

old_command_start = '''  async commandPvpChallenge(
    _accessToken: string,
    request: PvpChallengeCommandRequest,
  ): Promise<PvpChallengeSessionResponse> {
    await this.pvpDelay();
    const completed = this.pvpCompletedSessions.get(request.operationId);
    if (completed) return completed;
'''
new_command_start = '''  async commandPvpChallenge(
    _accessToken: string,
    request: PvpChallengeCommandRequest,
  ): Promise<PvpChallengeSessionResponse> {
    await this.pvpDelay();
    const commandKey = `${request.operationId}:${request.commandId}`;
    const replayed = this.pvpCommandResponses.get(commandKey);
    if (replayed) return replayed;
    const completed = this.pvpCompletedSessions.get(request.operationId);
    if (completed) return completed;
'''
assert old_command_start in browser
browser = browser.replace(old_command_start, new_command_start, 1)

old_command_tail = '''    session.step += 1;
    if (session.step >= 3) {
      return this.finishHarnessPvpSession(
        session,
        this.requireSnapshot().revision,
      );
    }
    return this.harnessPvpInProgress(session, this.requireSnapshot().revision);
  }
'''
new_command_tail = '''    session.step += 1;
    const response =
      session.step >= 3
        ? this.finishHarnessPvpSession(
            session,
            this.requireSnapshot().revision,
          )
        : this.harnessPvpInProgress(
            session,
            this.requireSnapshot().revision,
          );
    this.pvpCommandResponses.set(commandKey, response);
    if (consumeHarnessLostPvpCommandResponse()) {
      throw new ApiError(
        null,
        "network_error",
        "対人戦の応答を受信できませんでした",
      );
    }
    return response;
  }
'''
assert old_command_tail in browser
browser = browser.replace(old_command_tail, new_command_tail, 1)
browser_path.write_text(browser)

pvp_e2e = r'''import { expect, test, type Page } from "@playwright/test";

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
      await page.evaluate((key) => sessionStorage.setItem(key, "1"),
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
          (await page.locator(".match-scoreboard").textContent().catch(() => null)) ??
          "missing"
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
'''
Path("tests/e2e/pvp-flow.spec.ts").write_text(pvp_e2e)

official_path = Path("tests/e2e/official-tournament-flow.spec.ts")
official = official_path.read_text()
official = official.replace(
    'import { advanceOfficialTournamentsThroughWeek } from "../../src/domain/tournament/progressOfficialTournaments";',
    'import {\n  advanceOfficialTournamentsThroughWeek,\n  findDueUserOfficialMatch,\n} from "../../src/domain/tournament/progressOfficialTournaments";',
    1,
)

old_test = r'''test("Home progression prepares and commits an official match once, presents it, advances, and survives reload", async ({
  page,
}) => {
  await seedSnapshot(page, officialSnapshot(), 350);
  await page.goto("/");

  await advanceWeekFromHome(page);
  await expect(page.getByRole("heading", { name: "試合準備" })).toBeVisible();
  await expect(page.getByText("この試合だけの編成です")).toBeVisible();
  await expectNoBodyOverflow(page);
  await page.getByRole("button", { name: "この編成・戦術で試合開始" }).click();

  await expect(
    page.getByRole("heading", { name: "試合ダイジェスト" }),
  ).toBeVisible({ timeout: 3_000 });
  await expectNoBodyOverflow(page);

  const afterMatch = await page.evaluate((snapshotKey) => {
    const raw = sessionStorage.getItem(snapshotKey);
    return raw ? JSON.parse(raw) : null;
  }, E2E_SERVER_SNAPSHOT_KEY);
  expect(afterMatch?.revision).toBe(10);
  expect(
    afterMatch?.state?.history?.matches?.some(
      (match: { tournamentId?: string | null }) => Boolean(match.tournamentId),
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "結果まで進む" }).click();
  await expect(page.getByRole("heading", { name: "試合結果" })).toBeVisible();
  await page.getByRole("button", { name: "結果を確認して次へ" }).click();
  await expect(page.getByTestId("home-screen")).toBeVisible();

  const advanced = await page.evaluate((snapshotKey) => {
    const raw = sessionStorage.getItem(snapshotKey);
    return raw ? JSON.parse(raw) : null;
  }, E2E_SERVER_SNAPSHOT_KEY);
  expect(advanced?.revision).toBe(11);
  expect(advanced?.state?.calendar?.weekOfYear).toBe(10);

  await page.reload();
  await expect(page.getByTestId("home-screen")).toBeVisible();
  const reloaded = await page.evaluate((snapshotKey) => {
    const raw = sessionStorage.getItem(snapshotKey);
    return raw ? JSON.parse(raw) : null;
  }, E2E_SERVER_SNAPSHOT_KEY);
  expect(reloaded?.revision).toBe(11);
  expect(reloaded?.state?.calendar?.weekOfYear).toBe(10);
});
'''
new_test = r'''async function revealOfficialDecision(page: Page) {
  const decision = page.getByRole("region", { name: "監督指示" });
  if (await decision.isVisible().catch(() => false)) return decision;
  await page.getByRole("button", { name: "次の判断まで進む" }).click();
  await expect(decision).toBeVisible();
  return decision;
}

async function continueOfficialUntilResult(page: Page): Promise<number> {
  const resultHeading = page.getByRole("heading", { name: "試合結果" });
  let commands = 0;

  for (let guard = 0; guard < 10; guard += 1) {
    if (await resultHeading.isVisible().catch(() => false)) return commands;

    const toResult = page.getByRole("button", { name: "結果まで進む" });
    if (await toResult.isVisible().catch(() => false)) {
      await toResult.click();
      if (await resultHeading.isVisible().catch(() => false)) return commands;
    }

    const decision = await revealOfficialDecision(page);
    const sequenceBefore =
      (await page.getByTestId("event-sequence").textContent()) ?? "missing";
    const nextSet = decision.getByRole("button", {
      name: "このまま次セットへ",
    });
    if (await nextSet.isVisible().catch(() => false)) {
      await nextSet.click();
    } else {
      await decision.getByRole("button", { name: "このまま続ける" }).click();
    }
    commands += 1;

    await expect
      .poll(async () => {
        if (await resultHeading.isVisible().catch(() => false)) return "result";
        return (
          (await page.getByTestId("event-sequence").textContent().catch(() => null)) ??
          "missing"
        );
      })
      .not.toBe(sequenceBefore);
  }

  await expect(resultHeading).toBeVisible();
  return commands;
}

function tournamentHistoryCount(snapshot: {
  state?: { history?: { matches?: Array<{ tournamentId?: string | null }> } };
}) {
  return (
    snapshot.state?.history?.matches?.filter((match) => Boolean(match.tournamentId))
      .length ?? 0
  );
}

function officialStatus(
  snapshot: {
    state?: {
      officialSeason?: {
        interhigh?: {
          prefectural?: { matches?: Array<{ id: string; status: string }> };
        };
      };
    };
  },
  matchId: string,
) {
  return snapshot.state?.officialSeason?.interhigh?.prefectural?.matches?.find(
    (match) => match.id === matchId,
  )?.status;
}

for (const width of [320, 360, 390, 414, 480]) {
  test(`Phase16 official match stays pending until completion at ${width}px`, async ({
    page,
  }) => {
    const seeded = officialSnapshot();
    const due = findDueUserOfficialMatch(seeded.state);
    if (!due) throw new Error("official E2E fixture has no due match");
    const historyBefore = tournamentHistoryCount(seeded);

    await page.setViewportSize({
      width,
      height: width <= 360 ? 800 : width === 414 ? 824 : 900,
    });
    await seedSnapshot(page, seeded);
    await page.goto("/");

    await advanceWeekFromHome(page);
    await expect(page.getByRole("heading", { name: "試合準備" })).toBeVisible();
    await expect(page.getByText("この試合だけの編成です")).toBeVisible();
    await expectNoBodyOverflow(page);
    await page.getByRole("button", { name: "この編成・戦術で試合開始" }).click();

    await expect(
      page.getByRole("heading", { name: "試合ダイジェスト" }),
    ).toBeVisible({ timeout: 3_000 });
    await expect(page.getByTestId("event-sequence")).toBeVisible();
    await expectNoBodyOverflow(page);

    const afterStart = await page.evaluate((snapshotKey) => {
      const raw = sessionStorage.getItem(snapshotKey);
      return raw ? JSON.parse(raw) : null;
    }, E2E_SERVER_SNAPSHOT_KEY);
    expect(afterStart?.revision).toBe(seeded.revision + 1);
    expect(tournamentHistoryCount(afterStart)).toBe(historyBefore);
    expect(officialStatus(afterStart, due.match.id)).not.toBe("completed");

    const firstDecision = await revealOfficialDecision(page);
    await expect(firstDecision).toBeVisible();
    await expectNoBodyOverflow(page);

    const commandCount = await continueOfficialUntilResult(page);
    expect(commandCount).toBeGreaterThan(0);
    await expect(page.getByRole("heading", { name: "試合結果" })).toBeVisible();
    await expectNoBodyOverflow(page);

    const afterResult = await page.evaluate((snapshotKey) => {
      const raw = sessionStorage.getItem(snapshotKey);
      return raw ? JSON.parse(raw) : null;
    }, E2E_SERVER_SNAPSHOT_KEY);
    expect(tournamentHistoryCount(afterResult)).toBe(historyBefore + 1);
    expect(officialStatus(afterResult, due.match.id)).toBe("completed");

    await page.getByRole("button", { name: "結果を確認して次へ" }).click();
    await expect(page.getByTestId("home-screen")).toBeVisible();

    const advanced = await page.evaluate((snapshotKey) => {
      const raw = sessionStorage.getItem(snapshotKey);
      return raw ? JSON.parse(raw) : null;
    }, E2E_SERVER_SNAPSHOT_KEY);
    expect(advanced?.revision).toBeGreaterThan(afterResult.revision);
    expect(advanced?.state?.calendar?.weekOfYear).toBe(10);

    await page.reload();
    await expect(page.getByTestId("home-screen")).toBeVisible();
    const reloaded = await page.evaluate((snapshotKey) => {
      const raw = sessionStorage.getItem(snapshotKey);
      return raw ? JSON.parse(raw) : null;
    }, E2E_SERVER_SNAPSHOT_KEY);
    expect(reloaded?.revision).toBe(advanced.revision);
    expect(reloaded?.state?.calendar?.weekOfYear).toBe(10);
    await expectNoBodyOverflow(page);
  });
}
'''
assert old_test in official
assert 'advanceOfficialTournamentsThroughWeek,\n  findDueUserOfficialMatch' in official
official = official.replace(old_test, new_test, 1)
official_path.write_text(official)
