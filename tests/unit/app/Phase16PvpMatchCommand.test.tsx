import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameApp } from "../../../src/app/GameApp";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type {
  PvpChallengeInProgressResponse,
  PvpOpponentSummary,
} from "../../../src/domain/pvp/pvpContracts";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import { playerId } from "../../../src/domain/model/identifiers";
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
  userId: "phase16-pvp-browser-user",
  email: "coach@example.com",
  accessToken: "phase16-pvp-token",
};

const publicOpponentPlayers = [
  {
    id: playerId("pvp-public-oh-1"),
    lastName: "白石",
    firstName: "悠斗",
    preferredPosition: "OH" as const,
    role: "court" as const,
    slot: 1,
  },
  {
    id: playerId("pvp-public-mb-1"),
    lastName: "黒田",
    firstName: "蓮",
    preferredPosition: "MB" as const,
    role: "court" as const,
    slot: 2,
  },
  {
    id: playerId("pvp-public-op"),
    lastName: "青木",
    firstName: "陸",
    preferredPosition: "OP" as const,
    role: "court" as const,
    slot: 3,
  },
  {
    id: playerId("pvp-public-oh-2"),
    lastName: "赤坂",
    firstName: "湊",
    preferredPosition: "OH" as const,
    role: "court" as const,
    slot: 4,
  },
  {
    id: playerId("pvp-public-mb-2"),
    lastName: "緑川",
    firstName: "颯",
    preferredPosition: "MB" as const,
    role: "court" as const,
    slot: 5,
  },
  {
    id: playerId("pvp-public-s"),
    lastName: "橘",
    firstName: "樹",
    preferredPosition: "S" as const,
    role: "court" as const,
    slot: 6,
  },
  {
    id: playerId("pvp-public-l"),
    lastName: "水野",
    firstName: "碧",
    preferredPosition: "L" as const,
    role: "libero" as const,
    slot: null,
  },
];

const opponent: PvpOpponentSummary = {
  snapshotId: "00000000-0000-4000-8000-000000000201",
  schoolName: "白波高校",
  schoolShortName: "白波",
  reputationRank: "A",
  teamPower: 76,
  academicYear: 2026,
  publishedAt: "2026-09-10T07:05:00.000Z",
  rating: 1048,
  wins: 12,
  losses: 7,
  currentWinStreak: 3,
};

function createSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: session.userId,
    schoolDbId: "phase16-pvp-school-db",
    revision: 9,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function authClient(): AuthClient {
  return {
    getSession: vi.fn().mockResolvedValue(session),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    signInWithCredentials: vi.fn().mockResolvedValue(undefined),
    registerAccount: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    isPasswordRecovery: vi.fn().mockReturnValue(false),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

function inProgress(
  snapshot: CloudGameSnapshot,
  sequence = 1,
): PvpChallengeInProgressResponse {
  return {
    status: "in-progress",
    operationId: "phase16-pvp-operation",
    revision: snapshot.revision,
    seasonId: "2026-09",
    opponent: {
      snapshotId: opponent.snapshotId,
      schoolName: opponent.schoolName,
      schoolShortName: opponent.schoolShortName,
    },
    segment: {
      status: "in-progress",
      operationId: "phase16-pvp-operation",
      matchId: "pvp:phase16-browser-match",
      phase: "coach-decision",
      currentSetNumber: 1,
      challengerSetsWon: 0,
      defenderSetsWon: 0,
      currentScore: { challenger: 8 + sequence, defender: 12 },
      challengerSelection: snapshot.teamSelection,
      challengerTactics: {
        serve: "balanced",
        attack: "balanced",
        block: "read",
      },
      opponentPlayers: publicOpponentPlayers,
      timeoutAvailable: true,
      sets: [],
      pendingDecisionReason: "opponent-run",
      events: [
        {
          sequence,
          type: "point",
          setNumber: 1,
          challengerScore: 8 + sequence,
          defenderScore: 12,
          winner: "defender",
          detailCode: "point.attack",
        },
      ],
    },
  };
}

function baseApi(
  _snapshot: CloudGameSnapshot,
  challengePvpTeam: NonNullable<GameApiClient["challengePvpTeam"]>,
  commandPvpChallenge: NonNullable<GameApiClient["commandPvpChallenge"]>,
  getPvpChallengeSession: NonNullable<GameApiClient["getPvpChallengeSession"]>,
): GameApiClient {
  return {
    bootstrap: vi.fn(),
    onboard: vi.fn(),
    applyAction: vi.fn(),
    getPvpOpponents: vi.fn(async () => ({
      seasonId: "2026-09",
      opponents: [opponent],
      nextCursor: null,
    })),
    getPvpRanking: vi.fn(async () => ({
      seasonId: "2026-09",
      ranking: [],
      nextCursor: null,
    })),
    getPvpHistory: vi.fn(async () => ({
      seasonId: "2026-09",
      history: [],
      nextCursor: null,
    })),
    challengePvpTeam,
    commandPvpChallenge,
    getPvpChallengeSession,
  };
}

async function openPreparedPvpMatch(
  api: GameApiClient,
  snapshot: CloudGameSnapshot,
) {
  render(
    <GameApp
      api={api}
      auth={authClient()}
      session={session}
      snapshot={snapshot}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "試合" }));
  fireEvent.click(screen.getByRole("button", { name: "対人戦を開く" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "対戦する 白波高校" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "この編成・戦術で試合開始" }),
  );

  expect(
    await screen.findByRole("heading", { name: "試合ダイジェスト" }),
  ).toBeVisible();
  const advanceToDecision = screen.queryByRole("button", {
    name: "次の判断まで進む",
  });
  if (advanceToDecision) {
    fireEvent.click(advanceToDecision);
  }
  expect(await screen.findByRole("region", { name: "監督指示" })).toBeVisible();
}

