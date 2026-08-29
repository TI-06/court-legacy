import { expect, test, type Page } from "@playwright/test";
import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import { createDemoGame } from "../../src/app/createDemoGame";
import {
  E2E_ACTION_DELAY_MS_KEY,
  E2E_GAME_STATE_KEY,
  E2E_SERVER_SNAPSHOT_KEY,
} from "../../src/app/createBrowserAppDependencies";
import { markWeeklyActionCompleted } from "../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";
import { advanceOfficialTournamentsThroughWeek } from "../../src/domain/tournament/progressOfficialTournaments";

function officialSnapshot(trainingCompleted: boolean): CloudGameSnapshot {
  const initial = createDemoGame();
  let state = {
    ...initial,
    calendar: {
      ...initial.calendar,
      weekOfYear: 9,
    },
  };
  state = advanceOfficialTournamentsThroughWeek(state);
  if (trainingCompleted) {
    state = markWeeklyActionCompleted(state, "training");
  }

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
      sessionStorage.setItem(snapshotKey, serialized);
      sessionStorage.setItem(gameStateKey, "ready");
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

for (const width of [320, 360, 390, 480]) {
  test(`official bracket keeps body within ${width}px while bracket scrolls internally`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 844 });
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "主要メニュー" });
    await navigation.getByRole("button", { name: "試合", exact: true }).click();
    await page.getByRole("button", { name: "大会表を見る" }).click();

    await expect(
      page.getByRole("heading", { name: "インターハイ 県大会" }),
    ).toBeVisible();
    await expectNoBodyOverflow(page);

    const bracketScroll = page.getByTestId("tournament-bracket-scroll");
    const scrollState = await bracketScroll.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: getComputedStyle(element).overflowX,
    }));
    expect(scrollState.scrollWidth).toBeGreaterThan(scrollState.clientWidth);
    expect(["auto", "scroll"]).toContain(scrollState.overflowX);
  });
}

test("due official match stays blocked until weekly training is complete", async ({
  page,
}) => {
  await seedSnapshot(page, officialSnapshot(false));
  await page.goto("/");

  await page.getByRole("button", { name: "大会表を見る" }).click();
  await expect(page.getByText("今週").first()).toBeVisible();
  await expect(
    page.getByText("今週の練習を完了すると開始できます"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "公式戦を開始" })).toBeDisabled();
});

test("official match shows progress, commits once, and survives reload", async ({
  page,
}) => {
  await seedSnapshot(page, officialSnapshot(true), 500);
  await page.goto("/");

  await page.getByRole("button", { name: "大会表を見る" }).click();
  await page.getByRole("button", { name: "公式戦を開始" }).click();
  await page
    .getByRole("dialog", { name: "公式戦を開始しますか" })
    .getByRole("button", { name: "この試合を開始" })
    .click();

  await expect(
    page.getByRole("status").filter({ hasText: "公式戦を開始しています…" }),
  ).toBeVisible({ timeout: 300 });
  await expect(page.getByRole("status").filter({ hasText: "保存済み ✓" })).toBeVisible({
    timeout: 2_000,
  });

  const persisted = await page.evaluate((snapshotKey) => {
    const raw = sessionStorage.getItem(snapshotKey);
    return raw ? JSON.parse(raw) : null;
  }, E2E_SERVER_SNAPSHOT_KEY);
  expect(persisted?.revision).toBe(10);
  expect(
    persisted?.state?.history?.matches?.some(
      (match: { tournamentId?: string | null }) => Boolean(match.tournamentId),
    ),
  ).toBe(true);

  await page.reload();
  await expect(page.getByRole("heading", { name: "監督ホーム" })).toBeVisible();
  const reloaded = await page.evaluate((snapshotKey) => {
    const raw = sessionStorage.getItem(snapshotKey);
    return raw ? JSON.parse(raw) : null;
  }, E2E_SERVER_SNAPSHOT_KEY);
  expect(reloaded?.revision).toBe(10);
});
