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

function recruitmentRequest(candidateId: string): Request {
  return new Request("https://court-legacy.test/api/scouting/recruit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "recruit-capacity-op",
      revision: 7,
      candidateId,
    }),
  });
}

function createFixture(committedCount: number) {
  const state = createInitialGame({
    seed: "scouting-capacity-fixture",
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
  const school = state.schools[state.userSchoolId]!;
  for (const playerId of school.playerIds) {
    state.players[playerId] = { ...state.players[playerId]!, grade: 2 };
  }
  state.schools[state.userSchoolId] = {
    ...school,
    reputationPoints: 1400,
    coach: { ...school.coach, charisma: 100 },
    facilities: {
      ...school.facilities,
      scoutingNetwork: 50,
      dormitory: 50,
    },
  };
  state.world.nextGenerationalTalentYear = 99;

  const candidates = generateServerScoutingCandidates(
    state,
    undefined,
    0,
    { extraCandidateCount: 2, guaranteedGenerationalCount: 0 },
  );
  const cycleKey = scoutingCycleKey(state);
  state.recruiting = {
    cycleKey,
    committedCandidateIds: candidates
      .slice(0, committedCount)
      .map(({ player }) => player.id),
  };

  const snapshot: CloudGameSnapshot = {
    userId: "user-123",
    schoolDbId: "00000000-0000-4000-8000-000000000001",
    revision: 7,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
  const gameStore: GameStore = {
    getSnapshot: vi.fn(async () => snapshot),
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
  const pool: ScoutingCandidatePool = {
    userId: snapshot.userId,
    cycleKey,
    creationOperationId: "board-op-001",
    candidates,
  };
  const scoutingStore: ScoutingStore = {
    getCandidatePool: vi.fn(async () => pool),
    createCandidatePool: vi.fn(async () => pool),
    replaceCandidatePool: vi.fn(async (input) => ({
      userId: input.userId,
      cycleKey: input.cycleKey,
      creationOperationId: input.creationOperationId,
      candidates: input.candidates,
    })),
    listCandidateInsights: vi.fn(async () => []),
  };

  return {
    candidates,
    gameStore,
    handler: createScoutingRecruitmentHandler({ gameStore, scoutingStore }),
  };
}

describe("scouting recruitment capacity", () => {
  it("allows the seventh commitment even when many players return next year", async () => {
    const { candidates, gameStore, handler } = createFixture(6);

    const response = await handler(
      recruitmentRequest(candidates[6]!.player.id),
      { id: "user-123" },
    );

    expect(response.status).toBe(200);
    expect(gameStore.applyOperation).toHaveBeenCalledTimes(1);
    const [persisted] = vi.mocked(gameStore.applyOperation).mock.calls[0]!;
    expect(persisted.state.recruiting?.committedCandidateIds).toHaveLength(7);
    expect(persisted.state.recruiting?.committedCandidateIds).toContain(
      candidates[6]!.player.id,
    );
  });

  it("rejects only the eighth commitment", async () => {
    const { candidates, gameStore, handler } = createFixture(7);

    const response = await handler(
      recruitmentRequest(candidates[7]!.player.id),
      { id: "user-123" },
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("recruitment_capacity_reached");
    expect(body.error.message).toContain("7人");
    expect(gameStore.applyOperation).not.toHaveBeenCalled();
  });
});
