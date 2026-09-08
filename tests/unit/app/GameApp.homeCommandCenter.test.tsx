import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { GameApp } from "../../../src/app/GameApp";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type { GameApiClient } from "../../../src/services/api/GameApiClient";
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
  userId: "phase13-home-user",
  email: "phase13@example.com",
  accessToken: "phase13-token",
};

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

function createSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  state.weeklySchedule.practiceMatch.incomingOffer = null;
  return {
    userId: session.userId,
    schoolDbId: "phase13-school-db",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
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

function createApi(snapshot: CloudGameSnapshot) {
  const applyAction = vi.fn(
    async (_accessToken: string, request: GameActionRequest) =>
      responseFor(snapshot, request),
  );
  const api: GameApiClient = {
    bootstrap: vi.fn(),
    onboard: vi.fn(),
    applyAction,
  };
  return { api, applyAction };
}

function renderApp(snapshot: CloudGameSnapshot) {
  const { api, applyAction } = createApi(snapshot);
  render(
    <GameApp
      api={api}
      auth={authClient()}
      session={session}
      snapshot={snapshot}
    />,
  );
  return { applyAction };
}

describe("GameApp Phase 13 Home commands", () => {
  it("opens the concerned player directly and ordinary Team navigation resets the focus", () => {
    const snapshot = createSnapshot();
    const playerId =
      snapshot.state.schools[snapshot.state.userSchoolId]!.playerIds[0]!;
    const player = snapshot.state.players[playerId]!;
    snapshot.state.teamDynamics.playerConcerns[playerId] = [
      { code: "playing-time", severity: 3 },
    ];

    renderApp(snapshot);

    fireEvent.click(screen.getByRole("button", { name: "選手から相談 確認" }));
    expect(
      screen.getByRole("heading", {
        name: `${player.lastName} ${player.firstName}`,
      }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    fireEvent.click(screen.getByRole("button", { name: "選手" }));
    expect(screen.getByRole("heading", { name: "選手一覧" })).toBeVisible();
  });

  it("routes facility and staff Home tasks to the requested School views", () => {
    const snapshot = createSnapshot();
    renderApp(snapshot);

    fireEvent.click(
      screen.getByRole("button", {
        name: /強化可能な設備 \d+件 設備を見る/,
      }),
    );
    expect(screen.getByRole("heading", { name: "設備を強化" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "年間コーチ未契約 スタッフを見る",
      }),
    );
    expect(screen.getByRole("heading", { name: "スタッフ" })).toBeVisible();
  });

  it("does not send advance-week until an unanswered offer warning is confirmed", () => {
    const snapshot = createSnapshot();
    const opponent = Object.values(snapshot.state.schools).find(
      (school) => school.id !== snapshot.state.userSchoolId,
    )!;
    snapshot.state.weeklySchedule.practiceMatch.incomingOffer = {
      schoolId: opponent.id,
      growthRating: 4,
      loadRating: 2,
    };
    const { applyAction } = renderApp(snapshot);

    fireEvent.click(screen.getByRole("button", { name: "今週を進める" }));
    expect(applyAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "そのまま進む" }));
    expect(applyAction).toHaveBeenCalledTimes(1);
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: { type: "advance-week" },
    });
  });
});
