import { expect, test, type Page } from "@playwright/test";
import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import { createDemoGame } from "../../src/app/createDemoGame";
import {
  E2E_ACTION_DELAY_MS_KEY,
  E2E_GAME_STATE_KEY,
  E2E_SERVER_SNAPSHOT_KEY,
} from "../../src/app/createBrowserAppDependencies";
import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";
import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
} from "../../src/domain/tournament/progressOfficialTournaments";
import { advanceWeekFromHome } from "./homeTestHelpers";

function officialSnapshot(): CloudGameSnapshot {
  const initial = createDemoGame();
  let state = {
    ...initial,
    calendar: {
      ...initial.calendar,
      weekOfYear: 9,
    },
  };
  state = advanceOfficialTournamentsThroughWeek(state);

  return {
    userId: "e2e-user",
    schoolDbId: "e2e-school",
    revision: 9,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

async function seedSnapshot(
  page: Page,
  snapshot: CloudGameSnapshot,
  actionDelayMs = 0,
) {
  await page.addInitScript(
    ({ snapshotKey, gameStateKey, delayKey, serialized, delay }) => {
      if (!sessionStorage.getItem(snapshotKey)) {
        sessionStorage.setItem(snapshotKey, serialized);
        sessionStorage.setItem(gameStateKey, "ready");
      }
      sessionStorage.setItem(delayKey, String(delay));
    },
    {
      snapshotKey: E2E_SERVER_SNAPSHOT_KEY,
      gameStateKey: E2E_GAME_STATE_KEY,
      delayKey: E2E_ACTION_DELAY_MS_KEY,
      serialized: JSON.stringify(snapshot),
      delay: actionDelayMs,
    },
  );
}

async function expectNoBodyOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
}

for (const width of [320, 360, 390, 414, 480]) {
  test(`official bracket uses round tabs without horizontal scrolling at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width,
      height: width === 414 ? 824 : width <= 360 ? 800 : 844,
    });
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "主要メニュー" });
    await navigation.getByRole("button", { name: "試合", exact: true }).click();
    await page.getByRole("button", { name: "大会表を見る" }).click();

    await expect(
      page.getByRole("heading", { name: "インターハイ 県大会" }),
    ).toBeVisible();
    await expectNoBodyOverflow(page);
    await expect(page.getByTestId("tournament-bracket-scroll")).toHaveCount(0);

    const panel = page.locator(".tournament-panel");
    const panelWidth = await panel.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(panelWidth.scrollWidth).toBeLessThanOrEqual(
      panelWidth.clientWidth + 1,
    );

    const firstRound = page.getByRole("button", { name: "1回戦" });
    const quarterfinal = page.getByRole("button", { name: "準々決勝" });
    await expect(firstRound).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("tournament-bracket-match")).toHaveCount(8);

    await quarterfinal.click();
    await expect(quarterfinal).toHaveAttribute("aria-pressed", "true");
    await expect(firstRound).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("tournament-bracket-match")).toHaveCount(4);
    await expectNoBodyOverflow(page);
  });
}

test("due official match is reference-only in the bracket and executes from Home", async ({
  page,
}) => {
  await seedSnapshot(page, officialSnapshot());
  await page.goto("/");

  await page.getByRole("button", { name: "大会表を見る" }).click();
  await expect(page.getByText("今週").first()).toBeVisible();
  await expect(
    page.getByText("ホームの「今週を進める」で試合を実施します"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /公式戦を開始/ })).toHaveCount(
    0,
  );
});

async function revealOfficialDecision(page: Page) {
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
          (await page
            .getByTestId("event-sequence")
            .textContent()
            .catch(() => null)) ?? "missing"
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
    snapshot.state?.history?.matches?.filter((match) =>
      Boolean(match.tournamentId),
    ).length ?? 0
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
    await page
      .getByRole("button", { name: "この編成・戦術で試合開始" })
      .click();

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
