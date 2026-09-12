import { expect, test, type Page } from "@playwright/test";
import {
  E2E_GAME_STATE_KEY,
  E2E_SERVER_SNAPSHOT_KEY,
} from "../../src/app/createBrowserAppDependencies";
import { createDemoGame } from "../../src/app/createDemoGame";
import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";
import { E2E_AUTH_SESSION } from "../../src/services/auth/MockAuthClient";
import { advanceWeekFromHome } from "./homeTestHelpers";

async function seedYearEndState(page: Page, legacy = false) {
  const state = createDemoGame();
  state.date = "2027-03-31";
  state.calendar.currentDate = state.date;
  state.calendar.weekOfYear = 52;

  if (legacy) {
    delete state.seasonGoals;
    delete state.history.seasonGoalSeasons;
  }

  const snapshot = {
    userId: E2E_AUTH_SESSION.userId,
    schoolDbId: "e2e-school",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };

  await page.addInitScript(
    ({ gameStateKey, serverSnapshotKey, snapshotValue }) => {
      sessionStorage.setItem(gameStateKey, "ready");
      sessionStorage.setItem(serverSnapshotKey, JSON.stringify(snapshotValue));
    },
    {
      gameStateKey: E2E_GAME_STATE_KEY,
      serverSnapshotKey: E2E_SERVER_SNAPSHOT_KEY,
      snapshotValue: snapshot,
    },
  );
}

test("year rollover shows season review and archives it in School records", async ({
  page,
}) => {
  await seedYearEndState(page);
  await page.goto("/");

  await advanceWeekFromHome(page);

  const transition = page.getByRole("dialog", { name: "2年目の新年度" });
  await expect(transition).toBeVisible();
  await expect(
    transition.getByRole("region", { name: "シーズン振り返り" }),
  ).toBeVisible();
  await transition.getByRole("button", { name: "新年度を始める" }).click();

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await page.getByRole("tab", { name: "記録" }).click();

  const archive = page.getByRole("region", { name: "過去シーズン" });
  await expect(archive).toBeVisible();
  await expect(archive.getByRole("heading", { name: "1年目" })).toBeVisible();
  await expect(archive).toContainText("目標達成");
  await expect(archive).toContainText("県内");
  await expect(archive).toContainText("全国");

  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
});

test("legacy v8 year rollover keeps the new-year dialog usable without an archived review", async ({
  page,
}) => {
  await seedYearEndState(page, true);
  await page.goto("/");

  await advanceWeekFromHome(page);

  const transition = page.getByRole("dialog", { name: "2年目の新年度" });
  await expect(transition).toBeVisible();
  await expect(
    transition.getByRole("region", { name: "シーズン振り返り" }),
  ).toHaveCount(0);
  await expect(
    transition.getByRole("button", { name: "新年度を始める" }),
  ).toBeVisible();
});
