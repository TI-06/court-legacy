import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202609270001_phase36_delta_game_operation.sql",
  ),
  "utf8",
);

describe("Phase36 delta game operation", () => {
  it("updates the authoritative state from ordered patch operations", () => {
    expect(migration).toContain("apply_game_operation_v4");
    expect(migration).toContain("jsonb_array_elements(p_state_operations)");
    expect(migration).toContain("jsonb_set(v_state, v_path");
    expect(migration).toContain("v_state #- v_path");
    expect(migration).toContain("v_current_value || v_value");
  });

  it("keeps revision locking and compact replay retention", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("revision_conflict");
    expect(migration).toContain("'resultingRevision', v_resulting_revision");
    expect(migration).toContain("offset 16");
  });

  it("keeps v4 service-role only", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
