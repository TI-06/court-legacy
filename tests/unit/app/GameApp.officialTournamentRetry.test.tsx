import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { GameApp } from "../../../src/app/GameApp";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { markWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import { advanceOfficialTournamentsThroughWeek } from "../../../src/domain/tournament/progressOfficialTournaments";
import {
  ApiError,
  type GameApiClient,
} from "../../../src/services/api/GameApiClient";
import type {
  AuthClient,
  AuthSession,
} from "../../../src/services/auth/AuthClient";
import type {
  CloudGameSnapshot,
  PersistedOperationResponse,
} from "../../../worker/data/GameStore";
import type { GameActionRequest } from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";

const session: AuthSession = {
  userId: "user-1",
  email: "coach@example.com",
  accessToken: "token-1",
};

function createOfficialSnapshot(): CloudGameSnapshot {
  const initial = createDemoGame();
  let state = advanceOfficialTournamentsThroughWeek({
    ...initial,
    calendar: {
      ...initial.calendar,
      weekOfYear: 9,
    },
  });
  state = markWeeklyActionCompleted(state, "training");

  return {
    userId: session.userId,
    schoolDbId: "school-db-1",
    revision: 9,
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

function responseFor(
  snapshot: CloudGameSnapshot,
  request: GameActionRequest,
): PersistedOperationResponse {
  const applied = applyGameAction(snapshot, request.action);
  return {
    game: {
      ...snapshot,
      revision: snapshot.revision + 1,
      state: applied.state,
      teamSelection: applied.teamSelection,
    },
    operationId: request.operationId,
    outcome: applied.outcome,
  };
}

describe("GameApp official tournament retry", () => {
  it("retries an ambiguous Home progression request with the exact same operation id", async () => {
    const snapshot = createOfficialSnapshot();
    const applyAction = vi
      .fn<GameApiClient["applyAction"]>()
      .mockRejectedValueOnce(
        new ApiError(null, "network_error", "サーバーに接続できませんでした"),
      )
      .mockImplementationOnce(async (_accessToken, request) =>
        responseFor(snapshot, request),
      );
    const api: GameApiClient = {
      bootstrap: vi.fn(),
      onboard: vi.fn(),
      applyAction,
    };

    render(
      <GameApp
        api={api}
        auth={authClient()}
        session={session}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "次の週へ進む" }));

    expect(await screen.findByText("オフライン")).toBeVisible();
    expect(applyAction).toHaveBeenCalledTimes(1);
    const firstRequest = applyAction.mock.calls[0]![1];
    expect(firstRequest).toMatchObject({
      revision: 9,
      action: { type: "advance-week" },
    });

    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(await screen.findByText("保存済み ✓")).toBeVisible();
    expect(applyAction).toHaveBeenCalledTimes(2);
    expect(applyAction.mock.calls[1]![1]).toEqual(firstRequest);
    expect(firstRequest.operationId).toBe(
      applyAction.mock.calls[1]![1].operationId,
    );
  });
});
