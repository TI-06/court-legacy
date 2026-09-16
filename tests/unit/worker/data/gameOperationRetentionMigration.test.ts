import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/202609170001_phase22_game_operation_retention.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Phase22 game operation retention migration", () => {
  it("trims pre-existing history to the newest 128 operations per user", () => {
    expect(migration).toContain("partition by operation.user_id");
    expect(migration).toContain("operation.resulting_revision desc");
    expect(migration).toContain("where ranked.retention_rank > 128");
    expect(migration).toContain("delete from public.game_operations as operation");
  });

  it("prunes after a successful operation insert inside apply_game_operation", () => {
    const functionStart = migration.indexOf(
      "create or replace function public.apply_game_operation",
    );
    const insertIndex = migration.indexOf(
      "insert into public.game_operations",
      functionStart,
    );
    const pruneIndex = migration.indexOf("offset 128", insertIndex);
    const returnIndex = migration.indexOf(
      "return query select p_response, false",
      insertIndex,
    );

    expect(functionStart).toBeGreaterThanOrEqual(0);
    expect(insertIndex).toBeGreaterThan(functionStart);
    expect(pruneIndex).toBeGreaterThan(insertIndex);
    expect(returnIndex).toBeGreaterThan(pruneIndex);
  });

  it("preserves exact response replay and never prunes the authoritative save", () => {
    expect(migration).toContain("return query select v_existing_response, true");
    expect(migration).toContain("return query select p_response, false");
    expect(migration).not.toContain("delete from public.game_saves");
  });

  it("uses a user-and-revision index for bounded pruning", () => {
    expect(migration).toContain(
      "on public.game_operations(user_id, resulting_revision desc)",
    );
  });
});
