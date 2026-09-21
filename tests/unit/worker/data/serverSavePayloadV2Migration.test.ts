import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/202609210001_server_save_payload_v2.sql",
  ),
  "utf8",
);

describe("server save payload V2 migration", () => {
  it(
    "reconstructs the replay response in Postgres instead of accepting p_response",
    () => {
      expect(migration).toContain(
        "create or replace function public.apply_game_operation_v2",
      );
      expect(migration).toContain("p_outcome jsonb");
      expect(migration).not.toContain("p_response jsonb");
      expect(migration).toContain("v_response := jsonb_build_object");
      expect(migration).toContain("'state', p_state");
      expect(migration).toContain("'teamSelection', p_team_selection");
    },
  );

  it(
    "keeps exact replay behavior but returns no large response on the first write",
    () => {
      expect(migration).toContain(
        "return query select v_existing_response, true",
      );
      expect(migration).toContain("return query select null::jsonb, false");
      expect(migration).toContain("v_response");
      expect(migration).toContain("offset 128");
    },
  );

  it(
    "keeps the existing RPC available during a backwards-compatible rollout",
    () => {
      expect(migration).not.toContain(
        "drop function public.apply_game_operation",
      );
    },
  );
});
