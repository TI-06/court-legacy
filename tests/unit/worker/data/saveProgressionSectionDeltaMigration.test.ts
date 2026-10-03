import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202610030001_save_progression_section_delta.sql",
  ),
  "utf8",
);

describe("section-delta save migration", () => {
  it("merges top-level sections instead of replacing the complete state", () => {
    expect(migration).toContain("apply_jsonb_state_delta");
    expect(migration).toContain("v_result := v_result || v_set");
    expect(migration).toContain("v_root_value := v_root_value || v_root_patch");
    expect(migration).not.toContain("state = p_state,");
  });

  it("keeps revision checks and compact replay retention", () => {
    expect(migration).toContain("apply_game_operation_v5");
    expect(migration).toContain("revision_conflict");
    expect(migration).toContain("offset 16");
    expect(migration).toContain("'resultingRevision', v_resulting_revision");
  });
});
