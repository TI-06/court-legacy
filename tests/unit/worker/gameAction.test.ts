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
import { applyGameAction } from "../../../worker/game/applyGameAction";
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
  it("reveals an eligible trait after a canonical action without surfacing a new event", async () => {
    const snapshot = createSnapshot();
    for (const player of Object.values(snapshot.state.players)) {
      player.hiddenTraitIds = [];
      player.revealedHiddenTraitIds = [];
      player.hiddenTraitAssignmentInitialized = true;
    }
    const playerId =
      snapshot.state.schools[snapshot.state.userSchoolId]!.playerIds[0]!;
    const player = snapshot.state.players[playerId]!;
    player.hiddenTraitIds = ["character.training-lover"];
    player.trust = 65;
    snapshot.state.pendingEvent = null;
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
    const [persisted] = vi.mocked(store.applyOperation).mock.calls[0]!;
    expect(persisted.state.players[playerId]!.revealedHiddenTraitIds).toEqual([
      "character.training-lover",
    ]);
    expect(persisted.state.pendingEvent).toBeNull();
    expect(persisted.state.notifications.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "character-trait-discovered",
          payload: expect.objectContaining({
            playerId,
            traitId: "character.training-lover",
          }),
        }),
      ]),
    );
  });

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
    expect(store.getOperationResponse).not.toHaveBeenCalled();
    const [persisted] = vi.mocked(store.applyOperation).mock.calls[0]!;
    expect(persisted.userId).toBe("user-123");
    expect(persisted.expectedRevision).toBe(4);
    expect(persisted.operationId).toBe("operation-001");
    expect(persisted.response.game.revision).toBe(5);
    expect(persisted.stateDelta).toBeDefined();

    const body = await response.json();
    expect(body.operationId).toBe("operation-001");
    expect(body.game).toBeUndefined();
    expect(body.gameDelta.revision).toBe(5);
    expect(body.gameDelta.statePatch).toEqual(expect.any(Array));
    expect(JSON.stringify(body).length).toBeLessThan(
      JSON.stringify(persisted.response).length,
    );
  });

  it("builds the response delta from the persisted pre-compaction state", async () => {
    const snapshot = createSnapshot();
    const first = trainingNotification(snapshot);
    const second = {
      ...trainingNotification(snapshot),
      id: "training-result:newest",
      weekOfYear: first.weekOfYear + 1,
    };
    snapshot.state.notifications.items = [first, second];
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
    const body = await response.json();
    const notificationPatch = body.gameDelta.statePatch.filter(
      (entry: { path: string[] }) =>
        entry.path[0] === "notifications" && entry.path[1] === "items",
    );
    expect(notificationPatch.length).toBeGreaterThan(0);

    const [persisted] = vi.mocked(store.applyOperation).mock.calls[0]!;
    expect(persisted.previousState.notifications.items).toHaveLength(2);
    expect(persisted.state.notifications.items).toHaveLength(1);
  });

  it("uses one compact active-match patch and omits duplicate mid-match outcome", async () => {
    const snapshot = createSnapshot();
    const opponent = Object.values(snapshot.state.schools).find(
      (school) => school.id !== snapshot.state.userSchoolId,
    );
    if (!opponent) throw new Error("practice opponent fixture missing");
    snapshot.state.weeklySchedule.practiceMatch.scheduledOpponentId =
      opponent.id;
    snapshot.state.weeklySchedule.practiceMatch.scheduledBy = "outgoing";

    const started = applyGameAction(snapshot, { type: "advance-week" });
    const activeSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: started.state,
      teamSelection: started.teamSelection,
    };
    expect(activeSnapshot.state.activeMatch?.runtime).toBeDefined();

    const store = createStore(activeSnapshot);
    const handler = createGameActionHandler(store);
    const response = await handler(
      actionRequest({
        ...operation,
        action: {
          type: "match-command",
          command: { type: "continue" },
        },
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome).toBeUndefined();
    expect(
      body.gameDelta.statePatch.filter(
        (entry: { path: string[] }) => entry.path[0] === "activeMatch",
      ),
    ).toEqual([
      expect.objectContaining({
        op: "set",
        path: ["activeMatch"],
      }),
    ]);

    const [persisted] = vi.mocked(store.applyOperation).mock.calls[0]!;
    expect(persisted.preferDelta).toBe(true);
    expect(persisted.stateDelta).toBeUndefined();
    expect(persisted.response.outcome).toBeUndefined();
  });

  it("self-heals a completed match event log on the next normal save", async () => {
    const snapshot = createSnapshot();
    const opponent = Object.values(snapshot.state.schools).find(
      (school) => school.id !== snapshot.state.userSchoolId,
    );
    if (!opponent) throw new Error("practice opponent fixture missing");
    snapshot.state.weeklySchedule.practiceMatch.scheduledOpponentId =
      opponent.id;
    snapshot.state.weeklySchedule.practiceMatch.scheduledBy = "outgoing";

    const started = applyGameAction(snapshot, { type: "advance-week" });
    const activeMatch = started.state.activeMatch;
    if (!activeMatch || activeMatch.eventLog.length === 0) {
      throw new Error("practice match fixture did not produce events");
    }
    const loadedSnapshot: CloudGameSnapshot = {
      ...snapshot,
      state: {
        ...started.state,
        activeMatch: {
          ...activeMatch,
          phase: "match-complete",
        },
      },
      teamSelection: started.teamSelection,
    };
    const store = createStore(loadedSnapshot);
    const handler = createGameActionHandler(store);

    const response = await handler(
      actionRequest({
        ...operation,
        action: {
          type: "team-selection",
          selection: loadedSnapshot.teamSelection,
        },
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    const activeMatchPatch = body.gameDelta.statePatch.filter(
      (entry: { path: string[] }) => entry.path[0] === "activeMatch",
    );
    expect(activeMatchPatch).toEqual([
      expect.objectContaining({
        op: "set",
        path: ["activeMatch"],
        value: expect.objectContaining({ eventLog: [] }),
      }),
    ]);

    const [persisted] = vi.mocked(store.applyOperation).mock.calls[0]!;
    expect(
      persisted.previousState.activeMatch?.eventLog.length,
    ).toBeGreaterThan(0);
    expect(persisted.state.activeMatch?.eventLog).toEqual([]);
  });

  it("accepts a valid season ambition action through the HTTP contract", async () => {
    const snapshot = createSnapshot();
    snapshot.state.calendar.weekOfYear = 1;
    snapshot.state.calendar.completedActivityIds = [];
    snapshot.state.seasonGoals = {
      ...snapshot.state.seasonGoals!,
      ambition: "challenge",
      ambitionSelectionPending: true,
    };
    const store = createStore(snapshot);
    const handler = createGameActionHandler(store);

    const response = await handler(
      actionRequest({
        ...operation,
        action: {
          type: "set-season-ambition",
          ambition: "bold",
        },
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    const [persisted] = vi.mocked(store.applyOperation).mock.calls[0]!;
    expect(persisted.state.seasonGoals).toMatchObject({
      ambition: "bold",
      ambitionSelectionPending: false,
    });
  });

  it("accepts training camp result acknowledgement through the HTTP contract", async () => {
    const snapshot = createSnapshot();
    snapshot.state.shopEffects = {
      trainingCampResult: {
        sourceItemId: "training-camp",
        scheduledDate: snapshot.state.date,
        participantCount: 12,
        grewPlayerCount: 10,
        totalAbilityGrowth: 36,
        topGrowth: [],
        averageFatigueChange: 11.5,
        injuredPlayerIds: [],
      },
    };
    const store = createStore(snapshot);
    const handler = createGameActionHandler(store);

    const response = await handler(
      actionRequest({
        ...operation,
        action: { type: "acknowledge-training-camp-result" },
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    const [persisted] = vi.mocked(store.applyOperation).mock.calls[0]!;
    expect(persisted.state.shopEffects?.trainingCampResult).toBeUndefined();
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
    expect(store.getOperationResponse).toHaveBeenCalledWith(
      "user-123",
      "operation-001",
    );
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "revision_conflict",
        message: "別の端末または操作でデータが更新されています",
      },
    });
    expect(store.applyOperation).not.toHaveBeenCalled();
  });

  it("returns the cached notification response only after detecting a stale retry revision", async () => {
    const snapshot = createSnapshot(5);
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
    expect(store.getSnapshot).toHaveBeenCalledWith("user-123");
    expect(store.applyOperation).not.toHaveBeenCalled();
  });

  it("scopes save reads to the authenticated user before any replay lookup", async () => {
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

    expect(store.getSnapshot).toHaveBeenCalledWith("other-user");
    expect(store.getOperationResponse).not.toHaveBeenCalled();
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
