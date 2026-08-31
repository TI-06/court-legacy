import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import type { TrainingResultNotification } from "../../../src/domain/notifications/gameNotifications";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type {
  CloudGameSnapshot,
  GameStore,
  PersistOperationInput,
  PersistOperationResult,
} from "../../../worker/data/GameStore";
import { RevisionConflictError } from "../../../worker/data/GameStore";
import { createGameActionHandler } from "../../../worker/routes/gameAction";

function createSnapshot(revision = 4): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "route-action-fixture",
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

  return {
    userId: "user-123",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function trainingNotification(
  snapshot: CloudGameSnapshot,
): TrainingResultNotification {
  const state = snapshot.state;
  return {
    id: `training-result:${state.userSchoolId}:${state.yearIndex}:${state.calendar.weekOfYear}:${state.date}`,
    type: "training-result",
    createdGameDate: state.date,
    academicYearIndex: state.yearIndex,
    weekOfYear: state.calendar.weekOfYear,
    readAtGameDate: null,
    payload: {
      teamTrainingMenuName: "スパイク練習",
      totalAbilityGrowth: 4,
      totalFatigueChange: 8,
      injuredCount: 0,
      players: [],
    },
  };
}

function actionRequest(body: unknown): Request {
  return new Request("https://court-legacy.test/api/game/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createStore(snapshot: CloudGameSnapshot): GameStore {
  return {
    getSnapshot: vi.fn(async (userId) =>
      userId === snapshot.userId ? snapshot : null,
    ),
    getOperationResponse: vi.fn(async () => null),
    createGame: vi.fn(async () => {
      throw new Error("not used");
    }),
    applyOperation: vi.fn(
      async (
        input: PersistOperationInput,
      ): Promise<PersistOperationResult> => ({
        response: input.response,
        replayed: false,
      }),
    ),
  };
}

const operation = {
  operationId: "operation-001",
  revision: 4,
};

describe("game action route", () => {
  it("persists a legal action at exactly the next revision", async () => {
    const snapshot = createSnapshot();
    const store = createStore(snapshot);
    const handler = createGameActionHandler(store);

    const response = await handler(
      actionRequest({
        ...operation,
        action: {
          type: "team-selection",
          selection: snapshot.teamSelection,
        },
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    expect(store.applyOperation).toHaveBeenCalledTimes(1);
    const [persisted] = vi.mocked(store.applyOperation).mock.calls[0]!;
    expect(persisted.userId).toBe("user-123");
    expect(persisted.expectedRevision).toBe(4);
    expect(persisted.operationId).toBe("operation-001");
    expect(persisted.response.game.revision).toBe(5);

    const body = await response.json();
    expect(body.game.revision).toBe(5);
    expect(body.operationId).toBe("operation-001");
  });

  it("returns revision_conflict before applying a stale action", async () => {
    const store = createStore(createSnapshot(5));
    const handler = createGameActionHandler(store);

    const response = await handler(
      actionRequest({
        ...operation,
        action: { type: "practice-match" },
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "revision_conflict",
        message: "別の端末または操作でデータが更新されています",
      },
    });
    expect(store.applyOperation).not.toHaveBeenCalled();
  });

  it("returns the cached notification response for a duplicate operation without another mutation", async () => {
    const snapshot = createSnapshot();
    const notification = trainingNotification(snapshot);
    const cached = {
      game: {
        ...snapshot,
        revision: 5,
        state: {
          ...snapshot.state,
          notifications: { items: [notification] },
        },
      },
      operationId: "operation-001",
      outcome: { cached: true },
    };
    const store = createStore(snapshot);
    vi.mocked(store.getOperationResponse).mockResolvedValue(cached);
    const handler = createGameActionHandler(store);

    const response = await handler(
      actionRequest({
        ...operation,
        action: { type: "advance-week" },
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(cached);
    expect(store.getOperationResponse).toHaveBeenCalledWith(
      "user-123",
      "operation-001",
    );
    expect(store.getSnapshot).not.toHaveBeenCalled();
    expect(store.applyOperation).not.toHaveBeenCalled();
  });

  it("scopes operation lookup and save reads to the authenticated user", async () => {
    const snapshot = createSnapshot();
    const store = createStore(snapshot);
    const handler = createGameActionHandler(store);

    await handler(
      actionRequest({
        ...operation,
        action: {
          type: "team-selection",
          selection: snapshot.teamSelection,
        },
      }),
      { id: "other-user" },
    );

    expect(store.getOperationResponse).toHaveBeenCalledWith(
      "other-user",
      "operation-001",
    );
    expect(store.getSnapshot).toHaveBeenCalledWith("other-user");
    expect(store.applyOperation).not.toHaveBeenCalled();
  });

  it("maps an atomic persistence race to revision_conflict", async () => {
    const snapshot = createSnapshot();
    const store = createStore(snapshot);
    vi.mocked(store.applyOperation).mockRejectedValue(
      new RevisionConflictError(),
    );
    const handler = createGameActionHandler(store);

    const response = await handler(
      actionRequest({
        ...operation,
        action: {
          type: "team-selection",
          selection: snapshot.teamSelection,
        },
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("revision_conflict");
  });

  it("rejects a client-computed field that is not part of the action contract", async () => {
    const store = createStore(createSnapshot());
    const handler = createGameActionHandler(store);

    const response = await handler(
      actionRequest({
        ...operation,
        action: {
          type: "practice-match",
          winnerSchoolId: "school-user",
        },
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(400);
    expect(store.getSnapshot).not.toHaveBeenCalled();
  });
});
