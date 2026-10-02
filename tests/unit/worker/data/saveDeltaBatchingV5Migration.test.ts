import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("save delta batching V5 migration", () => {
  const sql = readFileSync(
    "supabase/migrations/202610030001_save_delta_batching_v5.sql",
    "utf8",
  );

  it("adds merge-aware JSON patch application", () => {
    expect(sql).toContain("apply_jsonb_state_patch_v2");
    expect(sql).toContain("v_op = 'merge'");
    expect(sql).toContain("v_target || (v_operation -> 'value')");
    expect(sql).toContain("state_patch_merge_target_invalid");
  });

  it("adds V5 operation persistence without changing replay retention", () => {
    expect(sql).toContain("apply_game_operation_v5");
    expect(sql).toContain("apply_jsonb_state_patch_v2");
    expect(sql).toContain("offset 16");
    expect(sql).toContain("'resultingRevision'");
    expect(sql).toContain("grant execute on function public.apply_game_operation_v5");
  });

  it("keeps the new RPC private from browser roles", () => {
    expect(sql).toContain(
      "from public, anon, authenticated",
    );
    expect(sql).toContain("to service_role");
  });
});
