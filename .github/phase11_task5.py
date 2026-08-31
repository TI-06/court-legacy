from pathlib import Path


Path("tests/e2e/home-match-flow.spec.ts").write_text(r'''import { expect, test, type Page } from "@playwright/test";

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
      page.getByText('ホームの「次の週へ進む」で実施'),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "試合開始" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await navigation.getByRole("button", { name: "ホーム", exact: true }).click();
    await expect(home).toBeVisible();
    await page.getByRole("button", { name: "次の週へ進む" }).click();

    await expect(
      page.getByRole("heading", { name: "試合ダイジェスト" }),
    ).toBeVisible();
    await expect(page.getByTestId("event-sequence")).toContainText("1 /");
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "結果まで進む" }).click();
    await expect(page.getByRole("heading", { name: "試合結果" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "結果を確認して次へ" }).click();
    await expect(home).toBeVisible();
    if (initialWeek) {
      await expect(weekHeading).not.toHaveText(initialWeek);
    }
    await expect(page.locator(".home-notification-list")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page
      .getByRole("button", { name: /今週の練習結果/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "今週の練習結果" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-tone="positive"]').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
''')

Path("tests/e2e/official-tournament-flow.spec.ts").write_text(r'''import { expect, test, type Page } from "@playwright/test";
import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import { createDemoGame } from "../../src/app/createDemoGame";
import {
  E2E_ACTION_DELAY_MS_KEY,
  E2E_GAME_STATE_KEY,
  E2E_SERVER_SNAPSHOT_KEY,
} from "../../src/app/createBrowserAppDependencies";
import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";
import { advanceOfficialTournamentsThroughWeek } from "../../src/domain/tournament/progressOfficialTournaments";

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
    expect(panelWidth.scrollWidth).toBeLessThanOrEqual(panelWidth.clientWidth + 1);

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
    page.getByText('ホームの「次の週へ進む」で試合を実施します'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /公式戦を開始/ }),
  ).toHaveCount(0);
});

test("Home progression commits an official match once, presents it, advances, and survives reload", async ({
  page,
}) => {
  await seedSnapshot(page, officialSnapshot(), 350);
  await page.goto("/");

  await page.getByRole("button", { name: "次の週へ進む" }).click();
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
''')
