import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { GameApp } from "../../../src/app/GameApp";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type {
  PvpChallengeResponse,
  PvpHistoryEntry,
  PvpOpponentSummary,
  PvpPublishResponse,
  PvpRankingEntry,
} from "../../../src/domain/pvp/pvpContracts";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import {
  ApiError,
  type GameApiClient,
} from "../../../src/services/api/GameApiClient";
import type {
  AuthClient,
  AuthSession,
} from "../../../src/services/auth/AuthClient";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";

const session: AuthSession = {
  userId: "user-pvp-1",
  email: "coach@example.com",
  accessToken: "pvp-token",
};

const opponent: PvpOpponentSummary = {
  snapshotId: "00000000-0000-4000-8000-000000000201",
  schoolName: "白波高校",
  schoolShortName: "白波",
  reputationRank: "A",
  teamPower: 76,
  academicYear: 2026,
  publishedAt: "2026-08-28T07:05:00.000Z",
  rating: 1048,
  wins: 12,
  losses: 7,
  currentWinStreak: 3,
};

const rankingEntry: PvpRankingEntry = {
  rank: 4,
  snapshotId: opponent.snapshotId,
  schoolName: opponent.schoolName,
  schoolShortName: opponent.schoolShortName,
  rating: opponent.rating,
  matches: 19,
  wins: opponent.wins,
  losses: opponent.losses,
  currentWinStreak: opponent.currentWinStreak,
};

const historyEntry: PvpHistoryEntry = {
  matchId: "00000000-0000-4000-8000-000000000301",
  createdAt: "2026-08-28T07:10:00.000Z",
  opponentSnapshotId: opponent.snapshotId,
  opponentSchoolName: opponent.schoolName,
  perspective: "challenger",
  outcome: "win",
  ratingBefore: 1000,
  ratingAfter: 1016,
  result: {
    outcome: "win",
    challengerSetsWon: 2,
    defenderSetsWon: 1,
    sets: [
      { setNumber: 1, challengerScore: 25, defenderScore: 20 },
      { setNumber: 2, challengerScore: 22, defenderScore: 25 },
      { setNumber: 3, challengerScore: 25, defenderScore: 18 },
    ],
  },
};

