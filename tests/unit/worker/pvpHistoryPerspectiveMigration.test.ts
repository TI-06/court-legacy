import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202608280005_pvp_history_perspective.sql",
);

function migrationSql(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("PvP history perspective migration", () => {
  it("distinguishes challenger and defender history without inventing an opponent snapshot", () => {
    const sql = migrationSql();

    expect(sql).toContain("when matches.challenger_user_id = p_user_id");
    expect(sql).toContain("else null::uuid");
    expect(sql).toContain("then 'challenger'");
    expect(sql).toContain("else 'defender'");
    expect(sql).toContain("matches.result ->> 'challengerSchoolName'");
  });

  it("keeps history RPC unavailable to browser roles", () => {
    const sql = migrationSql();

    expect(sql).toContain(
      "revoke execute on function public.list_pvp_history(uuid, text, integer, text)",
    );
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});
