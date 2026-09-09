import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { vi } from "vitest";
import { GameApp } from "../../../src/app/GameApp";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import { repositionTeamSelection } from "../../../src/domain/team/repositionTeamSelection";
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
  userId: "user-saved-lineups",
  email: "coach@example.com",
  accessToken: "token-saved-lineups",
};

function createSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: session.userId,
    schoolDbId: "school-db-saved-lineups",
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

function renderGame(snapshot: CloudGameSnapshot) {
  let serverSnapshot = snapshot;
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
      snapshot={snapshot}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "選手" }));
  fireEvent.click(screen.getByRole("button", { name: "編成" }));

  return { applyAction, getServerSnapshot: () => serverSnapshot };
}

describe("GameApp saved lineups", () => {
  it("saves a named preset through the authoritative game action and adopts the returned snapshot", async () => {
    const snapshot = createSnapshot();
    const expectedSelection = structuredClone(snapshot.teamSelection);
    const { applyAction } = renderGame(snapshot);
    const slot = screen.getByTestId("saved-lineup-slot-1");

    fireEvent.change(within(slot).getByLabelText("保存編成名 スロット1"), {
      target: { value: "速攻型" },
    });
    fireEvent.click(
      within(slot).getByRole("button", { name: "現在の編成を保存" }),
    );

    await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(1));
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: {
        type: "save-lineup-preset",
        slot: 1,
        name: "速攻型",
        selection: expectedSelection,
      },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("保存済み ✓");
    expect(within(slot).getByText("使用可能")).toBeVisible();
  });

  it("deletes a preset through the authoritative game action", async () => {
    const snapshot = createSnapshot();
    snapshot.state.teamPlanning.savedLineups = [
      {
        slot: 1,
        name: "通常",
        selection: structuredClone(snapshot.teamSelection),
      },
    ];
    const { applyAction } = renderGame(snapshot);
    const slot = screen.getByTestId("saved-lineup-slot-1");

    fireEvent.click(within(slot).getByRole("button", { name: "削除" }));

    await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(1));
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: {
        type: "delete-lineup-preset",
        slot: 1,
      },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("保存済み ✓");
    expect(within(slot).getByText("未保存")).toBeVisible();
  });

  it("applies a valid saved preset through the authoritative team-selection action", async () => {
    const snapshot = createSnapshot();
    const benchId = snapshot.teamSelection.benchPlayerIds[0]!;
    const savedSelection = repositionTeamSelection({
      selection: snapshot.teamSelection,
      source: { type: "bench", playerId: benchId },
      target: { type: "rotation", slot: 1 },
    });
    expect(savedSelection).not.toBeNull();
    snapshot.state.teamPlanning.savedLineups = [
      {
        slot: 1,
        name: "入替型",
        selection: structuredClone(savedSelection!),
      },
    ];
    const incomingPlayer = snapshot.state.players[benchId]!;
    const { applyAction } = renderGame(snapshot);
    const slot = screen.getByTestId("saved-lineup-slot-1");

    fireEvent.click(within(slot).getByRole("button", { name: "適用" }));

    await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(1));
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: {
        type: "team-selection",
        selection: savedSelection,
      },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("保存済み ✓");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "ローテーション1を変更" }),
      ).toHaveTextContent(incomingPlayer.lastName),
    );
  });
});
