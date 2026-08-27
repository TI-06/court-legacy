import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { GameApp } from "../../../src/app/GameApp";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { eventId } from "../../../src/domain/model/identifiers";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
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

  it("persists a facility upgrade through the server before showing the new funds and level", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.click(screen.getByRole("button", { name: "学校管理" }));
    fireEvent.click(
      screen.getByRole("button", { name: "トレーニング設備を強化" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "設備を強化" })).getByRole(
        "button",
        { name: "70を使って強化" },
      ),
    );

    expect(applyAction).toHaveBeenCalledTimes(1);
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: { type: "facility-upgrade", facility: "trainingRoom" },
    });
    expect(await screen.findByText("資金 230")).toBeVisible();
  });

  it("advances the week on the server using the revision returned by training", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "育成" }));
    fireEvent.click(screen.getByRole("button", { name: "練習を実行" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "練習内容を確認" })).getByRole(
        "button",
        { name: "この内容で実行" },
      ),
    );
    await screen.findByRole("heading", { name: "今週の練習結果" });

    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    fireEvent.click(screen.getByRole("button", { name: "次の週へ進む" }));

    expect(applyAction).toHaveBeenCalledTimes(2);
    expect(applyAction.mock.calls[1]![1]).toMatchObject({
      revision: 2,
      action: { type: "advance-week" },
    });
    expect(await screen.findAllByText("2026年4月8日")).not.toHaveLength(0);
  });

  it("persists an event choice through the server before closing the event", async () => {
    const snapshot = createSnapshot();
    const playerId = snapshot.state.schools[snapshot.state.userSchoolId]!.playerIds[0]!;
    snapshot.state.pendingEvent = {
      eventId: eventId("event.first-position-request"),
      actorPlayerIds: [playerId],
      targetSchoolId: null,
      surfacedDate: snapshot.state.date,
      choiceIds: ["try", "stay"],
      chainId: null,
      chainStage: null,
    };
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

    const dialog = screen.getByRole("dialog", { name: "希望ポジション" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /適性を確認する/ }),
    );

    expect(applyAction).toHaveBeenCalledTimes(1);
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: { type: "event-choice", choiceId: "try" },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("保存済み ✓");
    expect(
      screen.queryByRole("dialog", { name: "希望ポジション" }),
    ).toBeNull();
  });

  it("persists team selection changes through the server before adopting them", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "選手" }));
    fireEvent.click(screen.getByRole("button", { name: "編成" }));
    const starterLock = screen.getAllByRole("button", {
      name: /^先発固定 /,
    })[0]!;
    fireEvent.click(starterLock);

    expect(applyAction).toHaveBeenCalledTimes(1);
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: { type: "team-selection" },
    });
    expect(
      applyAction.mock.calls[0]![1].action.type === "team-selection"
        ? applyAction.mock.calls[0]![1].action.selection.substitutionPolicy
            .starterLockPlayerIds
        : [],
    ).toHaveLength(1);
    expect(await screen.findByRole("status")).toHaveTextContent("保存済み ✓");
  });

  it("renders the refreshed cloud snapshot after a revision conflict", async () => {
    const snapshot = createSnapshot();
    const refreshed = createSnapshot();
    refreshed.revision = 7;
    refreshed.state.schools[refreshed.state.userSchoolId]!.funds = 777;
    const api: GameApiClient = {
      bootstrap: vi.fn().mockResolvedValue({ status: "ready", game: refreshed }),
      onboard: vi.fn(),
      applyAction: vi
        .fn()
        .mockRejectedValue(
          new ApiError(409, "revision_conflict", "データが更新されています"),
        ),
    };

    render(
      <GameApp
        api={api}
        auth={authClient()}
        session={session}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.click(screen.getByRole("button", { name: "学校管理" }));
    expect(screen.getByText("資金 300")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "トレーニング設備を強化" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "設備を強化" })).getByRole(
        "button",
        { name: "70を使って強化" },
      ),
    );

    expect(await screen.findByText("資金 777")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "他の端末の更新を読み込みました。もう一度実行してください",
    );
  });
});
