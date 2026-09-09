import { describe, expect, it, vi } from "vitest";
import { SupabasePvPStore } from "../../../worker/data/SupabasePvPStore";
import type { SupabaseAdminClient } from "../../../worker/data/createSupabaseAdmin";

function clientWithRpc(rpc: ReturnType<typeof vi.fn>): SupabaseAdminClient {
  return { rpc } as unknown as SupabaseAdminClient;
}

function opponentRow(tactics?: unknown) {
  return {
    snapshot_id: "phase15-opponent",
    school_name: "白峰高校",
    school_short_name: "白峰",
    reputation_rank: "A",
    team_power: 88,
    academic_year: 2027,
    published_at: "2026-09-09T10:00:00.000Z",
    rating: 1048,
    wins: 8,
    losses: 3,
    current_win_streak: 2,
    ...(tactics === undefined ? {} : { tactics }),
  };
}

describe("Phase 15 PvP opponent tactic summaries", () => {
  it("maps a new categorical summary but leaves legacy rows absent", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          opponentRow({
            serve: "aggressive",
            attack: "quick",
            block: "commit",
          }),
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [opponentRow()], error: null });
    const store = new SupabasePvPStore(clientWithRpc(rpc));
    const query = {
      userId: "00000000-0000-0000-0000-000000000001",
      seasonId: "2026-09",
      limit: 10,
      cursor: null,
    };

    const current = await store.listOpponents(query);
    const legacy = await store.listOpponents(query);

    expect(current[0]?.tactics).toEqual({
      serve: "aggressive",
      attack: "quick",
      block: "commit",
    });
    expect(legacy[0]).not.toHaveProperty("tactics");
  });

  it("rejects malformed public tactic data instead of leaking arbitrary JSON", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [opponentRow({ serveTargetPlayerId: "secret-player" })],
      error: null,
    });
    const store = new SupabasePvPStore(clientWithRpc(rpc));

    await expect(
      store.listOpponents({
        userId: "00000000-0000-0000-0000-000000000001",
        seasonId: "2026-09",
        limit: 10,
        cursor: null,
      }),
    ).rejects.toThrow("PvP opponent response is invalid");
  });
});
