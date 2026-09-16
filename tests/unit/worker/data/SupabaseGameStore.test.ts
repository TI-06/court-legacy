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

describe("SupabaseGameStore Phase22 save stability", () => {
  it("sends only the operation outcome envelope instead of duplicating the full game response", async () => {
    const snapshot = createSoakSnapshot("phase22-save-store");
    const operationId = "phase22-op-001";
    const outcome = { weekAdvanced: true, marker: "small-outcome" };
    const response = {
      operationId,
      game: {
        ...snapshot,
        revision: snapshot.revision + 1,
      },
      outcome,
    };
    const client = createClient({
      data: [{ response, replayed: false }],
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

    expect(client.rpc).toHaveBeenCalledWith("apply_game_operation", {
      p_user_id: snapshot.userId,
      p_operation_id: operationId,
      p_expected_revision: snapshot.revision,
      p_state: response.game.state,
      p_team_selection: response.game.teamSelection,
      p_response: {
        hasOutcome: true,
        outcome,
      },
    });
  });

  it("sends a tiny no-outcome envelope when an action has no public outcome", async () => {
    const snapshot = createSoakSnapshot("phase22-save-no-outcome");
    const operationId = "phase22-op-002";
    const response = {
      operationId,
      game: {
        ...snapshot,
        revision: snapshot.revision + 1,
      },
    };
    const client = createClient({
      data: [{ response, replayed: false }],
      error: null,
    });
    const store = new SupabaseGameStore(client);

    await store.applyOperation({
      userId: snapshot.userId,
      operationId,
      expectedRevision: snapshot.revision,
      state: response.game.state,
      teamSelection: response.game.teamSelection,
      response,
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "apply_game_operation",
      expect.objectContaining({
        p_response: { hasOutcome: false },
      }),
    );
  });
});
