import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "../env";

export interface AuthenticatedUser {
  id: string;
}

export type VerifyAccessToken = (token: string) => Promise<AuthenticatedUser>;

type AccessTokenEnvironment = Pick<Env, "SUPABASE_URL">;

const jwksResolvers = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function normalizeSupabaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new Error("SUPABASE_URL is required");
  }
  return normalized;
}

function getJwksResolver(supabaseUrl: string) {
  const cached = jwksResolvers.get(supabaseUrl);
  if (cached) {
    return cached;
  }

  const resolver = createRemoteJWKSet(
    new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
  );
  jwksResolvers.set(supabaseUrl, resolver);
  return resolver;
}

export function createVerifyAccessToken(
  env: AccessTokenEnvironment,
): VerifyAccessToken {
  const supabaseUrl = normalizeSupabaseUrl(env.SUPABASE_URL);
  const jwks = getJwksResolver(supabaseUrl);

  return async (token) => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: "authenticated",
    });

    if (typeof payload.sub !== "string" || !payload.sub.trim()) {
      throw new Error("missing subject");
    }

    return { id: payload.sub };
  };
}
