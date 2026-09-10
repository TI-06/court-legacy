import { describe, expect, it, vi } from "vitest";
import { SupabasePvPStore } from "../../../worker/data/SupabasePvPStore";
import type { SupabaseAdminClient } from "../../../worker/data/createSupabaseAdmin";

const userId = "00000000-0000-4000-8000-000000000161";

function clientWithRpc(rpc: ReturnType<typeof vi.fn>): SupabaseAdminClient {
  return { rpc } as unknown as SupabaseAdminClient;
}

describe("Phase 16 PvP command receipt lookup", () => {
  it("loads an accepted command receipt before a route attempts to resume the match again", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          command_id: "command-001",
          command: { type: "continue" },
          public_response: {
            status: "in-progress",
            phase: "coach-decision",
          },
        },
      ],
      error: null,
    });
    const store = new SupabasePvPStore(clientWithRpc(rpc));

    const receipt = await store.getMatchSessionCommandReceipt(
      userId,
      "phase16-session-operation",
      "command-001",
    );

    expect(rpc).toHaveBeenCalledWith(
      "get_pvp_match_session_command_receipt",
      {
        p_challenger_user_id: userId,
        p_operation_id: "phase16-session-operation",
        p_command_id: "command-001",
      },
    );
    expect(receipt).toEqual({
      commandId: "command-001",
      command: { type: "continue" },
      publicResponse: {
        status: "in-progress",
        phase: "coach-decision",
      },
    });
  });
});
