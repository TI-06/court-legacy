import { act, renderHook } from "@testing-library/react";
import { vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { useGameSession } from "../../../src/app/useGameSession";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { RecoveryCachePort } from "../../../src/persistence/RecoveryCache";
import {
  ApiError,
  type GameApiClient,
} from "../../../src/services/api/GameApiClient";

function createSnapshot(revision: number) {
  const state = createInitialGame({
    seed: `session-${revision}`,
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高城 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
  return {
    userId: "user-1",
    schoolDbId: "school-1",
    revision,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function cache(): RecoveryCachePort {
  return {
    read: vi.fn().mockResolvedValue(null),
    write: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

function api(overrides: Partial<GameApiClient>): GameApiClient {
  return {
    bootstrap: vi.fn(),
    onboard: vi.fn(),
    applyAction: vi.fn(),
    ...overrides,
  };
}

describe("useGameSession", () => {
  it("sets submitting before awaiting the server and replaces the snapshot on success", async () => {
    const response =
      deferred<Awaited<ReturnType<GameApiClient["applyAction"]>>>();
    const recovery = cache();
    const gameApi = api({ applyAction: vi.fn(() => response.promise) });
    const initialSnapshot = createSnapshot(1);
    const nextSnapshot = createSnapshot(2);
    const { result } = renderHook(() =>
      useGameSession({
        accessToken: "token",
        initialSnapshot,
        api: gameApi,
        recoveryCache: recovery,
        createOperationId: () => "op-1",
      }),
    );

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.runAction(
        { type: "facility-upgrade", facility: "trainingRoom" },
        "設備を保存",
      );
    });

    expect(result.current.operation).toEqual({
      status: "submitting",
      label: "設備を保存",
      operationId: "op-1",
      blocking: false,
    });
    expect(gameApi.applyAction).toHaveBeenCalledWith("token", {
      operationId: "op-1",
      revision: 1,
      action: { type: "facility-upgrade", facility: "trainingRoom" },
    });

    await act(async () => {
      response.resolve({ game: nextSnapshot, operationId: "op-1" });
      await pending;
    });

    expect(result.current.snapshot.revision).toBe(2);
    expect(result.current.operation).toEqual({
      status: "success",
      label: "設備を保存",
    });
    expect(recovery.write).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userId: "user-1",
        snapshot: nextSnapshot,
        pendingOperation: null,
      }),
    );
  });

  it("does not send a second mutation while another authoritative mutation is pending", async () => {
    const response =
      deferred<Awaited<ReturnType<GameApiClient["applyAction"]>>>();
    const applyAction = vi.fn(() => response.promise);
    const { result } = renderHook(() =>
      useGameSession({
        accessToken: "token",
        initialSnapshot: createSnapshot(1),
        api: api({ applyAction }),
        recoveryCache: cache(),
        createOperationId: () => "op-pending",
      }),
    );

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.runAction(
        {
          type: "team-selection",
          selection: result.current.snapshot.teamSelection,
        },
        "編成を保存",
      );
      second = result.current.runAction(
        { type: "facility-upgrade", facility: "gym" },
        "設備を保存",
      );
    });

    expect(applyAction).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBeNull();

    await act(async () => {
      response.resolve({ game: createSnapshot(2), operationId: "op-pending" });
      await first;
    });
  });

  it("automatically retries one network-ambiguous mutation with the exact same operation id and revision", async () => {
    const recovery = cache();
    const nextSnapshot = createSnapshot(2);
    const applyAction = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(null, "network_error", "サーバーに接続できませんでした"),
      )
      .mockResolvedValueOnce({ game: nextSnapshot, operationId: "op-keep" });
    const { result } = renderHook(() =>
      useGameSession({
        accessToken: "token",
        initialSnapshot: createSnapshot(1),
        api: api({ applyAction }),
        recoveryCache: recovery,
        createOperationId: () => "op-keep",
      }),
    );

    await act(async () => {
      await result.current.runAction({ type: "advance-week" }, "週進行を保存");
    });

    expect(applyAction).toHaveBeenCalledTimes(2);
    expect(applyAction.mock.calls[0]?.[1]).toEqual(
      applyAction.mock.calls[1]?.[1],
    );
    expect(result.current.snapshot.revision).toBe(2);
    expect(result.current.operation).toEqual({
      status: "success",
      label: "週進行を保存",
    });
    expect(recovery.write).toHaveBeenLastCalledWith(
      expect.objectContaining({
        snapshot: nextSnapshot,
        pendingOperation: null,
      }),
    );
  });

  it("shows a retry action only after the automatic server-error retry also fails", async () => {
    const recovery = cache();
    const applyAction = vi
      .fn()
      .mockRejectedValue(
        new ApiError(500, "server_error", "サーバー処理に失敗しました"),
      );
    const { result } = renderHook(() =>
      useGameSession({
        accessToken: "token",
        initialSnapshot: createSnapshot(1),
        api: api({ applyAction }),
        recoveryCache: recovery,
        createOperationId: () => "op-server-error",
      }),
    );

    await act(async () => {
      await result.current.runAction({ type: "advance-week" }, "週進行を保存");
    });

    expect(applyAction).toHaveBeenCalledTimes(2);
    expect(applyAction.mock.calls[0]?.[1]).toEqual(
      applyAction.mock.calls[1]?.[1],
    );
    expect(result.current.operation).toMatchObject({
      status: "error",
      label: "保存に失敗しました",
    });
    expect(recovery.write).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pendingOperation: expect.objectContaining({
          operationId: "op-server-error",
          revision: 1,
        }),
      }),
    );
  });

  it("refreshes an expired save token once and retries the exact same mutation", async () => {
    const nextSnapshot = createSnapshot(2);
    const refreshAccessToken = vi.fn().mockResolvedValue("fresh-token");
    const applyAction = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(401, "unauthorized", "認証の有効期限が切れています"),
      )
      .mockResolvedValueOnce({
        game: nextSnapshot,
        operationId: "op-auth-refresh",
      });

    const { result } = renderHook(() =>
      useGameSession({
        accessToken: "stale-token",
        refreshAccessToken,
        initialSnapshot: createSnapshot(1),
        api: api({ applyAction }),
        recoveryCache: cache(),
        createOperationId: () => "op-auth-refresh",
      }),
    );

    await act(async () => {
      await result.current.runAction({ type: "advance-week" }, "週進行を保存");
    });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(applyAction).toHaveBeenCalledTimes(2);
    expect(applyAction.mock.calls[0]?.[0]).toBe("stale-token");
    expect(applyAction.mock.calls[1]?.[0]).toBe("fresh-token");
    expect(applyAction.mock.calls[0]?.[1]).toEqual(
      applyAction.mock.calls[1]?.[1],
    );
    expect(result.current.snapshot.revision).toBe(2);
    expect(result.current.operation).toEqual({
      status: "success",
      label: "週進行を保存",
    });
  });

  it("resyncs the authoritative snapshot after repeated ambiguous save failures", async () => {
    const recovery = cache();
    const latestSnapshot = createSnapshot(2);
    const applyAction = vi
      .fn()
      .mockRejectedValue(
        new ApiError(500, "server_error", "サーバー処理に失敗しました"),
      );
    const bootstrap = vi.fn().mockResolvedValue({
      status: "ready",
      game: latestSnapshot,
    });

    const { result } = renderHook(() =>
      useGameSession({
        accessToken: "token",
        initialSnapshot: createSnapshot(1),
        api: api({ applyAction, bootstrap }),
        recoveryCache: recovery,
        createOperationId: () => "op-recover",
      }),
    );

    await act(async () => {
      await result.current.runAction({ type: "advance-week" }, "週進行を保存");
    });

    expect(applyAction).toHaveBeenCalledTimes(2);
    expect(applyAction.mock.calls[0]?.[1]).toEqual(
      applyAction.mock.calls[1]?.[1],
    );
    expect(bootstrap).toHaveBeenCalledWith("token");
    expect(result.current.snapshot.revision).toBe(2);
    expect(result.current.operation).toEqual({
      status: "success",
      label: "最新の保存状態へ復旧しました",
    });
    expect(recovery.write).toHaveBeenLastCalledWith(
      expect.objectContaining({
        snapshot: latestSnapshot,
        pendingOperation: null,
      }),
    );
  });

  it("reloads the authoritative cloud snapshot after a revision conflict", async () => {
    const latestSnapshot = createSnapshot(4);
    const gameApi = api({
      applyAction: vi
        .fn()
        .mockRejectedValue(
          new ApiError(409, "revision_conflict", "他の端末で更新されています"),
        ),
      bootstrap: vi
        .fn()
        .mockResolvedValue({ status: "ready", game: latestSnapshot }),
    });
    const recovery = cache();
    const { result } = renderHook(() =>
      useGameSession({
        accessToken: "token",
        initialSnapshot: createSnapshot(3),
        api: gameApi,
        recoveryCache: recovery,
        createOperationId: () => "op-conflict",
      }),
    );

    await act(async () => {
      await result.current.runAction(
        { type: "facility-upgrade", facility: "gym" },
        "設備を保存",
      );
    });

    expect(gameApi.bootstrap).toHaveBeenCalledWith("token");
    expect(result.current.snapshot.revision).toBe(4);
    expect(result.current.operation.status).toBe("error");
    expect(recovery.write).toHaveBeenLastCalledWith(
      expect.objectContaining({
        snapshot: latestSnapshot,
        pendingOperation: null,
      }),
    );
  });
});
