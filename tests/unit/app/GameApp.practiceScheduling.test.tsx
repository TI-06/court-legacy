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
  userId: "user-1",
  email: "coach@example.com",
  accessToken: "token-1",
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
  return {
    userId: session.userId,
    schoolDbId: "school-db-1",
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

function otherSchools(snapshot: CloudGameSnapshot) {
  return Object.values(snapshot.state.schools).filter(
    (school) => school.id !== snapshot.state.userSchoolId,
  );
}

describe("GameApp practice scheduling", () => {
  it("accepts an incoming practice offer and keeps execution on Home progression", async () => {
    const snapshot = createSnapshot();
    const opponent = otherSchools(snapshot)[0]!;
    snapshot.state.weeklySchedule.practiceMatch = {
      incomingOffer: {
        schoolId: opponent.id,
        growthRating: 3,
        loadRating: 2,
      },
      outgoingCandidates: [],
      scheduledOpponentId: null,
      scheduledBy: null,
    };
    const { api, applyAction } = createApi(snapshot);

    render(
      <GameApp
        api={api}
        auth={authClient()}
        session={session}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "試合" }));

    expect(
      screen.getByRole("heading", { name: "練習試合の予定" }),
    ).toBeVisible();
    expect(screen.getByText(`${opponent.name}から申し込み`)).toBeVisible();
    expect(screen.queryByRole("button", { name: "試合開始" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "受ける" }));

    expect(applyAction).toHaveBeenCalledTimes(1);
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: { type: "practice-offer-accept" },
    });
    expect(await screen.findByText("対戦決定")).toBeVisible();
    expect(screen.getAllByText(opponent.name).length).toBeGreaterThan(0);
    expect(screen.getByText("ホームの「次の週へ進む」で実施")).toBeVisible();
    expect(screen.queryByRole("button", { name: "試合開始" })).toBeNull();
  });

  it("declines an incoming practice offer without scheduling a match", async () => {
    const snapshot = createSnapshot();
    const opponent = otherSchools(snapshot)[0]!;
    snapshot.state.weeklySchedule.practiceMatch = {
      incomingOffer: {
        schoolId: opponent.id,
        growthRating: 2,
        loadRating: 2,
      },
      outgoingCandidates: [],
      scheduledOpponentId: null,
      scheduledBy: null,
    };
    const { api, applyAction } = createApi(snapshot);

    render(
      <GameApp
        api={api}
        auth={authClient()}
        session={session}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "試合" }));
    fireEvent.click(screen.getByRole("button", { name: "断る" }));

    expect(applyAction).toHaveBeenCalledTimes(1);
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: { type: "practice-offer-decline" },
    });
    expect(
      await screen.findByText("今週届いている申し込みはありません"),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "試合開始" })).toBeNull();
  });

  it("requests a practice match only from a server-generated candidate", async () => {
    const snapshot = createSnapshot();
    const opponent = otherSchools(snapshot)[1] ?? otherSchools(snapshot)[0]!;
    snapshot.state.weeklySchedule.practiceMatch = {
      incomingOffer: null,
      outgoingCandidates: [
        {
          schoolId: opponent.id,
          tier: "same",
          acceptancePercent: 65,
          growthRating: 3,
          status: "available",
        },
      ],
      scheduledOpponentId: null,
      scheduledBy: null,
    };
    const { api, applyAction } = createApi(snapshot);

    render(
      <GameApp
        api={api}
        auth={authClient()}
        session={session}
        snapshot={snapshot}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "試合" }));
    fireEvent.click(
      screen.getByRole("button", { name: `${opponent.name}に申し込む` }),
    );

    expect(applyAction).toHaveBeenCalledTimes(1);
    expect(applyAction.mock.calls[0]![1]).toMatchObject({
      revision: 1,
      action: { type: "practice-request", schoolId: opponent.id },
    });
  });
});
