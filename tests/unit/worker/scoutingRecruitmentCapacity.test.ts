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

describe("scouting recruitment capacity", () => {
  it("rejects commitments beyond the projected next-year roster capacity", async () => {
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
    state.world.nextGenerationalTalentYear = 99;

    const candidates = generateServerScoutingCandidates(state);
    const cycleKey = scoutingCycleKey(state);
    state.recruiting = {
      cycleKey,
      committedCandidateIds: candidates
        .slice(0, 4)
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
      applyOperation: vi.fn(async () => {
        throw new Error("must not persist beyond capacity");
      }),
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
    };
    const handler = createScoutingRecruitmentHandler({
      gameStore,
      scoutingStore,
    });

    const response = await handler(
      recruitmentRequest(candidates[4]!.player.id),
      { id: "user-123" },
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe(
      "recruitment_capacity_reached",
    );
    expect(gameStore.applyOperation).not.toHaveBeenCalled();
  });
});
