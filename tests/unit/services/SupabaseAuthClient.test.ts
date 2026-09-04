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
    setSession: vi.fn().mockResolvedValue({
      data: { session: supabaseSession },
      error: null,
    }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

function workerResponse(status = 200) {
  return new Response(
    JSON.stringify({
      session: {
        accessToken: "worker-access",
        refreshToken: "worker-refresh",
      },
    }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
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

  it("logs in with normalized ID through the Worker and installs the returned session", async () => {
    const setSession = vi.fn().mockResolvedValue({
      data: { session: supabaseSession },
      error: null,
    });
    const fetchImpl = vi.fn().mockResolvedValue(workerResponse());
    const client = new SupabaseAuthClient(
      authPort({ setSession }),
      "https://court-legacy.example",
      fetchImpl,
    );

    await client.signInWithCredentials("  Coach.TAKU  ", "password123");

    expect(fetchImpl).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId: "coach.taku", password: "password123" }),
    });
    expect(setSession).toHaveBeenCalledWith({
      access_token: "worker-access",
      refresh_token: "worker-refresh",
    });
  });

  it("registers account details through the Worker and installs the session", async () => {
    const setSession = vi.fn().mockResolvedValue({
      data: { session: supabaseSession },
      error: null,
    });
    const fetchImpl = vi.fn().mockResolvedValue(workerResponse(201));
    const client = new SupabaseAuthClient(
      authPort({ setSession }),
      "https://court-legacy.example",
      fetchImpl,
    );

    await client.registerAccount({
      email: " Coach@Example.COM ",
      loginId: " Coach.TAKU ",
      password: "password123",
      coachName: " 高城 監督 ",
      schoolName: " 青葉高校 ",
    });

    expect(fetchImpl).toHaveBeenCalledWith("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "coach@example.com",
        loginId: "coach.taku",
        password: "password123",
        coachName: "高城 監督",
        schoolName: "青葉高校",
      }),
    });
    expect(setSession).toHaveBeenCalledWith({
      access_token: "worker-access",
      refresh_token: "worker-refresh",
    });
  });

  it("sends a password reset link back to the app", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    const client = new SupabaseAuthClient(
      authPort({ resetPasswordForEmail }),
      "https://court-legacy.example",
    );

    await client.requestPasswordReset(" Coach@Example.COM ");

    expect(resetPasswordForEmail).toHaveBeenCalledWith({
      email: "coach@example.com",
      redirectTo: "https://court-legacy.example?reset-password=1",
    });
  });

  it("updates the password through the recovery session", async () => {
    const updatePassword = vi.fn().mockResolvedValue({ error: null });
    const client = new SupabaseAuthClient(
      authPort({ updatePassword }),
      "https://court-legacy.example",
    );

    await client.updatePassword("new-password-123");

    expect(updatePassword).toHaveBeenCalledWith("new-password-123");
  });

  it("detects password recovery from the redirect query", () => {
    const client = new SupabaseAuthClient(
      authPort(),
      "https://court-legacy.example",
      fetch,
      () => "?reset-password=1",
    );

    expect(client.isPasswordRecovery()).toBe(true);
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

  it("surfaces Worker auth errors to the UI layer", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "IDまたはパスワードが違います" },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );
    const client = new SupabaseAuthClient(
      authPort(),
      "https://court-legacy.example",
      fetchImpl,
    );

    await expect(
      client.signInWithCredentials("coach.taku", "wrong-password"),
    ).rejects.toThrow("IDまたはパスワードが違います");
  });
});
