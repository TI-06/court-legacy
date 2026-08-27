import type { AuthGateway, AuthSession, SignUpResult } from "./AuthGateway";
import { SupabaseHttpAuthGateway } from "./SupabaseHttpAuthGateway";

interface BrowserAuthEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_E2E_AUTH_BYPASS?: string;
}

interface CreateBrowserAuthGatewayInput {
  env?: BrowserAuthEnvironment;
  fetchImpl?: typeof fetch;
}

const E2E_SESSION: AuthSession = {
  accessToken: "e2e-access-token",
  refreshToken: "e2e-refresh-token",
  expiresAt: 9_007_199_254_740_991,
  user: {
    id: "e2e-user",
    email: "e2e@court-legacy.test",
  },
};

class StaticAuthGateway implements AuthGateway {
  async restoreSession(): Promise<AuthSession> {
    return E2E_SESSION;
  }

  async signInWithPassword(): Promise<AuthSession> {
    return E2E_SESSION;
  }

  async signUpWithPassword(): Promise<SignUpResult> {
    return { session: E2E_SESSION };
  }

  signInWithGoogle(): void {}

  async signOut(): Promise<void> {}
}

class UnavailableAuthGateway implements AuthGateway {
  private error(): Error {
    return new Error("Supabase authentication is not configured");
  }

  async restoreSession(): Promise<AuthSession | null> {
    throw this.error();
  }

  async signInWithPassword(): Promise<AuthSession> {
    throw this.error();
  }

  async signUpWithPassword(): Promise<SignUpResult> {
    throw this.error();
  }

  signInWithGoogle(): void {}

  async signOut(): Promise<void> {}
}

function browserEnvironment(): BrowserAuthEnvironment {
  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env
      .VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_E2E_AUTH_BYPASS: import.meta.env.VITE_E2E_AUTH_BYPASS,
  };
}

export function createBrowserAuthGateway(
  input: CreateBrowserAuthGatewayInput = {},
): AuthGateway {
  const env = input.env ?? browserEnvironment();

  if (env.VITE_E2E_AUTH_BYPASS === "true") {
    return new StaticAuthGateway();
  }

  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    return new UnavailableAuthGateway();
  }

  return new SupabaseHttpAuthGateway({
    url,
    publishableKey,
    fetchImpl: input.fetchImpl,
  });
}
