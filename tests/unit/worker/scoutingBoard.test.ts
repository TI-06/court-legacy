import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { autoSelectTeam } from "../../../src/domain/team/autoSelectTeam";
import type {
  CloudGameSnapshot,
  GameStore,
} from "../../../worker/data/GameStore";
import type {
  ScoutingCandidatePool,
  ScoutingStore,
} from "../../../worker/data/ScoutingStore";
import { createScoutingBoardHandler } from "../../../worker/routes/scoutingBoard";
import { generateServerScoutingCandidates } from "../../../worker/scouting/serverScoutingBoard";

function createSnapshot(revision = 7): CloudGameSnapshot {
  const state = createInitialGame({
    seed: "server-scouting-fixture",
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
    applyOperation: vi.fn(async (input) => ({
      response: {
        game: {
          ...snapshot,
          revision: input.expectedRevision + 1,
          state: input.state,
          teamSelection: input.teamSelection,
        },
        operationId: input.operationId,
        outcome: {},
      },
      replayed: false,
    })),
  };
}

function createScoutingStore(): ScoutingStore & {
  savedPool: ScoutingCandidatePool | null;
} {
  const store: ScoutingStore & {
    savedPool: ScoutingCandidatePool | null;
  } = {
    savedPool: null,
    getCandidatePool: vi.fn(async (userId, cycleKey) => {
      const savedPool = store.savedPool;
      if (
        savedPool !== null &&
        savedPool.userId === userId &&
        savedPool.cycleKey === cycleKey
      ) {
        return savedPool;
      }
      return null;
    }),
    createCandidatePool: vi.fn(async (input) => {
      store.savedPool ??= {
        userId: input.userId,
        cycleKey: input.cycleKey,
        creationOperationId: input.creationOperationId,
        candidates: input.candidates,
      };
      return store.savedPool!;
    }),
    replaceCandidatePool: vi.fn(async (input) => {
      store.savedPool = {
        userId: input.userId,
        cycleKey: input.cycleKey,
        creationOperationId: input.creationOperationId,
        candidates: input.candidates,
      };
      return store.savedPool;
    }),
    listCandidateInsights: vi.fn(async () => []),
  };
  return store;
}

function scoutingRequest(body: unknown): Request {
  return new Request("https://court-legacy.test/api/scouting/board", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const requestBody = {
  operationId: "scouting-board-001",
  revision: 7,
  search: { region: "national", position: "any", priority: "ability" },
};

describe("scouting board route", () => {
  it("creates candidate truth only when a search is executed and returns public reports", async () => {
    const snapshot = createSnapshot();
    const gameStore = createGameStore(snapshot);
    const scoutingStore = createScoutingStore();
    const handler = createScoutingBoardHandler({ gameStore, scoutingStore });

    const readOnly = await handler(
      scoutingRequest({ operationId: "scouting-board-read", revision: 7 }),
      { id: "user-123" },
    );
    expect(readOnly.status).toBe(200);
    expect((await readOnly.json()).reports).toEqual([]);
    expect(scoutingStore.createCandidatePool).not.toHaveBeenCalled();

    const response = await handler(scoutingRequest(requestBody), {
      id: "user-123",
    });
    expect(response.status).toBe(200);
    expect(scoutingStore.createCandidatePool).toHaveBeenCalledTimes(1);
    expect(scoutingStore.savedPool?.candidates).toHaveLength(6);
    expect(gameStore.applyOperation).toHaveBeenCalledTimes(1);

    const body = await response.json();
    expect(body.operationId).toBe("scouting-board-001");
    expect(body.revision).toBe(8);
    expect(body.scoutingSearchesUsed).toBe(1);
    expect(body.reports).toHaveLength(6);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('"tier"');
    expect(serialized).not.toContain('"abilities"');
    expect(serialized).not.toContain('"growthPeakGrade"');
    expect(serialized).not.toContain('"injuryResistance"');
    expect(serialized).not.toContain('"hiddenTraitIds"');
  });

  it("replays a completed search without consuming another search or replacing the pool", async () => {
    const snapshot = createSnapshot(8);
    snapshot.state.recruiting = {
      cycleKey: `${snapshot.state.userSchoolId}:year-${snapshot.state.yearIndex}`,
      committedCandidateIds: [],
      visitActionsUsed: 0,
      recommendationUsed: false,
      candidateEngagements: {},
      scoutingSearchesUsed: 1,
    };
    const gameStore = createGameStore(snapshot);
    const scoutingStore = createScoutingStore();
    scoutingStore.savedPool = {
      userId: snapshot.userId,
      cycleKey: `${snapshot.state.userSchoolId}:year-${snapshot.state.yearIndex}`,
      creationOperationId: requestBody.operationId,
      candidates: generateServerScoutingCandidates(
        snapshot.state,
        { region: "national", position: "any", priority: "ability" },
        1,
      ),
    };
    vi.mocked(gameStore.getOperationResponse).mockResolvedValue({
      game: snapshot,
      operationId: requestBody.operationId,
      outcome: { scoutingSearchesUsed: 1 },
    });
    const handler = createScoutingBoardHandler({ gameStore, scoutingStore });

    const response = await handler(
      scoutingRequest({ ...requestBody, revision: 7 }),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    expect((await response.json()).scoutingSearchesUsed).toBe(1);
    expect(gameStore.applyOperation).not.toHaveBeenCalled();
    expect(scoutingStore.replaceCandidatePool).not.toHaveBeenCalled();
    expect(scoutingStore.createCandidatePool).not.toHaveBeenCalled();
  });

  it("replaces the active pool on a later search instead of accumulating yearly pools", async () => {
    const snapshot = createSnapshot();
    const gameStore = createGameStore(snapshot);
    const scoutingStore = createScoutingStore();
    const handler = createScoutingBoardHandler({ gameStore, scoutingStore });

    const first = await handler(scoutingRequest(requestBody), {
      id: "user-123",
    });
    expect(first.status).toBe(200);
    const firstIds =
      scoutingStore.savedPool?.candidates.map(
        (candidate) => candidate.player.id,
      ) ?? [];

    snapshot.revision = 8;
    snapshot.state = structuredClone(snapshot.state);
    snapshot.state.recruiting = {
      ...(snapshot.state.recruiting ?? {
        cycleKey: `${snapshot.state.userSchoolId}:year-${snapshot.state.yearIndex}`,
        committedCandidateIds: [],
        visitActionsUsed: 0,
        recommendationUsed: false,
        candidateEngagements: {},
      }),
      scoutingSearchesUsed: 1,
    };
    const second = await handler(
      scoutingRequest({
        ...requestBody,
        operationId: "scouting-board-002",
        revision: 8,
      }),
      { id: "user-123" },
    );
    expect(second.status).toBe(200);
    expect(scoutingStore.replaceCandidatePool).toHaveBeenCalledTimes(1);
    const secondIds =
      scoutingStore.savedPool?.candidates.map(
        (candidate) => candidate.player.id,
      ) ?? [];
    expect(secondIds).not.toEqual(firstIds);
    expect(secondIds.every((id) => id.includes("-2-"))).toBe(true);
  });

  it("rejects a stale revision before reading or creating a candidate pool", async () => {
    const gameStore = createGameStore(createSnapshot(8));
    const scoutingStore = createScoutingStore();
    const handler = createScoutingBoardHandler({ gameStore, scoutingStore });

    const response = await handler(scoutingRequest(requestBody), {
      id: "user-123",
    });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("revision_conflict");
    expect(scoutingStore.getCandidatePool).not.toHaveBeenCalled();
    expect(scoutingStore.createCandidatePool).not.toHaveBeenCalled();
  });

  it("rejects client-supplied candidate truth fields", async () => {
    const gameStore = createGameStore(createSnapshot());
    const scoutingStore = createScoutingStore();
    const handler = createScoutingBoardHandler({ gameStore, scoutingStore });

    const response = await handler(
      scoutingRequest({
        ...requestBody,
        tier: "monster",
        potential: 100,
        abilities: { spike: 100 },
      }),
      { id: "user-123" },
    );

    expect(response.status).toBe(400);
    expect(gameStore.getSnapshot).not.toHaveBeenCalled();
    expect(scoutingStore.getCandidatePool).not.toHaveBeenCalled();
  });
});
