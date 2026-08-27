import { describe, expect, it, vi } from "vitest";
import { createInitialGame } from "../../../src/app/createInitialGame";
import type { SupabaseAdminClient } from "../../../worker/data/createSupabaseAdmin";
import { SupabaseScoutingStore } from "../../../worker/data/SupabaseScoutingStore";

function candidateTruth() {
  const state = createInitialGame({
    seed: "supabase-scouting-store-fixture",
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
  const player = Object.values(state.players)[0]!;
  return {
    player,
    middleSchoolAchievement: "prefectural-selection" as const,
  };
}

function createReadClient(row: unknown) {
  const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  const secondEq = vi.fn(() => ({ maybeSingle }));
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const select = vi.fn(() => ({ eq: firstEq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn();

  return {
    client: { from, rpc } as unknown as SupabaseAdminClient,
    from,
    select,
    firstEq,
    secondEq,
    maybeSingle,
    rpc,
  };
}

describe("SupabaseScoutingStore", () => {
  it("reads a hidden candidate pool scoped to the authenticated user and scouting cycle", async () => {
    const candidate = candidateTruth();
    const fake = createReadClient({
      user_id: "user-123",
      cycle_key: "school-user:year-3",
      creation_operation_id: "scouting-op-first",
      candidates: [candidate],
    });
    const store = new SupabaseScoutingStore(fake.client);

    const pool = await store.getCandidatePool("user-123", "school-user:year-3");

    expect(fake.from).toHaveBeenCalledWith("scouting_candidate_pools");
    expect(fake.firstEq).toHaveBeenCalledWith("user_id", "user-123");
    expect(fake.secondEq).toHaveBeenCalledWith(
      "cycle_key",
      "school-user:year-3",
    );
    expect(pool).toEqual({
      userId: "user-123",
      cycleKey: "school-user:year-3",
      creationOperationId: "scouting-op-first",
      candidates: [candidate],
    });
  });

  it("creates through the atomic RPC and returns the canonical pool chosen by the server", async () => {
    const candidate = candidateTruth();
    const canonicalCandidate = {
      ...candidate,
      middleSchoolAchievement: "national-event" as const,
    };
    const rpc = vi.fn(async () => ({
      data: [
        {
          user_id: "user-123",
          cycle_key: "school-user:year-3",
          creation_operation_id: "concurrent-winner",
          candidates: [canonicalCandidate],
        },
      ],
      error: null,
    }));
    const client = { rpc } as unknown as SupabaseAdminClient;
    const store = new SupabaseScoutingStore(client);

    const pool = await store.createCandidatePool({
      userId: "user-123",
      cycleKey: "school-user:year-3",
      creationOperationId: "scouting-op-loser",
      candidates: [candidate],
    });

    expect(rpc).toHaveBeenCalledWith("create_scouting_candidate_pool", {
      p_user_id: "user-123",
      p_cycle_key: "school-user:year-3",
      p_creation_operation_id: "scouting-op-loser",
      p_candidates: [candidate],
    });
    expect(pool.creationOperationId).toBe("concurrent-winner");
    expect(pool.candidates).toEqual([canonicalCandidate]);
  });

  it("rejects malformed hidden candidate rows instead of passing corrupt truth into the game", async () => {
    const fake = createReadClient({
      user_id: "user-123",
      cycle_key: "school-user:year-3",
      creation_operation_id: "scouting-op-first",
      candidates: [{ player: null, middleSchoolAchievement: "invented" }],
    });
    const store = new SupabaseScoutingStore(fake.client);

    await expect(
      store.getCandidatePool("user-123", "school-user:year-3"),
    ).rejects.toThrow("scouting candidate pool is invalid");
  });
});
