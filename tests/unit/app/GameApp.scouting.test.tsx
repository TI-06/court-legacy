import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { GameApp } from "../../../src/app/GameApp";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { playerId } from "../../../src/domain/model/identifiers";
import type { ScoutReport } from "../../../src/domain/scouting/scoutReport";
import {
  ApiError,
  type GameApiClient,
  type ScoutingRecruitmentResponse,
} from "../../../src/services/api/GameApiClient";
import type {
  AuthClient,
  AuthSession,
} from "../../../src/services/auth/AuthClient";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";

const session: AuthSession = {
  userId: "user-1",
  email: "coach@example.com",
  accessToken: "token-1",
};

const candidateId = playerId("candidate-a");
const report: ScoutReport = {
  candidateId,
  displayName: "青木 蓮",
  heightCm: 188,
  position: "OH",
  handedness: "right",
  middleSchoolAchievement: "prefectural-selection",
  evaluationStars: 4,
  estimatedOverall: { min: 58, max: 72 },
  estimatedPotential: { min: 72, max: 89 },
  confidence: "medium",
  comments: ["攻撃力に目を引くものがある", "高さは武器になりそう"],
};

function createSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: session.userId,
    schoolDbId: "school-db-1",
    revision: 1,
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

function recruitedResponse(
  snapshot: CloudGameSnapshot,
): ScoutingRecruitmentResponse {
  const cycleKey = `${snapshot.state.userSchoolId}:year-${snapshot.state.yearIndex}`;
  return {
    operationId: "recruit-server-1",
    game: {
      ...snapshot,
      revision: snapshot.revision + 1,
      state: {
        ...snapshot.state,
        recruiting: {
          cycleKey,
          committedCandidateIds: [candidateId],
        },
      },
    },
    outcome: {
      candidateId,
      committedCandidateIds: [candidateId],
      cycleKey,
    },
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
  return snapshot;
}

function openScouting() {
  fireEvent.click(screen.getByRole("button", { name: "学校" }));
  fireEvent.click(screen.getByRole("tab", { name: "スカウト" }));
}

describe("GameApp scouting flow", () => {
  it("loads public reports and adopts the authoritative recruitment snapshot", async () => {
    const snapshot = createSnapshot();
    const getScoutingBoard = vi.fn<
      NonNullable<GameApiClient["getScoutingBoard"]>
    >(async (_accessToken, request) => ({
      operationId: request.operationId,
      revision: request.revision,
      cycleKey: `${snapshot.state.userSchoolId}:year-${snapshot.state.yearIndex}`,
      reports: [report],
    }));
    const commitRecruit = vi.fn<NonNullable<GameApiClient["commitRecruit"]>>(
      async () => recruitedResponse(snapshot),
    );
    const api: GameApiClient = {
      bootstrap: vi.fn(),
      onboard: vi.fn(),
      applyAction: vi.fn(),
      getScoutingBoard,
      commitRecruit,
    };

    renderApp(api, snapshot);
    openScouting();

    await waitFor(() => expect(getScoutingBoard).toHaveBeenCalledTimes(1));
    expect(getScoutingBoard.mock.calls[0]![0]).toBe(session.accessToken);
    expect(getScoutingBoard.mock.calls[0]![1]).toMatchObject({ revision: 1 });
    expect(await screen.findByText("青木 蓮")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "獲得候補にする 青木 蓮" }),
    );

    await waitFor(() => expect(commitRecruit).toHaveBeenCalledTimes(1));
    expect(commitRecruit.mock.calls[0]![0]).toBe(session.accessToken);
    expect(commitRecruit.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      candidateId,
    });
    expect(
      await screen.findByRole("button", { name: "獲得済み 青木 蓮" }),
    ).toBeDisabled();
  });

  it("shows board API errors and retries the board request", async () => {
    const snapshot = createSnapshot();
    const getScoutingBoard = vi
      .fn<NonNullable<GameApiClient["getScoutingBoard"]>>()
      .mockRejectedValueOnce(
        new ApiError(503, "scouting_unavailable", "候補を読み込めませんでした"),
      )
      .mockResolvedValueOnce({
        operationId: "board-2",
        revision: snapshot.revision,
        cycleKey: `${snapshot.state.userSchoolId}:year-${snapshot.state.yearIndex}`,
        reports: [report],
      });
    const api: GameApiClient = {
      bootstrap: vi.fn(),
      onboard: vi.fn(),
      applyAction: vi.fn(),
      getScoutingBoard,
      commitRecruit: vi.fn(),
    };

    renderApp(api, snapshot);
    openScouting();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "候補を読み込めませんでした",
    );
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(await screen.findByText("青木 蓮")).toBeVisible();
    expect(getScoutingBoard).toHaveBeenCalledTimes(2);
  });

  it("shows recruitment API errors and retries the same candidate", async () => {
    const snapshot = createSnapshot();
    const getScoutingBoard = vi.fn<
      NonNullable<GameApiClient["getScoutingBoard"]>
    >(async (_accessToken, request) => ({
      operationId: request.operationId,
      revision: request.revision,
      cycleKey: `${snapshot.state.userSchoolId}:year-${snapshot.state.yearIndex}`,
      reports: [report],
    }));
    const commitRecruit = vi
      .fn<NonNullable<GameApiClient["commitRecruit"]>>()
      .mockRejectedValueOnce(
        new ApiError(500, "recruit_failed", "獲得処理に失敗しました"),
      )
      .mockResolvedValueOnce(recruitedResponse(snapshot));
    const api: GameApiClient = {
      bootstrap: vi.fn(),
      onboard: vi.fn(),
      applyAction: vi.fn(),
      getScoutingBoard,
      commitRecruit,
    };

    renderApp(api, snapshot);
    openScouting();
    await screen.findByText("青木 蓮");
    fireEvent.click(
      screen.getByRole("button", { name: "獲得候補にする 青木 蓮" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "獲得処理に失敗しました",
    );
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(
      await screen.findByRole("button", { name: "獲得済み 青木 蓮" }),
    ).toBeDisabled();
    expect(commitRecruit).toHaveBeenCalledTimes(2);
    expect(commitRecruit.mock.calls[1]![1]).toMatchObject({ candidateId });
  });

  it("refreshes the authoritative snapshot and scouting board after a recruitment conflict", async () => {
    const snapshot = createSnapshot();
    const latestSnapshot: CloudGameSnapshot = {
      ...snapshot,
      revision: 2,
    };
    const getScoutingBoard = vi.fn<
      NonNullable<GameApiClient["getScoutingBoard"]>
    >(async (_accessToken, request) => ({
      operationId: request.operationId,
      revision: request.revision,
      cycleKey: `${snapshot.state.userSchoolId}:year-${snapshot.state.yearIndex}`,
      reports: [report],
    }));
    const bootstrap = vi.fn<GameApiClient["bootstrap"]>(async () => ({
      status: "ready",
      game: latestSnapshot,
    }));
    const commitRecruit = vi
      .fn<NonNullable<GameApiClient["commitRecruit"]>>()
      .mockRejectedValueOnce(
        new ApiError(409, "revision_conflict", "別端末で更新されています"),
      );
    const api: GameApiClient = {
      bootstrap,
      onboard: vi.fn(),
      applyAction: vi.fn(),
      getScoutingBoard,
      commitRecruit,
    };

    renderApp(api, snapshot);
    openScouting();
    await screen.findByText("青木 蓮");
    fireEvent.click(
      screen.getByRole("button", { name: "獲得候補にする 青木 蓮" }),
    );

    await waitFor(() => expect(bootstrap).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getScoutingBoard).toHaveBeenCalledTimes(2));
    expect(getScoutingBoard.mock.calls[1]![1]).toMatchObject({ revision: 2 });
    expect(screen.getByText("青木 蓮")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "獲得候補にする 青木 蓮" }),
    ).toBeEnabled();
  });
});