function createSnapshot(revision = 1): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: session.userId,
    schoolDbId: "pvp-school-db",
    revision,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function authClient(): AuthClient {
  return {
    getSession: vi.fn().mockResolvedValue(session),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

function publishResponse(snapshot: CloudGameSnapshot): PvpPublishResponse {
  const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
  return {
    operationId: "publish-server-1",
    revision: snapshot.revision,
    team: {
      snapshotId: "00000000-0000-4000-8000-000000000101",
      schoolName: school.name,
      schoolShortName: school.shortName,
      reputationRank: "B",
      teamPower: 71,
      academicYear: snapshot.state.calendar.academicYear,
      publishedAt: "2026-08-28T07:00:00.000Z",
    },
  };
}

function challengeResponse(snapshot: CloudGameSnapshot): PvpChallengeResponse {
  return {
    operationId: "challenge-server-1",
    revision: snapshot.revision,
    seasonId: "2026-08",
    matchId: historyEntry.matchId,
    opponent: {
      snapshotId: opponent.snapshotId,
      schoolName: opponent.schoolName,
      schoolShortName: opponent.schoolShortName,
    },
    rating: { before: 1000, after: 1016, delta: 16 },
    result: historyEntry.result,
    createdAt: historyEntry.createdAt,
  };
}

function createPvpApi(snapshot = createSnapshot()) {
  const getPvpOpponents = vi.fn<NonNullable<GameApiClient["getPvpOpponents"]>>(
    async () => ({
      seasonId: "2026-08",
      opponents: [opponent],
      nextCursor: null,
    }),
  );
  const getPvpRanking = vi.fn<NonNullable<GameApiClient["getPvpRanking"]>>(
    async () => ({
      seasonId: "2026-08",
      ranking: [rankingEntry],
      nextCursor: null,
    }),
  );
  const getPvpHistory = vi.fn<NonNullable<GameApiClient["getPvpHistory"]>>(
    async () => ({
      seasonId: "2026-08",
      history: [historyEntry],
      nextCursor: null,
    }),
  );
  const publishPvpTeam = vi.fn<NonNullable<GameApiClient["publishPvpTeam"]>>(
    async () => publishResponse(snapshot),
  );
  const challengePvpTeam = vi.fn<
    NonNullable<GameApiClient["challengePvpTeam"]>
  >(async () => challengeResponse(snapshot));
  const api: GameApiClient = {
    bootstrap: vi.fn(),
    onboard: vi.fn(),
    applyAction: vi.fn(),
    publishPvpTeam,
    getPvpOpponents,
    challengePvpTeam,
    getPvpRanking,
    getPvpHistory,
  };
  return {
    api,
    getPvpOpponents,
    getPvpRanking,
    getPvpHistory,
    publishPvpTeam,
    challengePvpTeam,
  };
}

function renderApp(api: GameApiClient, snapshot = createSnapshot()) {
  render(
    <GameApp
      api={api}
      auth={authClient()}
      session={session}
      snapshot={snapshot}
    />,
  );
}

function openPvp() {
  fireEvent.click(screen.getByRole("button", { name: "試合" }));
  fireEvent.click(screen.getByRole("button", { name: "対人戦を開く" }));
}

describe("GameApp PvP flow", () => {
  it("loads PvP data, publishes the team, challenges an opponent, and refreshes records", async () => {
    const snapshot = createSnapshot();
    const mocks = createPvpApi(snapshot);
    renderApp(mocks.api, snapshot);

    openPvp();

    await waitFor(() => expect(mocks.getPvpOpponents).toHaveBeenCalledTimes(1));
    expect(mocks.getPvpRanking).toHaveBeenCalledTimes(1);
    expect(mocks.getPvpHistory).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("button", { name: "対戦する 白波高校" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "チームを公開" }));
    await waitFor(() => expect(mocks.publishPvpTeam).toHaveBeenCalledTimes(1));
    expect(mocks.publishPvpTeam.mock.calls[0]![0]).toBe(session.accessToken);
    expect(mocks.publishPvpTeam.mock.calls[0]![1]).toMatchObject({
      revision: 1,
    });
    expect(await screen.findByText("公開中")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "対戦する 白波高校" }));
    await waitFor(() =>
      expect(mocks.challengePvpTeam).toHaveBeenCalledTimes(1),
    );
    expect(mocks.challengePvpTeam.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      opponentSnapshotId: opponent.snapshotId,
    });
    expect(await screen.findByText("勝利")).toBeVisible();
    expect(screen.getAllByText("+16")).toHaveLength(2);
    await waitFor(() => expect(mocks.getPvpRanking).toHaveBeenCalledTimes(2));
    expect(mocks.getPvpHistory).toHaveBeenCalledTimes(2);
  });

  it("adopts the latest snapshot after a stale publish revision and asks for retry", async () => {
    const snapshot = createSnapshot();
    const latest = createSnapshot(2);
    const mocks = createPvpApi(snapshot);
    mocks.publishPvpTeam.mockRejectedValueOnce(
      new ApiError(409, "revision_conflict", "別端末で更新されています"),
    );
    vi.mocked(mocks.api.bootstrap).mockResolvedValue({
      status: "ready",
      game: latest,
    });
    renderApp(mocks.api, snapshot);

    openPvp();
    await screen.findByRole("button", { name: "対戦する 白波高校" });
    fireEvent.click(screen.getByRole("button", { name: "チームを公開" }));

    await waitFor(() => expect(mocks.api.bootstrap).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "最新のゲーム状態を読み込みました。もう一度お試しください",
    );
  });

  it("shows the server daily-limit message without losing the PvP screen", async () => {
    const snapshot = createSnapshot();
    const mocks = createPvpApi(snapshot);
    mocks.challengePvpTeam.mockRejectedValueOnce(
      new ApiError(
        409,
        "pvp_daily_opponent_limit",
        "同じ相手とのレーティング対戦は1日3回までです",
      ),
    );
    renderApp(mocks.api, snapshot);

    openPvp();
    await screen.findByRole("button", { name: "対戦する 白波高校" });
    fireEvent.click(screen.getByRole("button", { name: "対戦する 白波高校" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "同じ相手とのレーティング対戦は1日3回までです",
    );
    expect(screen.getByRole("heading", { name: "対人戦" })).toBeVisible();
  });
});
