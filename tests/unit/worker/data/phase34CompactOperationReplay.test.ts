import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202609250002_phase34_compact_operation_replay.sql",
  ),
  "utf8",
);

describe("Phase34 compact operation replay", () => {
  it("stores compact replay metadata instead of the full game state", () => {
    expect(migration).toContain("'resultingRevision', v_resulting_revision");
    expect(migration).not.toContain("'state', p_state");
    expect(migration).not.toContain("'teamSelection', p_team_selection");
  });

  it("compacts existing operation responses", () => {
    expect(migration).toContain("update public.game_operations");
    expect(migration).toContain("'operationId', operation_id");
    expect(migration).toContain("'resultingRevision', resulting_revision");
    expect(migration).toContain("'outcome', response -> 'outcome'");
  });

  it("keeps the recent replay window bounded", () => {
    expect(migration).toContain("offset 16");
  });
});
