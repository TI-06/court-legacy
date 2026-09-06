import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
    seed: `conflict-classification-${revision}`,
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

function recoveryCache(): RecoveryCachePort {
  return {
    read: vi.fn().mockResolvedValue(null),
    write: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

describe("useGameSession conflict classification", () => {
  it("shows the server rule message without reloading the snapshot for a non-revision 409", async () => {
    const snapshot = createSnapshot(182);
    const bootstrap = vi
      .fn()
      .mockResolvedValue({ status: "ready", game: snapshot });
    const applyAction = vi
      .fn()
      .mockRejectedValue(
        new ApiError(
          409,
          "invalid_training_plan",
          "個別練習に在籍していない選手が含まれています",
        ),
      );
    const api: GameApiClient = {
      bootstrap,
      onboard: vi.fn(),
      applyAction,
    };
    const { result } = renderHook(() =>
      useGameSession({
        accessToken: "token",
        initialSnapshot: snapshot,
        api,
        recoveryCache: recoveryCache(),
        createOperationId: () => "op-invalid-plan",
      }),
    );

    await act(async () => {
      await result.current.runAction({ type: "advance-week" }, "週進行を保存");
    });

    expect(bootstrap).not.toHaveBeenCalled();
    expect(result.current.operation).toMatchObject({
      status: "error",
      label: "個別練習に在籍していない選手が含まれています",
    });
  });
});
