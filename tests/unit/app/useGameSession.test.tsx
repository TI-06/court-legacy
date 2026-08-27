import { act, renderHook, waitFor } from "@testing-library/react";
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

  it("retries a network-ambiguous mutation with the exact same operation id and revision", async () => {
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

    expect(result.current.operation.status).toBe("offline");
    expect(recovery.write).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pendingOperation: expect.objectContaining({
          operationId: "op-keep",
          revision: 1,
        }),
      }),
    );

    act(() => {
      if (result.current.operation.status === "offline") {
        result.current.operation.retry();
      }
    });

    await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(2));
    expect(applyAction.mock.calls[0]?.[1]).toEqual(
      applyAction.mock.calls[1]?.[1],
    );
    await waitFor(() => expect(result.current.snapshot.revision).toBe(2));
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
