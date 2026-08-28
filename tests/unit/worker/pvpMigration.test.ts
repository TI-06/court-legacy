import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/202608280004_async_pvp.sql",
);

function migrationSql(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("async PvP migration", () => {
  it("keeps frozen snapshots append-only with one active snapshot per user", () => {
    const sql = migrationSql();

    expect(sql).toContain("create table public.pvp_team_snapshots");
    expect(sql).toContain(
      "create unique index pvp_team_snapshots_one_active_per_user_idx",
    );
    expect(sql).toContain("where is_active");
    expect(sql).toContain(
      "create or replace function public.publish_pvp_team_snapshot",
    );
    expect(sql).toContain("set is_active = false");
    expect(sql).toContain("insert into public.pvp_team_snapshots");
  });

  it("defines seasonal ratings, idempotent operations, and unique challenge operations", () => {
    const sql = migrationSql();

    expect(sql).toContain("create table public.pvp_ratings");
    expect(sql).toContain("primary key (season_id, user_id)");
    expect(sql).toContain("create table public.pvp_operations");
    expect(sql).toContain("primary key (user_id, operation_id)");
    expect(sql).toContain("create table public.pvp_matches");
    expect(sql).toContain("unique (challenger_user_id, operation_id)");
  });

  it("commits rated matches atomically with deterministic rating-row locks and daily limit", () => {
    const sql = migrationSql();

    expect(sql).toContain(
      "create or replace function public.commit_pvp_rated_match",
    );
    expect(sql).toContain("order by user_id");
    expect(sql).toContain("for update");
    expect(sql).toContain("pvp_daily_opponent_limit");
    expect(sql).toContain("challenge_day_key");
    expect(sql).toContain("count(*) >= 3");
  });

  it("rechecks the active defender snapshot inside the atomic challenge transaction", () => {
    const sql = migrationSql();

    expect(sql).toContain("pvp_opponent_inactive");
    expect(sql).toContain("snapshots.id = p_defender_snapshot_id");
    expect(sql).toContain("snapshots.user_id = p_defender_user_id");
    expect(sql).toContain("snapshots.is_active");
  });

  it("stores a complete sanitized challenge response for idempotent replay", () => {
    const sql = migrationSql();

    for (const key of [
      "'operationId'",
      "'revision'",
      "'seasonId'",
      "'matchId'",
      "'opponent'",
      "'snapshotId'",
      "'schoolName'",
      "'schoolShortName'",
      "'rating'",
      "'before'",
      "'after'",
      "'delta'",
      "'result'",
      "'createdAt'",
    ]) {
      expect(sql).toContain(key);
    }
    expect(sql).toContain("v_match_created_at");
    expect(sql).toContain("v_defender_school_name");
    expect(sql).toContain("v_defender_school_short_name");
  });

  it("pages match history by created time plus match id to match its stable sort order", () => {
    const sql = migrationSql();

    expect(sql).toContain("(matches.created_at, matches.id::text) <");
    expect(sql).toContain("split_part(p_cursor, '|', 1)::timestamptz");
    expect(sql).toContain("split_part(p_cursor, '|', 2)");
    expect(sql).toContain("order by matches.created_at desc, matches.id desc");
  });

  it("blocks browser roles from PvP tables and RPC execution", () => {
    const sql = migrationSql();

    for (const table of [
      "pvp_team_snapshots",
      "pvp_ratings",
      "pvp_matches",
      "pvp_operations",
    ]) {
      expect(sql).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(sql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated`,
      );
    }

    expect(sql).toContain(
      "grant select, insert, update, delete on table public.pvp_team_snapshots to service_role",
    );
    expect(sql).toContain(
      "revoke execute on function public.publish_pvp_team_snapshot",
    );
    expect(sql).toContain(
      "revoke execute on function public.commit_pvp_rated_match",
    );
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});
