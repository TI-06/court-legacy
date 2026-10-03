import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202610030002_shop_use_section_delta.sql",
);

describe("shop use section-delta migration", () => {
  it("reconstructs shop-use state inside Postgres without a full-state RPC parameter", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain(
      "create or replace function public.commit_shop_item_use_v2",
    );
    expect(sql).toContain("p_state_delta jsonb");
    expect(sql).toContain("public.apply_jsonb_state_delta");
    expect(sql).toContain("public.commit_shop_item_use(");
    expect(sql).not.toContain("p_state jsonb");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("from public, anon, authenticated");
  });
});
