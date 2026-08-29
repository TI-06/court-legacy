import { fireEvent, render, screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { GameApp } from "../../../src/app/GameApp";
import { createDemoGame } from "../../../src/app/createDemoGame";
import { markWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import { advanceOfficialTournamentsThroughWeek } from "../../../src/domain/tournament/progressOfficialTournaments";
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
  userId: "user-official-ui",
  email: "official@example.com",
  accessToken: "official-token",
};

function authClient(): AuthClient {
  return {
    getSession: vi.fn().mockResolvedValue(session),
    subscribe: vi.fn().mockReturnValue(() => undefined),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
}

function createOfficialSnapshot(): CloudGameSnapshot {
  const initial = createDemoGame();
  let state = {
    ...initial,
    calendar: {
      ...initial.calendar,
      weekOfYear: 9,
    },
  };
  state = advanceOfficialTournamentsThroughWeek(state);
  state = markWeeklyActionCompleted(state, "training");

  return {
    userId: session.userId,
    schoolDbId: "school-db-official",
    revision: 9,
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

describe("GameApp official tournament flow", () => {
  it("opens the authoritative bracket from home and submits only the generic official-match action", async () => {
    let serverSnapshot = createOfficialSnapshot();
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

    fireEvent.click(screen.getByRole("button", { name: "大会表を見る" }));
    expect(
      screen.getByRole("heading", { name: "インターハイ 県大会" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "公式戦を開始" }));
    const dialog = screen.getByRole("dialog", { name: "公式戦を開始しますか" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "この試合を開始" }),
    );

    expect(applyAction).toHaveBeenCalledTimes(1);
    expect(applyAction.mock.calls[0]![0]).toBe(session.accessToken);
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 9,
      action: { type: "official-match" },
    });
    expect(applyAction.mock.calls[0]![1].action).toEqual({
      type: "official-match",
    });

    expect(
      await screen.findByRole("heading", { name: "インターハイ 県大会" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("保存済み ✓");
  });
});
