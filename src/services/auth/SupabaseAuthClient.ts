import { createClient } from "@supabase/supabase-js";
import type { AuthClient, AuthSession } from "./AuthClient";

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

export interface SupabaseAuthPort {
  getSession(): Promise<{
    data: { session: SupabaseSessionLike | null };
    error: Error | null;
  }>;
  onAuthStateChange(
    listener: (session: SupabaseSessionLike | null) => void,
  ): { data: { subscription: { unsubscribe(): void } } };
  signInWithEmailOtp(input: {
    email: string;
    emailRedirectTo: string;
  }): Promise<SupabaseResult>;
  signInWithGoogleOAuth(input: {
    redirectTo: string;
  }): Promise<SupabaseResult>;
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

export class SupabaseAuthClient implements AuthClient {
  constructor(
    private readonly auth: SupabaseAuthPort,
    private readonly redirectOrigin: string,
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

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.auth.signInWithGoogleOAuth({
      redirectTo: this.redirectOrigin,
    });
    throwIfError(error);
  }

  async signInWithEmail(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await this.auth.signInWithEmailOtp({
      email: normalizedEmail,
      emailRedirectTo: this.redirectOrigin,
    });
    throwIfError(error);
  }

  async signOut(): Promise<void> {
    const { error } = await this.auth.signOut();
    throwIfError(error);
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
    async signInWithEmailOtp({ email, emailRedirectTo }) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });
      return { error };
    },
    async signInWithGoogleOAuth({ redirectTo }) {
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
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
