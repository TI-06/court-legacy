import { expect, test, type Page } from "@playwright/test";
import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import { createDemoGame } from "../../src/app/createDemoGame";
import {
  E2E_GAME_STATE_KEY,
  E2E_SERVER_SNAPSHOT_KEY,
} from "../../src/app/createBrowserAppDependencies";
import type { GameState } from "../../src/domain/model/GameState";
import { markWeeklyActionCompleted } from "../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";
import {
  advanceOfficialTournamentsThroughWeek,
  completeTournamentMatch,
  findDueUserOfficialMatch,
} from "../../src/domain/tournament/progressOfficialTournaments";

function atWeek(state: GameState, weekOfYear: number): GameState {
  return {
    ...state,
    calendar: {
      ...state.calendar,
      weekOfYear,
    },
  };
}

function snapshot(state: GameState, revision: number): CloudGameSnapshot {
  return {
    userId: "e2e-user",
    schoolDbId: "e2e-school",
    revision,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

async function seedSnapshot(page: Page, value: CloudGameSnapshot) {
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
      serialized: JSON.stringify(value),
    },
  );
}

function eliminateUserFromInterhigh(): CloudGameSnapshot {
  let state = advanceOfficialTournamentsThroughWeek(
    atWeek(createDemoGame(), 9),
  );
  const due = findDueUserOfficialMatch(state);
  if (!due || due.circuit !== "interhigh" || due.level !== "prefectural") {
    throw new Error("expected Interhigh prefectural opening match");
  }

  const userEntrantId = due.userEntrant.entrantId;
  const opponentEntrantId =
    due.match.homeEntrantId === userEntrantId
      ? due.match.awayEntrantId
      : due.match.homeEntrantId;
  if (!opponentEntrantId) {
    throw new Error("expected Interhigh opening opponent");
  }
  const userIsHome = due.match.homeEntrantId === userEntrantId;

  state = completeTournamentMatch({
    state,
    circuit: due.circuit,
    level: due.level,
    matchId: due.match.id,
    winnerEntrantId: opponentEntrantId,
    homeSetsWon: userIsHome ? 0 : 2,
    awaySetsWon: userIsHome ? 2 : 0,
  });
  state = advanceOfficialTournamentsThroughWeek(atWeek(state, 12));
  state = atWeek(state, 13);
  state = markWeeklyActionCompleted(state, "training");

  return snapshot(state, 30);
}

function qualifyUserForInterhighNationals(): {
  game: CloudGameSnapshot;
  opponentName: string;
} {
  let state = createDemoGame();
  for (const week of [9, 10, 11, 12]) {
    state = advanceOfficialTournamentsThroughWeek(atWeek(state, week));
    const due = findDueUserOfficialMatch(state);
    if (!due || due.circuit !== "interhigh" || due.level !== "prefectural") {
      throw new Error(`expected prefectural user match in week ${week}`);
    }
    const userEntrantId = due.userEntrant.entrantId;
    const userIsHome = due.match.homeEntrantId === userEntrantId;
    state = completeTournamentMatch({
      state,
      circuit: due.circuit,
      level: due.level,
      matchId: due.match.id,
      winnerEntrantId: userEntrantId,
      homeSetsWon: userIsHome ? 2 : 0,
      awaySetsWon: userIsHome ? 0 : 2,
    });
  }

  state = advanceOfficialTournamentsThroughWeek(atWeek(state, 16));
  const national = findDueUserOfficialMatch(state);
  if (!national || national.level !== "national") {
    throw new Error("expected Interhigh national user match");
  }
  if (national.opponent.source !== "guest-representative") {
    throw new Error("expected national opponent to be a guest representative");
  }

  return {
    game: snapshot(state, 40),
    opponentName: national.opponent.displayName,
  };
}

test("prefectural elimination does not end the save or block later weeks", async ({
  page,
}) => {
  await seedSnapshot(page, eliminateUserFromInterhigh());
  await page.goto("/");

  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByText("春高 県大会")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "次の週へ進む" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "次の週へ進む" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "保存済み ✓" }),
  ).toBeVisible();

  const persisted = await page.evaluate((snapshotKey) => {
    const raw = sessionStorage.getItem(snapshotKey);
    return raw ? JSON.parse(raw) : null;
  }, E2E_SERVER_SNAPSHOT_KEY);
  expect(persisted?.revision).toBe(31);
  expect(persisted?.state?.calendar?.weekOfYear).toBe(14);
  expect(
    persisted?.state?.officialSeason?.interhigh?.prefectural?.userEliminated,
  ).toBe(true);
});

test("national qualification exposes the guest identity without persisting a guest roster", async ({
  page,
}) => {
  const prepared = qualifyUserForInterhighNationals();
  await seedSnapshot(page, prepared.game);
  await page.goto("/");

  await expect(page.getByText("インターハイ 全国大会")).toBeVisible();
  await expect(page.getByTitle(prepared.opponentName).first()).toBeVisible();
  await page.getByRole("button", { name: "大会表を見る" }).click();
  await expect(
    page.getByRole("heading", { name: "インターハイ 全国大会" }),
  ).toBeVisible();
  await expect(page.getByTitle(prepared.opponentName).first()).toBeVisible();

  const persistence = await page.evaluate((snapshotKey) => {
    const raw = sessionStorage.getItem(snapshotKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      schoolIds: Object.keys(parsed.state?.schools ?? {}),
      playerIds: Object.keys(parsed.state?.players ?? {}),
    };
  }, E2E_SERVER_SNAPSHOT_KEY);

  expect(
    persistence?.schoolIds.some((id: string) => id.includes("guest:")),
  ).toBe(false);
  expect(
    persistence?.playerIds.some((id: string) => id.includes("guest:")),
  ).toBe(false);
});
