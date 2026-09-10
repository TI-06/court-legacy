import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SupabasePvPStore } from "../../../worker/data/SupabasePvPStore";
import type { SupabaseAdminClient } from "../../../worker/data/createSupabaseAdmin";

const userId = "00000000-0000-4000-8000-000000000161";
const snapshotId = "00000000-0000-4000-8000-000000000162";

function clientWithRpc(rpc: ReturnType<typeof vi.fn>): SupabaseAdminClient {
  return { rpc } as unknown as SupabaseAdminClient;
}

function persistedRow(overrides: Record<string, unknown> = {}) {
  return {
    challenger_user_id: userId,
    operation_id: "phase16-session-operation",
    defender_snapshot_id: snapshotId,
    challenger_source_revision: 8,
    current_cursor: 42,
    private_session: { match: { randomCursor: 42 } },
    public_response: { status: "in-progress", phase: "coach-decision" },
    final_response: null,
    created_at: "2026-09-10T10:00:00.000Z",
    updated_at: "2026-09-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 16 PvP session store", () => {
  it("creates and reloads one server-private session without touching rated-match commit", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: [persistedRow()], error: null })
      .mockResolvedValueOnce({ data: [persistedRow()], error: null });
    const store = new SupabasePvPStore(clientWithRpc(rpc));

    const created = await store.createMatchSession({
      challengerUserId: userId,
      operationId: "phase16-session-operation",
      defenderSnapshotId: snapshotId,
      challengerSourceRevision: 8,
      currentCursor: 42,
      privateSession: { match: { randomCursor: 42 } },
      publicResponse: { status: "in-progress", phase: "coach-decision" },
    });
    const loaded = await store.getMatchSession(
      userId,
      "phase16-session-operation",
    );

    expect(created.currentCursor).toBe(42);
    expect(loaded).toEqual(created);
    expect(rpc).toHaveBeenNthCalledWith(1, "create_pvp_match_session", {
      p_challenger_user_id: userId,
      p_operation_id: "phase16-session-operation",
      p_defender_snapshot_id: snapshotId,
      p_challenger_source_revision: 8,
      p_current_cursor: 42,
      p_private_session: { match: { randomCursor: 42 } },
      p_public_response: { status: "in-progress", phase: "coach-decision" },
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "get_pvp_match_session", {
      p_challenger_user_id: userId,
      p_operation_id: "phase16-session-operation",
    });
    expect(
      rpc.mock.calls.some(([name]) => name === "commit_pvp_rated_match"),
    ).toBe(false);
  });

  it("saves a command with expected cursor and maps duplicate command replay", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          ...persistedRow({ current_cursor: 77 }),
          replayed: true,
          command_response: {
            status: "in-progress",
            phase: "coach-decision",
          },
        },
      ],
      error: null,
    });
    const store = new SupabasePvPStore(clientWithRpc(rpc));

    const result = await store.saveMatchSessionCommand({
      challengerUserId: userId,
      operationId: "phase16-session-operation",
      commandId: "command-001",
      command: { type: "continue" },
      expectedCursor: 42,
      nextCursor: 77,
      privateSession: { match: { randomCursor: 77 } },
      publicResponse: { status: "in-progress", phase: "coach-decision" },
    });

    expect(rpc).toHaveBeenCalledWith("save_pvp_match_session_command", {
      p_challenger_user_id: userId,
      p_operation_id: "phase16-session-operation",
      p_command_id: "command-001",
      p_command: { type: "continue" },
      p_expected_cursor: 42,
      p_next_cursor: 77,
      p_private_session: { match: { randomCursor: 77 } },
      p_public_response: { status: "in-progress", phase: "coach-decision" },
    });
    expect(result.replayed).toBe(true);
    expect(result.commandResponse).toEqual({
      status: "in-progress",
      phase: "coach-decision",
    });
    expect(result.session.currentCursor).toBe(77);
  });

  it("stores and replays the canonical final response separately from the private session", async () => {
    const finalResponse = {
      status: "complete",
      matchId: "rated-match-1",
      rating: { before: 1000, after: 1016, delta: 16 },
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [persistedRow({ final_response: finalResponse })],
      error: null,
    });
    const store = new SupabasePvPStore(clientWithRpc(rpc));

    const stored = await store.storeMatchSessionFinalResponse({
      challengerUserId: userId,
      operationId: "phase16-session-operation",
      finalResponse,
    });

    expect(rpc).toHaveBeenCalledWith("store_pvp_match_session_final_response", {
      p_challenger_user_id: userId,
      p_operation_id: "phase16-session-operation",
      p_final_response: finalResponse,
    });
    expect(stored.finalResponse).toEqual(finalResponse);
  });

  it("defines service-role-only session and command receipt tables with atomic RPCs", () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/202609100001_phase16_pvp_match_sessions.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("create table public.pvp_match_sessions");
    expect(sql).toContain("primary key (challenger_user_id, operation_id)");
    expect(sql).toContain("create table public.pvp_match_command_receipts");
    expect(sql).toContain(
      "primary key (challenger_user_id, operation_id, command_id)",
    );
    expect(sql).toContain(
      "create or replace function public.create_pvp_match_session",
    );
    expect(sql).toContain(
      "create or replace function public.get_pvp_match_session",
    );
    expect(sql).toContain(
      "create or replace function public.save_pvp_match_session_command",
    );
    expect(sql).toContain(
      "create or replace function public.store_pvp_match_session_final_response",
    );
    expect(sql).toContain("for update");
    expect(sql).toContain("pvp_match_session_stale");
    expect(sql).toContain("pvp_command_conflict");

    for (const table of ["pvp_match_sessions", "pvp_match_command_receipts"]) {
      expect(sql).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(sql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      );
    }
    expect(sql).not.toContain("update public.pvp_ratings");
    expect(sql).not.toContain("insert into public.pvp_matches");
  });
});
