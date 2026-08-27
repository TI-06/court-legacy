import { fireEvent, render, screen, within } from "@testing-library/react";
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
  userId: "user-1",
  email: "coach@example.com",
  accessToken: "token-1",
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

describe("GameApp cloud actions", () => {
  it("sends training to the authenticated game API and renders the server outcome", async () => {
    const snapshot = createSnapshot();
    let resolveAction: ((response: PersistedOperationResponse) => void) | null =
      null;
    const applyAction = vi.fn(
      (_accessToken: string, _request: GameActionRequest) =>
        new Promise<PersistedOperationResponse>((resolve) => {
          resolveAction = resolve;
        }),
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

    fireEvent.click(screen.getByRole("button", { name: "育成" }));
    fireEvent.click(screen.getByRole("button", { name: "練習を実行" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "練習内容を確認" })).getByRole(
        "button",
        { name: "この内容で実行" },
      ),
    );

    expect(applyAction).toHaveBeenCalledTimes(1);
    const [accessToken, request] = applyAction.mock.calls[0]!;
    expect(accessToken).toBe(session.accessToken);
    expect(request).toMatchObject({
      revision: 1,
      action: { type: "training" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("保存中…");

    resolveAction!(responseFor(snapshot, request));

    expect(
      await screen.findByRole("heading", { name: "今週の練習結果" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("保存済み ✓");
  });

  it("requests a practice match from the server and renders only its returned simulation", async () => {
    const snapshot = createSnapshot();
    const applyAction = vi.fn(
      async (_accessToken: string, request: GameActionRequest) =>
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

    fireEvent.click(screen.getByRole("button", { name: /練習試合へ/ }));
    fireEvent.click(screen.getByRole("button", { name: "試合開始" }));

    expect(applyAction).toHaveBeenCalledTimes(1);
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: { type: "practice-match" },
    });
    expect(
      await screen.findByRole("heading", { name: "試合ダイジェスト" }),
    ).toBeVisible();
  });
});
