import { vi } from "vitest";
import { createBrowserAuthGateway } from "../../../src/auth/createBrowserAuthGateway";

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("createBrowserAuthGateway", () => {
  it("uses an explicit authenticated test session only when the E2E bypass flag is enabled", async () => {
    const gateway = createBrowserAuthGateway({
      env: { VITE_E2E_AUTH_BYPASS: "true" },
    });

    const session = await gateway.restoreSession();

    expect(session?.user.email).toBe("e2e@court-legacy.test");
    expect(session?.accessToken).toBe("e2e-access-token");
  });

  it("creates the Supabase gateway when browser configuration is present", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_at: 2_000_000_000,
        user: { id: "user-1", email: "coach@example.com" },
      }),
    );
    const gateway = createBrowserAuthGateway({
      env: {
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      },
      fetchImpl,
    });

    await gateway.signInWithPassword("coach@example.com", "password123");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.supabase.co/auth/v1/token?grant_type=password",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fails closed when production authentication configuration is missing", async () => {
    const gateway = createBrowserAuthGateway({ env: {} });

    await expect(gateway.restoreSession()).rejects.toThrow(
      "Supabase authentication is not configured",
    );
  });
});
