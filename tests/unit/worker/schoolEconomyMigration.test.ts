import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/202609060009_school_economy_foundation.sql";
const conflictFixMigrationPath =
  "supabase/migrations/202609060010_fix_shop_purchase_conflict_ambiguity.sql";
const sql = readFileSync(migrationPath, "utf8");
const shopFoundationSql = readFileSync(
  "supabase/migrations/202608280006_shop_mvp.sql",
  "utf8",
);

describe("school economy foundation migration", () => {
  it("contains the required grant, backfill, locking, and ledger invariants", () => {
    expect(sql).toContain("'funds-grant-300'");
    expect(sql).toContain("'funds-grant-1000'");
    expect(sql).toContain("'funds-grant-3000'");
    expect(sql).toContain("price_yen");
    expect(sql).toContain("jsonb_set");
    expect(sql).toContain("schoolManagement");
    expect(sql).toContain("fundsHistory");
    expect(sql).toContain("lastAnnualBudgetYearIndex");
    expect(sql).toContain("for update");
    expect(sql).toContain("purchase_limit_reached");
    expect(sql).toContain("shop-grant");
    expect(sql).toContain("fundsGranted");
    expect(sql).toContain("balanceAfter");
  });

  it("keeps the authoritative purchase rpc behind the service role", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(shopFoundationSql).toContain(
      "revoke execute on function public.purchase_shop_item(",
    );
    expect(shopFoundationSql).toContain("from public, anon, authenticated;");
    expect(shopFoundationSql).toContain(
      "grant execute on function public.purchase_shop_item(",
    );
    expect(shopFoundationSql).toContain("to service_role;");
  });

  it("does not grant browser roles access to the authoritative shop mutation", () => {
    expect(sql).not.toMatch(/grant\s+.+\s+to\s+anon\b/i);
    expect(sql).not.toMatch(/grant\s+.+\s+to\s+authenticated\b/i);
  });

  it("uses named conflict constraints so purchase output columns are not ambiguous", () => {
    expect(existsSync(conflictFixMigrationPath)).toBe(true);
    const conflictFixSql = readFileSync(conflictFixMigrationPath, "utf8");

    expect(conflictFixSql).toContain(
      "on conflict on constraint shop_yearly_counters_pkey do nothing",
    );
    expect(conflictFixSql).toContain(
      "on conflict on constraint shop_inventory_user_id_item_id_academic_year_index_key do nothing",
    );
    expect(conflictFixSql).not.toContain(
      "on conflict (user_id, item_id, academic_year_index) do nothing",
    );
  });
});
