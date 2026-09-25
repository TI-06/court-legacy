import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202609250001_phase34_game_operation_retention.sql",
  ),
  "utf8",
);

describe("Phase34 game operation retention", () => {
  it("trims existing replay history to the newest 16 operations per user", () => {
    expect(migration).toContain("partition by operation.user_id");
    expect(migration).toContain("where ranked.retention_rank > 16");
    expect(migration).toContain(
      "delete from public.game_operations as operation",
    );
  });

  it("prunes both legacy and v2 mutation paths to 16 exact replays", () => {
    expect(migration.match(/offset 16/g)).toHaveLength(2);
    expect(migration).toContain(
      "create or replace function public.apply_game_operation(",
    );
    expect(migration).toContain(
      "create or replace function public.apply_game_operation_v2(",
    );
  });

  it("does not prune or weaken the authoritative save", () => {
    expect(migration).not.toContain("delete from public.game_saves");
    expect(migration).toContain("return query select v_existing_response, true");
    expect(migration).toContain("return query select null::jsonb, false");
  });
});
