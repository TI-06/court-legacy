import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  userId: "user-player-hub-planning",
  email: "coach@example.com",
  accessToken: "token-player-hub-planning",
};

function createSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  state.teamPlanning.developmentPriorityPlayerIds = [];
  return {
    userId: session.userId,
    schoolDbId: "school-db-player-hub-planning",
    revision: 1,
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

describe("GameApp Player Hub planning", () => {
  it("persists development priorities through the authoritative game action and adopts the returned snapshot", async () => {
    let serverSnapshot = createSnapshot();
    const school = serverSnapshot.state.schools[serverSnapshot.state.userSchoolId]!;
    const player = serverSnapshot.state.players[school.playerIds[0]!]!;
    const playerName = `${player.lastName} ${player.firstName}`;

    const applyAction = vi.fn(
      async (_accessToken: string, request: GameActionRequest) => {
        const response = responseFor(serverSnapshot, request);
        serverSnapshot = response.game;
        return response;
      },
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
        snapshot={serverSnapshot}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "選手" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: `重点育成に追加 ${playerName}`,
      }),
    );

    await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(1));
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: {
        type: "set-development-priorities",
        playerIds: [player.id],
      },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("保存済み ✓");
    expect(
      await screen.findByRole("button", {
        name: `重点育成から外す ${playerName}`,
      }),
    ).toBeVisible();
  });
});
