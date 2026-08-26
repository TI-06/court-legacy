import { describe, expect, it, vi } from "vitest";
import { createRouter } from "../../../worker/router";

function apiRequest(path: string, init?: RequestInit): Request {
  return new Request(`https://court-legacy.test${path}`, init);
}

describe("createRouter", () => {
  it("serves health without authentication", async () => {
    const verifyAccessToken = vi.fn();
    const router = createRouter({ verifyAccessToken });

    const response = await router(apiRequest("/api/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("rejects protected API requests without a bearer token", async () => {
    const router = createRouter({ verifyAccessToken: vi.fn() });

    const response = await router(apiRequest("/api/protected"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unauthenticated",
        message: "Authentication is required",
      },
    });
  });

  it("rejects malformed authorization headers without invoking verification", async () => {
    const verifyAccessToken = vi.fn();
    const router = createRouter({ verifyAccessToken });

    const response = await router(
      apiRequest("/api/protected", {
        headers: { authorization: "Basic credentials" },
      }),
    );

    expect(response.status).toBe(401);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("passes the verified user into authenticated handlers", async () => {
    const verifyAccessToken = vi.fn(async () => ({ id: "user-123" }));
    const handleAuthenticatedRequest = vi.fn(async (_request, user) =>
      Response.json({ userId: user.id }),
    );
    const router = createRouter({
      verifyAccessToken,
      handleAuthenticatedRequest,
    });

    const response = await router(
      apiRequest("/api/protected", {
        headers: { authorization: "Bearer access-token" },
      }),
    );

    expect(verifyAccessToken).toHaveBeenCalledWith("access-token");
    expect(handleAuthenticatedRequest).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ userId: "user-123" });
  });

  it("returns a structured 404 for an authenticated unknown API route", async () => {
    const router = createRouter({
      verifyAccessToken: vi.fn(async () => ({ id: "user-123" })),
    });

    const response = await router(
      apiRequest("/api/unknown", {
        headers: { authorization: "Bearer access-token" },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "not_found",
        message: "API route not found",
      },
    });
  });
});
