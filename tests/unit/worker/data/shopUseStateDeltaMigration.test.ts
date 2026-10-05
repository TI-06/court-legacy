import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202610030002_shop_use_state_delta.sql",
  ),
  "utf8",
);

describe("shop use state delta migration", () => {
  it("reconstructs state inside Postgres before delegating to the existing atomic shop function", () => {
    expect(migration).toContain(
      "create or replace function public.commit_shop_item_use_v2(",
    );
    expect(migration).toContain("p_state_delta jsonb");
    expect(migration).toContain("public.apply_jsonb_state_delta(");
    expect(migration).toContain("public.commit_shop_item_use(");
    expect(migration).not.toContain("p_state jsonb");
  });

  it("keeps the wrapper service-role only", () => {
    expect(migration).toContain(
      "revoke execute on function public.commit_shop_item_use_v2(",
    );
    expect(migration).toContain(
      "grant execute on function public.commit_shop_item_use_v2(",
    );
    expect(migration).toContain("to service_role");
  });
});
