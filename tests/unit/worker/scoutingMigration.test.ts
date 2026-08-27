import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202608270003_scouting_candidate_pools.sql",
);

describe("scouting candidate pool migration", () => {
  it("keeps hidden candidate truth inaccessible to browser roles", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("create table public.scouting_candidate_pools");
    expect(sql).toContain(
      "alter table public.scouting_candidate_pools enable row level security",
    );
    expect(sql).toContain(
      "revoke all on table public.scouting_candidate_pools from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant select, insert, update, delete on table public.scouting_candidate_pools to service_role",
    );
  });

  it("creates an atomic service-role-only candidate pool RPC", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain(
      "create or replace function public.create_scouting_candidate_pool",
    );
    expect(sql).toContain("on conflict (user_id, cycle_key) do nothing");
    expect(sql).toContain(
      "revoke execute on function public.create_scouting_candidate_pool",
    );
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});
