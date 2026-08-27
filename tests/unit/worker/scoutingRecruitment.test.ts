import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type {
  CloudGameSnapshot,
  GameStore,
  PersistOperationInput,
  PersistOperationResult,
} from "../../../worker/data/GameStore";
import type {
  ScoutingCandidatePool,
  ScoutingStore,
} from "../../../worker/data/ScoutingStore";
import { createScoutingRecruitmentHandler } from "../../../worker/routes/scoutingRecruitment";
import {
  generateServerScoutingCandidates,
  scoutingCycleKey,
} from "../../../worker/scouting/serverScoutingBoard";

function createSnapshot(revision = 7): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "scouting-recruitment-fixture",
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

function createGameStore(snapshot: CloudGameSnapshot): GameStore {
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

function createScoutingStore(snapshot: CloudGameSnapshot): {
  store: ScoutingStore;
  pool: ScoutingCandidatePool;
} {
  const pool: ScoutingCandidatePool = {
    userId: snapshot.userId,
    cycleKey: scoutingCycleKey(snapshot.state),
    creationOperationId: "board-op-001",
    candidates: generateServerScoutingCandidates(snapshot.state),
  };
  const store: ScoutingStore = {
    getCandidatePool: vi.fn(async (userId, cycleKey) =>
      userId === pool.userId && cycleKey === pool.cycleKey ? pool : null,
    ),
    createCandidatePool: vi.fn(async () => pool),
  };
  return { store, pool };
}

function recruitmentRequest(body: unknown): Request {
  return new Request("https://court-legacy.test/api/scouting/recruit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("scouting recruitment route", () => {
  it("commits only the selected candidate id into GameState and persists the next revision", async () => {
    const snapshot = createSnapshot();
    const gameStore = createGameStore(snapshot);
    const scouting = createScoutingStore(snapshot);
    const candidate = scouting.pool.candidates[0]!;
    const handler = createScoutingRecruitmentHandler({
      gameStore,
      scoutingStore: scouting.store,
    });

    const response = await handler(
      recruitmentRequest({
        operationId: "recruit-op-001",
        revision: 7,
        candidateId: candidate.player.id,
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    expect(gameStore.applyOperation).toHaveBeenCalledTimes(1);
    const [persisted] = vi.mocked(gameStore.applyOperation).mock.calls[0]!;
    expect(persisted.expectedRevision).toBe(7);
    expect(persisted.response.game.revision).toBe(8);
    expect(persisted.state.recruiting).toEqual({
      cycleKey: scouting.pool.cycleKey,
      committedCandidateIds: [candidate.player.id],
    });

    const serializedState = JSON.stringify(persisted.state.recruiting);
    expect(serializedState).not.toContain('"tier"');
    expect(serializedState).not.toContain('"abilities"');
    expect(serializedState).not.toContain('"potential"');

    const body = await response.json();
    expect(body.outcome).toEqual({
      candidateId: candidate.player.id,
      committedCandidateIds: [candidate.player.id],
      cycleKey: scouting.pool.cycleKey,
    });
  });

  it("returns a cached duplicate operation without another scouting or game mutation", async () => {
    const snapshot = createSnapshot();
    const gameStore = createGameStore(snapshot);
    const scouting = createScoutingStore(snapshot);
    const candidate = scouting.pool.candidates[0]!;
    const cached = {
      game: { ...snapshot, revision: 8 },
      operationId: "recruit-op-001",
      outcome: {
        candidateId: candidate.player.id,
        committedCandidateIds: [candidate.player.id],
        cycleKey: scouting.pool.cycleKey,
      },
    };
    vi.mocked(gameStore.getOperationResponse).mockResolvedValue(cached);
    const handler = createScoutingRecruitmentHandler({
      gameStore,
      scoutingStore: scouting.store,
    });

    const response = await handler(
      recruitmentRequest({
        operationId: "recruit-op-001",
        revision: 7,
        candidateId: candidate.player.id,
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(cached);
    expect(gameStore.getSnapshot).not.toHaveBeenCalled();
    expect(scouting.store.getCandidatePool).not.toHaveBeenCalled();
    expect(gameStore.applyOperation).not.toHaveBeenCalled();
  });

  it("rejects a stale revision before reading hidden candidate truth", async () => {
    const snapshot = createSnapshot(8);
    const gameStore = createGameStore(snapshot);
    const scouting = createScoutingStore(snapshot);
    const handler = createScoutingRecruitmentHandler({
      gameStore,
      scoutingStore: scouting.store,
    });

    const response = await handler(
      recruitmentRequest({
        operationId: "recruit-op-stale",
        revision: 7,
        candidateId: scouting.pool.candidates[0]!.player.id,
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("revision_conflict");
    expect(scouting.store.getCandidatePool).not.toHaveBeenCalled();
    expect(gameStore.applyOperation).not.toHaveBeenCalled();
  });

  it("rejects a candidate that is not in the server-side pool", async () => {
    const snapshot = createSnapshot();
    const gameStore = createGameStore(snapshot);
    const scouting = createScoutingStore(snapshot);
    const handler = createScoutingRecruitmentHandler({
      gameStore,
      scoutingStore: scouting.store,
    });

    const response = await handler(
      recruitmentRequest({
        operationId: "recruit-op-missing",
        revision: 7,
        candidateId: "invented-candidate",
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("candidate_unavailable");
    expect(gameStore.applyOperation).not.toHaveBeenCalled();
  });

  it("rejects client-supplied hidden truth fields", async () => {
    const snapshot = createSnapshot();
    const gameStore = createGameStore(snapshot);
    const scouting = createScoutingStore(snapshot);
    const handler = createScoutingRecruitmentHandler({
      gameStore,
      scoutingStore: scouting.store,
    });

    const response = await handler(
      recruitmentRequest({
        operationId: "recruit-op-forged",
        revision: 7,
        candidateId: scouting.pool.candidates[0]!.player.id,
        tier: "monster",
        abilities: { spike: 100 },
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(400);
    expect(gameStore.getSnapshot).not.toHaveBeenCalled();
    expect(scouting.store.getCandidatePool).not.toHaveBeenCalled();
  });
});
