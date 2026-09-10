import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameApp } from "../../../src/app/GameApp";
import { createInitialGame } from "../../../src/app/createInitialGame";
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
  userId: "phase16-browser-user",
  email: "coach@example.com",
  accessToken: "phase16-browser-token",
};

function createSnapshot(): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "phase16-practice-start",
    schoolName: "青葉高校",
    schoolShortName: "青葉",
    coachName: "高橋 監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });
  const opponent = Object.values(state.schools).find(
    (school) => school.id !== state.userSchoolId,
  );
  if (!opponent) throw new Error("practice opponent fixture missing");
  state.weeklySchedule.practiceMatch.incomingOffer = null;
  state.weeklySchedule.practiceMatch.scheduledOpponentId = opponent.id;
  state.weeklySchedule.practiceMatch.scheduledBy = "outgoing";

  return {
    userId: session.userId,
    schoolDbId: "00000000-0000-4000-8000-000000000001",
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

describe("Phase16 GameApp match command authority", () => {
  it("sends the coach command to the game API and adopts only the returned match segment", async () => {
    let serverSnapshot = createSnapshot();
    const applyAction = vi.fn<GameApiClient["applyAction"]>(
      async (_accessToken, request) => {
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

    fireEvent.click(screen.getByRole("button", { name: "今週を進める" }));
    fireEvent.click(
      screen.getByRole("button", { name: "この編成・戦術で試合開始" }),
    );

    expect(
      await screen.findByRole("heading", { name: "試合ダイジェスト" }),
    ).toBeVisible();
    expect(applyAction).toHaveBeenCalledTimes(1);
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: { type: "advance-week" },
    });

    fireEvent.click(screen.getByRole("button", { name: "次の判断まで進む" }));
    expect(
      await screen.findByRole("region", { name: "監督指示" }),
    ).toBeVisible();
    const beforeCommandSequence = screen.getByTestId("event-sequence").textContent;

    fireEvent.click(screen.getByRole("button", { name: /^このまま/ }));

    await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(2));
    expect(applyAction.mock.calls[1]![1]).toMatchObject({
      revision: 2,
      action: {
        type: "match-command",
        command: { type: "continue" },
      },
    });
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "監督指示" })).toBeNull();
      expect(screen.getByTestId("event-sequence").textContent).not.toBe(
        beforeCommandSequence,
      );
    });
  });
});
