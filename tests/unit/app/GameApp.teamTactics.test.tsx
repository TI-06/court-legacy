import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
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
  userId: "user-team-tactics",
  email: "coach@example.com",
  accessToken: "token-team-tactics",
};

function createSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  school.tactics = {
    ...school.tactics,
    serveRisk: 25,
    attackTempo: "slow",
    blockSystem: "commit",
  };
  return {
    userId: session.userId,
    schoolDbId: "school-db-team-tactics",
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

it(
  "persists Player Hub tactics through set-team-tactics and adopts the authoritative snapshot",
  async () => {
    let serverSnapshot = createSnapshot();
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
    fireEvent.click(await screen.findByRole("button", { name: "戦術" }));

    fireEvent.click(
      within(screen.getByRole("group", { name: "サーブ戦術" })).getByRole(
        "button",
        { name: /強気/ },
      ),
    );
    fireEvent.click(
      within(screen.getByRole("group", { name: "攻撃戦術" })).getByRole(
        "button",
        { name: /高速/ },
      ),
    );
    fireEvent.click(
      within(screen.getByRole("group", { name: "ブロック戦術" })).getByRole(
        "button",
        { name: /リード/ },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "基本戦術を保存" }));

    await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(1));
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: {
        type: "set-team-tactics",
        plan: {
          serve: "aggressive",
          attack: "quick",
          block: "read",
        },
      },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("保存済み ✓");
    expect(
      within(screen.getByRole("group", { name: "サーブ戦術" })).getByRole(
        "button",
        { name: /強気/, pressed: true },
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole("group", { name: "攻撃戦術" })).getByRole(
        "button",
        { name: /高速/, pressed: true },
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole("group", { name: "ブロック戦術" })).getByRole(
        "button",
        { name: /リード/, pressed: true },
      ),
    ).toBeVisible();
  },
);
