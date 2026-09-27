import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202609270001_phase36_delta_save_persistence.sql",
  ),
  "utf8",
);

describe("Phase36 delta save persistence", () => {
  it("adds a V4 RPC that accepts a state patch instead of the full state", () => {
    expect(migration).toContain("apply_game_operation_v4");
    expect(migration).toContain("p_state_patch jsonb");
    expect(migration).toContain("apply_jsonb_state_patch");
    expect(migration).not.toContain("p_state jsonb");
  });

  it("keeps game_saves.state as the authoritative complete JSONB snapshot", () => {
    expect(migration).toContain("state = v_next_state");
    expect(migration).toContain(
      "select save.school_id, save.revision, save.state",
    );
  });

  it("keeps compact replay metadata and bounded operation retention", () => {
    expect(migration).toContain("'resultingRevision', v_resulting_revision");
    expect(migration).toContain("offset 16");
    expect(migration).not.toContain("'state', v_next_state");
  });

  it("does not expose patch helpers or the mutation RPC to browser roles", () => {
    expect(migration).toContain(
      "revoke execute on function public.apply_jsonb_state_patch",
    );
    expect(migration).toContain(
      "revoke execute on function public.apply_game_operation_v4",
    );
    expect(migration).toContain("from public, anon, authenticated");
  });
});
