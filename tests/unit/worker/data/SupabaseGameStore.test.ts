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
        previousState: snapshot.state,
        state: response.game.state,
        teamSelection: response.game.teamSelection,
        response,
      }),
    ).resolves.toEqual({ response, replayed: false });

    expect(client.rpc).toHaveBeenCalledWith("apply_game_operation_v4", {
      p_user_id: snapshot.userId,
      p_operation_id: operationId,
      p_expected_revision: snapshot.revision,
      p_state_patch: expect.any(Array),
      p_team_selection: response.game.teamSelection,
      p_outcome: outcome,
    });
    const rpcPayload = vi.mocked(client.rpc).mock.calls[0]?.[1];
    expect(rpcPayload).not.toHaveProperty("p_response");
    expect(rpcPayload).not.toHaveProperty("p_state");
    expect(JSON.stringify(rpcPayload?.p_state_patch).length).toBeLessThan(
      JSON.stringify(response.game.state).length / 10,
    );
  });

  it("falls back to full-state persistence when a patch would timeout Postgres", async () => {
    const snapshot = createSoakSnapshot("phase37-large-week-patch");
    const operationId = "phase37-large-week-001";
    const response = {
      operationId,
      game: {
        ...snapshot,
        revision: snapshot.revision + 1,
      },
      outcome: { weekAdvanced: true },
    };
    const client = createClient({
      data: [{ response: null, replayed: false }],
      error: null,
    });
    const store = new SupabaseGameStore(client);
    const statePatch = Array.from({ length: 65 }, (_, index) => ({
      op: "set" as const,
      path: ["test", String(index)],
      value: index,
    }));

    await store.applyOperation({
      userId: snapshot.userId,
      operationId,
      expectedRevision: snapshot.revision,
      previousState: snapshot.state,
      state: response.game.state,
      statePatch,
      teamSelection: response.game.teamSelection,
      response,
    });

    expect(client.rpc).toHaveBeenCalledWith("apply_game_operation_v3", {
      p_user_id: snapshot.userId,
      p_operation_id: operationId,
      p_expected_revision: snapshot.revision,
      p_state: response.game.state,
      p_team_selection: response.game.teamSelection,
      p_outcome: response.outcome,
    });
  });

  it("never lets preferDelta bypass the hard patch-operation safety limit", async () => {
    const snapshot = createSoakSnapshot("phase40-match-delta-hard-limit");
    const operationId = "phase40-match-op-hard-limit";
    const response = {
      operationId,
      game: {
        ...snapshot,
        revision: snapshot.revision + 1,
      },
    };
    const client = createClient({
      data: [{ response: null, replayed: false }],
      error: null,
    });
    const store = new SupabaseGameStore(client);
    const statePatch = Array.from({ length: 17 }, (_, index) => ({
      op: "set" as const,
      path: ["activeMatch", "eventLog", String(index)],
      value: { sequence: index + 1 },
    }));

    await store.applyOperation({
      userId: snapshot.userId,
      operationId,
      expectedRevision: snapshot.revision,
      previousState: snapshot.state,
      state: response.game.state,
      statePatch,
      preferDelta: true,
      teamSelection: response.game.teamSelection,
      response,
    });

    expect(client.rpc).toHaveBeenCalledWith("apply_game_operation_v3", {
      p_user_id: snapshot.userId,
      p_operation_id: operationId,
      p_expected_revision: snapshot.revision,
      p_state: response.game.state,
      p_team_selection: response.game.teamSelection,
      p_outcome: null,
    });
  });

  it("keeps a single large mid-match root replacement on delta persistence", async () => {
    const snapshot = createSoakSnapshot("phase40-match-delta-large-root");
    const operationId = "phase40-match-op-large-root";
    const response = {
      operationId,
      game: {
        ...snapshot,
        revision: snapshot.revision + 1,
      },
    };
    const client = createClient({
      data: [{ response: null, replayed: false }],
      error: null,
    });
    const store = new SupabaseGameStore(client);
    const statePatch = [
      {
        op: "set" as const,
        path: ["activeMatch"],
        value: { eventLog: "x".repeat(40_000) },
      },
    ];

    await store.applyOperation({
      userId: snapshot.userId,
      operationId,
      expectedRevision: snapshot.revision,
      previousState: snapshot.state,
      state: response.game.state,
      statePatch,
      preferDelta: true,
      teamSelection: response.game.teamSelection,
      response,
    });

    expect(JSON.stringify(statePatch).length).toBeGreaterThan(32_768);
    expect(client.rpc).toHaveBeenCalledWith("apply_game_operation_v4", {
      p_user_id: snapshot.userId,
      p_operation_id: operationId,
      p_expected_revision: snapshot.revision,
      p_state_patch: statePatch,
      p_team_selection: response.game.teamSelection,
      p_outcome: null,
    });
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
      data: [
        {
          response: {
            operationId,
            resultingRevision: snapshot.revision + 1,
            outcome: response.outcome,
          },
          replayed: true,
        },
      ],
      error: null,
    });
    const store = new SupabaseGameStore(client);

    await expect(
      store.applyOperation({
        userId: snapshot.userId,
        operationId,
        expectedRevision: snapshot.revision,
        previousState: snapshot.state,
        state: response.game.state,
        teamSelection: response.game.teamSelection,
        response,
      }),
    ).resolves.toEqual({ response, replayed: true });
  });
});
