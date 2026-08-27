import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../env";

export type SupabaseAdminClient = SupabaseClient;

type SupabaseAdminEnvironment = Pick<
  Env,
  "SUPABASE_URL" | "SUPABASE_SECRET_KEY"
>;

function required(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${name} is required`);
  }
  return normalized;
}

export function createSupabaseAdmin(
  env: SupabaseAdminEnvironment,
): SupabaseAdminClient {
  const url = required(env.SUPABASE_URL, "SUPABASE_URL").replace(/\/+$/, "");
  const secretKey = required(env.SUPABASE_SECRET_KEY, "SUPABASE_SECRET_KEY");

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
