import { describe, expect, it, vi } from "vitest";
import { createSoakSnapshot } from "../../../../src/dev/soak/runBalanceSoak";
import { SupabaseGameStore } from "../../../../worker/data/SupabaseGameStore";
import type { SupabaseAdminClient } from "../../../../worker/data/createSupabaseAdmin";

interface RpcResult {
  data: unknown;
  error: unknown;
}

type MockSupabaseAdminClient = SupabaseAdminClient & {
  rpc: ReturnType<typeof vi.fn>;
};

function createClient(result: RpcResult): MockSupabaseAdminClient {
  return {
    rpc: vi.fn(async () => result),
  } as unknown as MockSupabaseAdminClient;
}

describe("SupabaseGameStore save stability", () => {
  it("avoids uploading the duplicate full response on a normal save", async () => {
    const snapshot = createSoakSnapshot("phase22-save-store");
    const operationId = "phase22-op-001";
    const outcome = { weekAdvanced: true, marker: "replay-contract" };
    const response = {
      operationId,
      game: {
        ...snapshot,
        revision: snapshot.revision + 1,
      },
      outcome,
    };
    const client = createClient({
      data: [{ response: null, replayed: false }],
      error: null,
    });
    const store = new SupabaseGameStore(client);

    await expect(
      store.applyOperation({
        userId: snapshot.userId,
        operationId,
        expectedRevision: snapshot.revision,
        state: response.game.state,
        teamSelection: response.game.teamSelection,
        response,
      }),
    ).resolves.toEqual({ response, replayed: false });

    expect(client.rpc).toHaveBeenCalledWith("apply_game_operation_v2", {
      p_user_id: snapshot.userId,
      p_operation_id: operationId,
      p_expected_revision: snapshot.revision,
      p_state: response.game.state,
      p_team_selection: response.game.teamSelection,
      p_outcome: outcome,
    });
    const rpcPayload = vi.mocked(client.rpc).mock.calls[0]?.[1];
    expect(rpcPayload).not.toHaveProperty("p_response");
  });

  it("returns an exact replay response from the operation RPC", async () => {
    const snapshot = createSoakSnapshot("phase22-save-replay");
    const operationId = "phase22-op-002";
    const response = {
      operationId,
      game: {
        ...snapshot,
        revision: snapshot.revision + 1,
      },
      outcome: { marker: "original-response" },
    };
    const client = createClient({
      data: [{ response, replayed: true }],
      error: null,
    });
    const store = new SupabaseGameStore(client);

    await expect(
      store.applyOperation({
        userId: snapshot.userId,
        operationId,
        expectedRevision: snapshot.revision,
        state: response.game.state,
        teamSelection: response.game.teamSelection,
        response,
      }),
    ).resolves.toEqual({ response, replayed: true });
  });
});