describe("Phase16 GameApp PvP match commands", () => {
  it("opens the authoritative PvP segment in the match screen and sends commands through the PvP API", async () => {
    const snapshot = createSnapshot();
    const challengePvpTeam = vi.fn<
      NonNullable<GameApiClient["challengePvpTeam"]>
    >(async () => inProgress(snapshot));
    const commandPvpChallenge = vi.fn<
      NonNullable<GameApiClient["commandPvpChallenge"]>
    >(async () => inProgress(snapshot, 2));
    const api = baseApi(
      snapshot,
      challengePvpTeam,
      commandPvpChallenge,
      vi.fn(async () => inProgress(snapshot)),
    );

    await openPreparedPvpMatch(api, snapshot);
    expect(challengePvpTeam).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "このまま続ける" }));

    await waitFor(() => expect(commandPvpChallenge).toHaveBeenCalledTimes(1));
    expect(commandPvpChallenge.mock.calls[0]![1]).toMatchObject({
      operationId: "phase16-pvp-operation",
      commandId: expect.any(String),
      command: { type: "continue" },
    });
  });

  it("targets a public PvP opponent without receiving private ability data", async () => {
    const snapshot = createSnapshot();
    const challengePvpTeam = vi.fn<
      NonNullable<GameApiClient["challengePvpTeam"]>
    >(async () => inProgress(snapshot));
    const commandPvpChallenge = vi.fn<
      NonNullable<GameApiClient["commandPvpChallenge"]>
    >(async () => inProgress(snapshot, 2));
    const api = baseApi(
      snapshot,
      challengePvpTeam,
      commandPvpChallenge,
      vi.fn(async () => inProgress(snapshot)),
    );

    await openPreparedPvpMatch(api, snapshot);
    fireEvent.click(screen.getByRole("button", { name: "相手を狙う" }));

    expect(
      await screen.findByRole("button", {
        name: "サーブで狙う 白石 悠斗",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "ブロックで警戒 白石 悠斗",
      }),
    ).toBeVisible();
    expect(
      screen.queryByText(/総合|攻撃|レシーブ [SABCDEFG]/),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "サーブで狙う 白石 悠斗",
      }),
    );

    await waitFor(() => expect(commandPvpChallenge).toHaveBeenCalledTimes(1));
    expect(commandPvpChallenge.mock.calls[0]![1]).toMatchObject({
      operationId: "phase16-pvp-operation",
      command: {
        type: "target-serve-receiver",
        playerId: publicOpponentPlayers[0]!.id,
      },
    });
  });

  it("checks authoritative status after a network ambiguity and retries with the same command id only when unchanged", async () => {
    const snapshot = createSnapshot();
    const challengePvpTeam = vi.fn<
      NonNullable<GameApiClient["challengePvpTeam"]>
    >(async () => inProgress(snapshot));
    const commandPvpChallenge = vi
      .fn<NonNullable<GameApiClient["commandPvpChallenge"]>>()
      .mockRejectedValueOnce(
        new ApiError(null, "network_error", "connection interrupted"),
      )
      .mockResolvedValueOnce(inProgress(snapshot, 2));
    const getPvpChallengeSession = vi.fn<
      NonNullable<GameApiClient["getPvpChallengeSession"]>
    >(async () => inProgress(snapshot));
    const api = baseApi(
      snapshot,
      challengePvpTeam,
      commandPvpChallenge,
      getPvpChallengeSession,
    );

    await openPreparedPvpMatch(api, snapshot);
    fireEvent.click(screen.getByRole("button", { name: "このまま続ける" }));

    await waitFor(() => expect(commandPvpChallenge).toHaveBeenCalledTimes(2));
    expect(getPvpChallengeSession).toHaveBeenCalledTimes(1);
    expect(getPvpChallengeSession).toHaveBeenCalledWith(
      session.accessToken,
      "phase16-pvp-operation",
    );
    expect(commandPvpChallenge.mock.calls[1]![1].commandId).toBe(
      commandPvpChallenge.mock.calls[0]![1].commandId,
    );
    expect(commandPvpChallenge.mock.calls[1]![1].command).toEqual({
      type: "continue",
    });
  });
});
