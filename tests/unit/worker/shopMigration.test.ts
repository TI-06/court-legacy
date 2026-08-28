import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202608280006_shop_mvp.sql",
);

function migrationSql(): string {
  expect(existsSync(migrationPath)).toBe(true);
  return readFileSync(migrationPath, "utf8");
}

describe("Phase 5 shop migration", () => {
  it("defines the authoritative catalog, inventory, operation ledger, audits, counters, and scouting insights", () => {
    const sql = migrationSql();

    for (const table of [
      "shop_item_definitions",
      "shop_inventory",
      "shop_operations",
      "shop_transactions",
      "shop_item_uses",
      "shop_yearly_counters",
      "scouting_candidate_insights",
    ]) {
      expect(sql).toContain(`create table public.${table}`);
    }

    expect(sql).toContain("primary key (user_id, operation_id)");
    expect(sql).toContain("request_fingerprint");
    expect(sql).toContain("operation_type");
    expect(sql).toContain("check (operation_type in ('purchase', 'use'))");
  });

  it("seeds exactly the seven approved item ids at zero price", () => {
    const sql = migrationSql();
    const itemIds = [
      "extra-scout-candidate",
      "scout-research",
      "potential-appraisal",
      "training-camp",
      "fatigue-recovery",
      "special-coach",
      "training-efficiency-boost",
    ];

    for (const itemId of itemIds) {
      expect(sql).toContain(`'${itemId}'`);
    }
    expect(sql).toContain("check (price_yen = 0)");
    expect(sql).toContain("insert into public.shop_item_definitions");
  });

  it("serializes shop mutations on the game save and rejects semantic operation-id reuse", () => {
    const sql = migrationSql();

    expect(sql).toContain("from public.game_saves as save");
    expect(sql).toContain("for update");
    expect(sql).toContain("operation_id_reused");
    expect(sql).toContain("revision_conflict");
    expect(sql).toContain("purchase_limit_reached");
    expect(sql).toContain("use_limit_reached");
    expect(sql).toContain("inventory_empty");
  });

  it("provides one status RPC and one atomic RPC for each mutation type", () => {
    const sql = migrationSql();

    expect(sql).toContain("create or replace function public.get_shop_status");
    expect(sql).toContain(
      "create or replace function public.purchase_shop_item",
    );
    expect(sql).toContain(
      "create or replace function public.commit_shop_item_use",
    );
    expect(sql).toContain("insert into public.shop_operations");
    expect(sql).toContain("insert into public.shop_transactions");
    expect(sql).toContain("insert into public.shop_item_uses");
  });

  it("keeps browser roles away from authoritative tables and mutation RPCs", () => {
    const sql = migrationSql();

    for (const table of [
      "shop_item_definitions",
      "shop_inventory",
      "shop_operations",
      "shop_transactions",
      "shop_item_uses",
      "shop_yearly_counters",
      "scouting_candidate_insights",
    ]) {
      expect(sql).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(sql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      );
    }

    for (const rpc of [
      "get_shop_status",
      "purchase_shop_item",
      "commit_shop_item_use",
    ]) {
      expect(sql).toContain(`revoke execute on function public.${rpc}`);
      expect(sql).toContain("from public, anon, authenticated");
      expect(sql).toContain("to service_role");
    }
  });
});
