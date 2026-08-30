import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import { markWeeklyActionCompleted } from "../../../src/domain/calendar/weekProgression";
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
import { createGameActionHandler } from "../../../worker/routes/gameAction";
import {
  generateServerScoutingCandidates,
  scoutingCycleKey,
} from "../../../worker/scouting/serverScoutingBoard";

function createRolloverSnapshot(revision = 9): CloudGameSnapshot {
  let state = createInitialGame({
    seed: "academic-year-recruitment-fixture",
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
  state = {
    ...state,
    date: "2027-03-31",
    calendar: {
      ...state.calendar,
      currentDate: "2027-03-31",
      weekOfYear: 52,
    },
  };
  state = markWeeklyActionCompleted(state, "training");

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

function createScoutingStore(pool: ScoutingCandidatePool): ScoutingStore {
  return {
    getCandidatePool: vi.fn(async (userId, cycleKey) =>
      userId === pool.userId && cycleKey === pool.cycleKey ? pool : null,
    ),
    createCandidatePool: vi.fn(async () => pool),
    listCandidateInsights: vi.fn(async () => []),
  };
}

function advanceWeekRequest(revision = 9): Request {
  return new Request("https://court-legacy.test/api/game/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "rollover-op-001",
      revision,
      action: { type: "advance-week" },
    }),
  });
}

describe("academic-year recruiting integration", () => {
  it("resolves committed candidate ids from server truth only when the academic year rolls over", async () => {
    const snapshot = createRolloverSnapshot();
    const candidates = generateServerScoutingCandidates(snapshot.state);
    const committed = candidates[0]!;
    snapshot.state.recruiting = {
      cycleKey: scoutingCycleKey(snapshot.state),
      committedCandidateIds: [committed.player.id],
    };
    const pool: ScoutingCandidatePool = {
      userId: snapshot.userId,
      cycleKey: scoutingCycleKey(snapshot.state),
      creationOperationId: "board-op-001",
      candidates,
    };
    const gameStore = createGameStore(snapshot);
    const scoutingStore = createScoutingStore(pool);
    const handler = createGameActionHandler(gameStore, scoutingStore);

    const response = await handler(advanceWeekRequest(), { id: "user-123" });

    expect(response.status).toBe(200);
    expect(scoutingStore.getCandidatePool).toHaveBeenCalledWith(
      "user-123",
      pool.cycleKey,
    );
    const [persisted] = vi.mocked(gameStore.applyOperation).mock.calls[0]!;
    const enrolled = persisted.state.players[committed.player.id];
    expect(enrolled).toEqual(committed.player);
    expect(
      persisted.state.schools[persisted.state.userSchoolId]?.playerIds,
    ).toContain(committed.player.id);
    expect(persisted.state.recruiting).toBeUndefined();
    expect(persisted.state.yearIndex).toBe(2);
  });

  it("does not read hidden recruiting truth on an ordinary non-rollover week", async () => {
    const snapshot = createRolloverSnapshot();
    snapshot.state.date = "2026-09-02";
    snapshot.state.calendar.currentDate = "2026-09-02";
    snapshot.state.calendar.weekOfYear = 22;
    snapshot.state.calendar.completedActivityIds = [];
    snapshot.state = markWeeklyActionCompleted(snapshot.state, "training");
    const candidates = generateServerScoutingCandidates(snapshot.state);
    snapshot.state.recruiting = {
      cycleKey: scoutingCycleKey(snapshot.state),
      committedCandidateIds: [candidates[0]!.player.id],
    };
    const pool: ScoutingCandidatePool = {
      userId: snapshot.userId,
      cycleKey: scoutingCycleKey(snapshot.state),
      creationOperationId: "board-op-001",
      candidates,
    };
    const gameStore = createGameStore(snapshot);
    const scoutingStore = createScoutingStore(pool);
    const handler = createGameActionHandler(gameStore, scoutingStore);

    const response = await handler(advanceWeekRequest(), { id: "user-123" });

    expect(response.status).toBe(200);
    expect(scoutingStore.getCandidatePool).not.toHaveBeenCalled();
  });

  it("blocks rollover when a committed id is missing from canonical server truth", async () => {
    const snapshot = createRolloverSnapshot();
    const candidates = generateServerScoutingCandidates(snapshot.state);
    snapshot.state.recruiting = {
      cycleKey: scoutingCycleKey(snapshot.state),
      committedCandidateIds: ["missing-candidate" as never],
    };
    const pool: ScoutingCandidatePool = {
      userId: snapshot.userId,
      cycleKey: scoutingCycleKey(snapshot.state),
      creationOperationId: "board-op-001",
      candidates,
    };
    const gameStore = createGameStore(snapshot);
    const scoutingStore = createScoutingStore(pool);
    const handler = createGameActionHandler(gameStore, scoutingStore);

    const response = await handler(advanceWeekRequest(), { id: "user-123" });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe(
      "recruitment_data_unavailable",
    );
    expect(gameStore.applyOperation).not.toHaveBeenCalled();
  });
});
