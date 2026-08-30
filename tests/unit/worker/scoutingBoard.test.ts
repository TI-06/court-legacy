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
    applyOperation: vi.fn(async () => {
      throw new Error("not used");
    }),
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
};

describe("scouting board route", () => {
  it("stores candidate truth server-side and returns only incomplete scout reports", async () => {
    const snapshot = createSnapshot();
    const gameStore = createGameStore(snapshot);
    const scoutingStore = createScoutingStore();
    const handler = createScoutingBoardHandler({ gameStore, scoutingStore });

    const response = await handler(scoutingRequest(requestBody), {
      id: "user-123",
    });

    expect(response.status).toBe(200);
    expect(scoutingStore.createCandidatePool).toHaveBeenCalledTimes(1);
    expect(scoutingStore.savedPool?.candidates).toHaveLength(6);
    expect(scoutingStore.savedPool?.candidates[0]?.player.tier).toBeTruthy();
    expect(
      scoutingStore.savedPool?.candidates[0]?.player.abilities,
    ).toBeTruthy();

    const body = await response.json();
    expect(body.operationId).toBe("scouting-board-001");
    expect(body.revision).toBe(7);
    expect(body.reports).toHaveLength(6);
    expect(
      new Set(
        body.reports.map(
          (report: { candidateId: string }) => report.candidateId,
        ),
      ).size,
    ).toBe(6);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('"tier"');
    expect(serialized).not.toContain('"abilities"');
    expect(serialized).not.toContain('"growthPeakGrade"');
    expect(serialized).not.toContain('"injuryResistance"');
    expect(serialized).not.toContain('"hiddenTraitIds"');
  });

  it("reuses the same server-side pool within the same scouting cycle", async () => {
    const snapshot = createSnapshot();
    const gameStore = createGameStore(snapshot);
    const scoutingStore = createScoutingStore();
    const handler = createScoutingBoardHandler({ gameStore, scoutingStore });

    const first = await handler(scoutingRequest(requestBody), {
      id: "user-123",
    });
    expect(first.status).toBe(200);
    const firstBody = await first.json();

    const second = await handler(
      scoutingRequest({ ...requestBody, operationId: "scouting-board-002" }),
      { id: "user-123" },
    );
    expect(second.status).toBe(200);
    const secondBody = await second.json();

    expect(secondBody.reports).toEqual(firstBody.reports);
    expect(scoutingStore.createCandidatePool).toHaveBeenCalledTimes(1);
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
