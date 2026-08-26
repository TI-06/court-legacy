import { describe, expect, it, vi } from "vitest";
import type { GameStore } from "../../../worker/data/GameStore";
import { createRouter } from "../../../worker/router";

function apiRequest(path: string, init?: RequestInit): Request {
  return new Request(`https://court-legacy.test${path}`, init);
}

function createStore(): GameStore {
  return {
    getSnapshot: vi.fn(async () => null),
    createGame: vi.fn(async () => {
      throw new Error("not used");
    }),
    applyOperation: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

describe("createRouter", () => {
  it("serves health without authentication", async () => {
    const verifyAccessToken = vi.fn();
    const store = createStore();
    const router = createRouter({ verifyAccessToken, store });

    const response = await router(apiRequest("/api/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(store.getSnapshot).not.toHaveBeenCalled();
  });

  it("rejects protected API requests without a bearer token", async () => {
    const router = createRouter({
      verifyAccessToken: vi.fn(),
      store: createStore(),
    });

    const response = await router(apiRequest("/api/bootstrap"));

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
    const router = createRouter({
      verifyAccessToken,
      store: createStore(),
    });

    const response = await router(
      apiRequest("/api/bootstrap", {
        headers: { authorization: "Basic credentials" },
      }),
    );

    expect(response.status).toBe(401);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("uses the verified user id for authenticated bootstrap reads", async () => {
    const verifyAccessToken = vi.fn(async () => ({ id: "user-123" }));
    const store = createStore();
    const router = createRouter({ verifyAccessToken, store });

    const response = await router(
      apiRequest("/api/bootstrap", {
        headers: { authorization: "Bearer access-token" },
      }),
    );

    expect(verifyAccessToken).toHaveBeenCalledWith("access-token");
    expect(store.getSnapshot).toHaveBeenCalledWith("user-123");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "needs-onboarding",
    });
  });

  it("returns a structured 404 for an authenticated unknown API route", async () => {
    const router = createRouter({
      verifyAccessToken: vi.fn(async () => ({ id: "user-123" })),
      store: createStore(),
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
