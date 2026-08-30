import { expect, test, type Page } from "@playwright/test";
import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import { createDemoGame } from "../../src/app/createDemoGame";
import {
  E2E_GAME_STATE_KEY,
  E2E_SERVER_SNAPSHOT_KEY,
} from "../../src/app/createBrowserAppDependencies";
import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";
import { advanceOfficialTournamentsThroughWeek } from "../../src/domain/tournament/progressOfficialTournaments";

function dynamicsSnapshot(): CloudGameSnapshot {
  const initial = createDemoGame();
  let state = {
    ...initial,
    calendar: {
      ...initial.calendar,
      weekOfYear: 9,
    },
    teamDynamics: {
      ...initial.teamDynamics,
      captainPlayerId: null,
      viceCaptainPlayerId: null,
      cohesion: 1,
      previousCohesion: 1,
      cohesionTrend: "stable" as const,
    },
  };
  state = advanceOfficialTournamentsThroughWeek(state);

  return {
    userId: "e2e-user",
    schoolDbId: "e2e-school",
    revision: 20,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

async function seedSnapshot(page: Page, snapshot: CloudGameSnapshot) {
  await page.addInitScript(
    ({ snapshotKey, gameStateKey, serialized }) => {
      if (!sessionStorage.getItem(snapshotKey)) {
        sessionStorage.setItem(snapshotKey, serialized);
        sessionStorage.setItem(gameStateKey, "ready");
      }
    },
    {
      snapshotKey: E2E_SERVER_SNAPSHOT_KEY,
      gameStateKey: E2E_GAME_STATE_KEY,
      serialized: JSON.stringify(snapshot),
    },
  );
}

async function readPersistedSnapshot(page: Page): Promise<CloudGameSnapshot> {
  return page.evaluate((snapshotKey) => {
    const raw = sessionStorage.getItem(snapshotKey);
    if (!raw) throw new Error("missing persisted E2E snapshot");
    return JSON.parse(raw) as CloudGameSnapshot;
  }, E2E_SERVER_SNAPSHOT_KEY);
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

test("leadership assignment, training, and an official match persist visible dynamics", async ({
  page,
}) => {
  const snapshot = dynamicsSnapshot();
  const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
  const captainPlayerId = school.playerIds[0]!;
  const viceCaptainPlayerId = school.playerIds[1]!;
  const captain = snapshot.state.players[captainPlayerId]!;
  const viceCaptain = snapshot.state.players[viceCaptainPlayerId]!;
  const captainName = `${captain.lastName} ${captain.firstName}`;
  const viceCaptainName = `${viceCaptain.lastName} ${viceCaptain.firstName}`;

  await seedSnapshot(page, snapshot);
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await page.getByRole("button", { name: "チーム状態", exact: true }).click();

  await expect(page.getByRole("heading", { name: "チーム状態" })).toBeVisible();
  await expect(page.getByLabel("チーム結束力")).toContainText("1");
  await page
    .getByLabel("主将", { exact: true })
    .selectOption(captainPlayerId);
  await page
    .getByLabel("副主将", { exact: true })
    .selectOption(viceCaptainPlayerId);
  await page.getByRole("button", { name: "役職を保存" }).click();
  await expect(page.getByRole("status")).toHaveText("保存済み ✓");
  await expect(
    page.getByText(captainName, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(viceCaptainName, { exact: true }).first(),
  ).toBeVisible();

  await navigation.getByRole("button", { name: "育成", exact: true }).click();
  await page.getByRole("button", { name: "練習を実行" }).click();
  await page
    .getByRole("dialog", { name: "練習内容を確認" })
    .getByRole("button", { name: "この内容で実行" })
    .click();
  await expect(
    page.getByRole("heading", { name: "今週の練習結果" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("保存済み ✓");

  await navigation.getByRole("button", { name: "試合", exact: true }).click();
  await page.getByRole("button", { name: "大会表を見る" }).click();
  await page.getByRole("button", { name: "公式戦を開始" }).click();
  await page
    .getByRole("dialog", { name: "公式戦を開始しますか" })
    .getByRole("button", { name: "この試合を開始" })
    .click();
  await expect(page.getByRole("status")).toHaveText("保存済み ✓");

  const persisted = await readPersistedSnapshot(page);
  expect(persisted.revision).toBe(23);
  expect(persisted.state.teamDynamics.captainPlayerId).toBe(captainPlayerId);
  expect(persisted.state.teamDynamics.viceCaptainPlayerId).toBe(
    viceCaptainPlayerId,
  );
  expect(persisted.state.teamDynamics.recentOfficialMatchesTracked).toBe(1);
  expect(persisted.state.teamDynamics.cohesion).toBeGreaterThan(1);
  expect(persisted.state.teamDynamics.cohesion).toBeLessThanOrEqual(100);

  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await page.getByRole("button", { name: "チーム状態", exact: true }).click();

  const cohesion = page.getByLabel("チーム結束力");
  await expect(cohesion).toContainText(
    String(persisted.state.teamDynamics.cohesion),
  );
  await expect(
    page.getByText(captainName, { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(viceCaptainName, { exact: true }).first(),
  ).toBeVisible();
});

for (const width of [320, 360, 390, 480]) {
  test(`team dynamics has no body overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 844 });
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "主要メニュー" });
    await navigation.getByRole("button", { name: "選手", exact: true }).click();
    await page.getByRole("button", { name: "チーム状態", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "チーム状態" }),
    ).toBeVisible();
    await expect(page.getByLabel("主将", { exact: true })).toBeVisible();
    await expect(page.getByLabel("副主将", { exact: true })).toBeVisible();
    await expectNoBodyOverflow(page);
  });
}
