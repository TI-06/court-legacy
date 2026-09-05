import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/202609060009_school_economy_foundation.sql";
const sql = readFileSync(migrationPath, "utf8");

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

  it("does not grant browser roles access to the authoritative shop mutation", () => {
    expect(sql).not.toMatch(/grant\s+.+\s+to\s+anon\b/i);
    expect(sql).not.toMatch(/grant\s+.+\s+to\s+authenticated\b/i);
  });
});
