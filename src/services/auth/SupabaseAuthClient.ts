import { createClient } from "@supabase/supabase-js";
import type {
  AccountRegistrationInput,
  AuthClient,
  AuthSession,
} from "./AuthClient";

interface SupabaseSessionLike {
  access_token: string;
  user: {
    id: string;
    email?: string | null;
  };
}

interface SupabaseResult {
  error: Error | null;
}

interface WorkerAuthResponse {
  session?: {
    accessToken?: unknown;
    refreshToken?: unknown;
  };
  error?: {
    message?: unknown;
  };
}

export interface SupabaseAuthPort {
  getSession(): Promise<{
    data: { session: SupabaseSessionLike | null };
    error: Error | null;
  }>;
  onAuthStateChange(listener: (session: SupabaseSessionLike | null) => void): {
    data: { subscription: { unsubscribe(): void } };
  };
  setSession(input: {
    access_token: string;
    refresh_token: string;
  }): Promise<{
    data: { session: SupabaseSessionLike | null };
    error: Error | null;
  }>;
  resetPasswordForEmail(input: {
    email: string;
    redirectTo: string;
  }): Promise<SupabaseResult>;
  updatePassword(password: string): Promise<SupabaseResult>;
  signOut(): Promise<SupabaseResult>;
}

export interface BrowserAuthEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

function mapSession(session: SupabaseSessionLike | null): AuthSession | null {
  if (!session) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    accessToken: session.access_token,
  };
}

function throwIfError(error: Error | null): void {
  if (error) {
    throw error;
  }
}

function authTokens(payload: WorkerAuthResponse): {
  access_token: string;
  refresh_token: string;
} {
  const accessToken = payload.session?.accessToken;
  const refreshToken = payload.session?.refreshToken;
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    throw new Error("認証サーバーから正しい応答を受信できませんでした");
  }
  return { access_token: accessToken, refresh_token: refreshToken };
}

export class SupabaseAuthClient implements AuthClient {
  constructor(
    private readonly auth: SupabaseAuthPort,
    private readonly redirectOrigin: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly locationSearch: () => string = () =>
      globalThis.location.search,
  ) {}

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.auth.getSession();
    throwIfError(error);
    return mapSession(data.session);
  }

  subscribe(listener: (session: AuthSession | null) => void): () => void {
    const { data } = this.auth.onAuthStateChange((session) => {
      listener(mapSession(session));
    });
    return () => data.subscription.unsubscribe();
  }

  async signInWithCredentials(
    loginId: string,
    password: string,
  ): Promise<void> {
    const payload = await this.workerAuthRequest("/api/auth/login", {
      loginId: loginId.trim().toLowerCase(),
      password,
    });
    const { error } = await this.auth.setSession(authTokens(payload));
    throwIfError(error);
  }

  async registerAccount(input: AccountRegistrationInput): Promise<void> {
    const payload = await this.workerAuthRequest("/api/auth/register", {
      email: input.email.trim().toLowerCase(),
      loginId: input.loginId.trim().toLowerCase(),
      password: input.password,
      coachName: input.coachName.trim(),
      schoolName: input.schoolName.trim(),
    });
    const { error } = await this.auth.setSession(authTokens(payload));
    throwIfError(error);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const redirectTo = `${this.redirectOrigin}?reset-password=1`;
    const { error } = await this.auth.resetPasswordForEmail({
      email: normalizedEmail,
      redirectTo,
    });
    throwIfError(error);
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.auth.updatePassword(password);
    throwIfError(error);
  }

  isPasswordRecovery(): boolean {
    return new URLSearchParams(this.locationSearch()).get("reset-password") === "1";
  }

  async signOut(): Promise<void> {
    const { error } = await this.auth.signOut();
    throwIfError(error);
  }

  private async workerAuthRequest(
    path: string,
    body: Record<string, string>,
  ): Promise<WorkerAuthResponse> {
    let response: Response;
    try {
      response = await this.fetchImpl(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("認証サーバーに接続できませんでした");
    }

    let payload: WorkerAuthResponse = {};
    try {
      payload = (await response.json()) as WorkerAuthResponse;
    } catch {
      // The generic error below avoids exposing server internals.
    }
    if (!response.ok) {
      const message = payload.error?.message;
      throw new Error(
        typeof message === "string"
          ? message
          : "アカウント認証を完了できませんでした",
      );
    }
    return payload;
  }
}

export function createSupabaseAuthPort(
  url: string,
  publishableKey: string,
): SupabaseAuthPort {
  const client = createClient(url, publishableKey);

  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      return {
        data: { session: data.session },
        error,
      };
    },
    onAuthStateChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(session);
      });
      return { data };
    },
    async setSession(input) {
      const { data, error } = await client.auth.setSession(input);
      return { data: { session: data.session }, error };
    },
    async resetPasswordForEmail({ email, redirectTo }) {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      return { error };
    },
    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      return { error };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      return { error };
    },
  };
}

function browserEnvironment(): BrowserAuthEnvironment {
  return {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env
      .VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function createSupabaseAuthClient(
  env: BrowserAuthEnvironment = browserEnvironment(),
  redirectOrigin: string = globalThis.location.origin,
): AuthClient {
  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    throw new Error("Supabase authentication is not configured");
  }

  return new SupabaseAuthClient(
    createSupabaseAuthPort(url, publishableKey),
    redirectOrigin,
  );
}
