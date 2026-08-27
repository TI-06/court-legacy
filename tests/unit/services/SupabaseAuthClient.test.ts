import { vi } from "vitest";
import {
  SupabaseAuthClient,
  type SupabaseAuthPort,
} from "../../../src/services/auth/SupabaseAuthClient";

const supabaseSession = {
  access_token: "access-token",
  user: { id: "user-123", email: "Coach@Example.com" },
};

function authPort(overrides: Partial<SupabaseAuthPort> = {}): SupabaseAuthPort {
  return {
    getSession: vi.fn().mockResolvedValue({
      data: { session: supabaseSession },
      error: null,
    }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    signInWithEmailOtp: vi.fn().mockResolvedValue({ error: null }),
    signInWithGoogleOAuth: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe("SupabaseAuthClient", () => {
  it("maps the current Supabase session into the browser auth contract", async () => {
    const client = new SupabaseAuthClient(
      authPort(),
      "https://court-legacy.example",
    );

    await expect(client.getSession()).resolves.toEqual({
      userId: "user-123",
      email: "Coach@Example.com",
      accessToken: "access-token",
    });
  });

  it("starts Google OAuth with the current origin as the redirect target", async () => {
    const signInWithGoogleOAuth = vi.fn().mockResolvedValue({ error: null });
    const client = new SupabaseAuthClient(
      authPort({ signInWithGoogleOAuth }),
      "https://court-legacy.example",
    );

    await client.signInWithGoogle();

    expect(signInWithGoogleOAuth).toHaveBeenCalledWith({
      redirectTo: "https://court-legacy.example",
    });
  });

  it("normalizes email and requests a magic-link login", async () => {
    const signInWithEmailOtp = vi.fn().mockResolvedValue({ error: null });
    const client = new SupabaseAuthClient(
      authPort({ signInWithEmailOtp }),
      "https://court-legacy.example",
    );

    await client.signInWithEmail("  Coach@Example.COM ");

    expect(signInWithEmailOtp).toHaveBeenCalledWith({
      email: "coach@example.com",
      emailRedirectTo: "https://court-legacy.example",
    });
  });

  it("maps auth state changes and returns an unsubscribe function", () => {
    let authListener:
      ((session: typeof supabaseSession | null) => void) | undefined;
    const unsubscribe = vi.fn();
    const onAuthStateChange = vi.fn((listener) => {
      authListener = listener;
      return { data: { subscription: { unsubscribe } } };
    });
    const client = new SupabaseAuthClient(
      authPort({ onAuthStateChange }),
      "https://court-legacy.example",
    );
    const listener = vi.fn();

    const stop = client.subscribe(listener);
    authListener?.(supabaseSession);
    authListener?.(null);
    stop();

    expect(listener).toHaveBeenNthCalledWith(1, {
      userId: "user-123",
      email: "Coach@Example.com",
      accessToken: "access-token",
    });
    expect(listener).toHaveBeenNthCalledWith(2, null);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("surfaces Supabase auth errors to the UI layer", async () => {
    const client = new SupabaseAuthClient(
      authPort({
        signInWithEmailOtp: vi
          .fn()
          .mockResolvedValue({ error: new Error("rate limited") }),
      }),
      "https://court-legacy.example",
    );

    await expect(client.signInWithEmail("coach@example.com")).rejects.toThrow(
      "rate limited",
    );
  });
});
