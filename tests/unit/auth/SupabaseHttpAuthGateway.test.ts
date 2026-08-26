import { vi } from "vitest";
import { SupabaseHttpAuthGateway } from "../../../src/auth/SupabaseHttpAuthGateway";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const authPayload = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_at: 2_000_000_000,
  user: { id: "user-1", email: "coach@example.com" },
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createGateway(fetchImpl: typeof fetch, storage = new MemoryStorage()) {
  return {
    storage,
    gateway: new SupabaseHttpAuthGateway({
      url: "https://example.supabase.co",
      publishableKey: "publishable-key",
      fetchImpl,
      storage,
      location: {
        origin: "https://court.example.com",
        hash: "",
        assign: vi.fn(),
        replace: vi.fn(),
      },
    }),
  };
}

describe("SupabaseHttpAuthGateway", () => {
  it("signs in with password, sends the publishable key, and persists the session", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(authPayload));
    const { gateway, storage } = createGateway(fetchImpl);

    const session = await gateway.signInWithPassword(
      "coach@example.com",
      "password123",
    );

    expect(session.user).toEqual({ id: "user-1", email: "coach@example.com" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      "https://example.supabase.co/auth/v1/token?grant_type=password",
    );
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      apikey: "publishable-key",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "coach@example.com",
      password: "password123",
    });
    expect(storage.getItem("court-legacy.auth.session.v1")).toContain(
      "access-token",
    );
  });

  it("restores a stored session only after validating it with the auth server", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "court-legacy.auth.session.v1",
      JSON.stringify({
        accessToken: "stored-access",
        refreshToken: "stored-refresh",
        expiresAt: 2_000_000_000,
        user: { id: "user-1", email: "old@example.com" },
      }),
    );
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response({ id: "user-1", email: "coach@example.com" }),
      );
    const { gateway } = createGateway(fetchImpl, storage);

    const restored = await gateway.restoreSession();

    expect(restored?.user.email).toBe("coach@example.com");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/user",
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "publishable-key",
          authorization: "Bearer stored-access",
        }),
      }),
    );
  });

  it("refreshes an expired stored session before returning it", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "court-legacy.auth.session.v1",
      JSON.stringify({
        accessToken: "expired-access",
        refreshToken: "stored-refresh",
        expiresAt: 1,
        user: { id: "user-1", email: "coach@example.com" },
      }),
    );
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(authPayload))
      .mockResolvedValueOnce(
        response({ id: "user-1", email: "coach@example.com" }),
      );
    const { gateway } = createGateway(fetchImpl, storage);

    const restored = await gateway.restoreSession();

    expect(restored?.accessToken).toBe("access-token");
    const [refreshUrl, refreshInit] = fetchImpl.mock.calls[0]!;
    expect(refreshUrl).toBe(
      "https://example.supabase.co/auth/v1/token?grant_type=refresh_token",
    );
    expect(JSON.parse(String(refreshInit?.body))).toEqual({
      refresh_token: "stored-refresh",
    });
  });

  it("starts Google OAuth using the current origin as the redirect destination", () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const assign = vi.fn();
    const gateway = new SupabaseHttpAuthGateway({
      url: "https://example.supabase.co",
      publishableKey: "publishable-key",
      fetchImpl,
      storage: new MemoryStorage(),
      location: {
        origin: "https://court.example.com",
        hash: "",
        assign,
        replace: vi.fn(),
      },
    });

    gateway.signInWithGoogle();

    expect(assign).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fcourt.example.com",
    );
  });
});
