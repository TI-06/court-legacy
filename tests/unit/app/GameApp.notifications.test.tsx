import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { GameApp } from "../../../src/app/GameApp";
import { createDemoGame } from "../../../src/app/createDemoGame";
import type { TrainingResultNotification } from "../../../src/domain/notifications/gameNotifications";
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
  userId: "user-notifications",
  email: "coach@example.com",
  accessToken: "token-notifications",
};

function createSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: session.userId,
    schoolDbId: "school-db-notifications",
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

function notificationFor(snapshot: CloudGameSnapshot): TrainingResultNotification {
  return {
    id: "training-result:home-read-flow",
    type: "training-result",
    createdGameDate: snapshot.state.date,
    academicYearIndex: snapshot.state.yearIndex,
    weekOfYear: snapshot.state.calendar.weekOfYear,
    readAtGameDate: null,
    payload: {
      teamTrainingMenuName: "スパイク練習",
      totalAbilityGrowth: 6,
      totalFatigueChange: 10,
      injuredCount: 0,
      players: [],
    },
  };
}

describe("GameApp notifications", () => {
  it("marks a home training notification read through the authoritative game action", async () => {
    let serverSnapshot = createSnapshot();
    const notification = notificationFor(serverSnapshot);
    serverSnapshot.state.notifications.items = [notification];

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

    fireEvent.click(
      screen.getByRole("button", { name: /今週の練習結果/ }),
    );

    expect(
      screen.getByRole("dialog", { name: "今週の練習結果" }),
    ).toBeVisible();
    expect(applyAction).toHaveBeenCalledTimes(1);
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: {
        type: "mark-notification-read",
        notificationId: notification.id,
      },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("保存済み ✓");
  });
});
