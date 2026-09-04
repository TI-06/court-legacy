import { describe, expect, it, vi } from "vitest";
import type { AccountAuthService } from "../../../worker/auth/AccountAuthService";
import { InvalidAccountCredentialsError } from "../../../worker/auth/AccountAuthService";
import type { GameStore } from "../../../worker/data/GameStore";
import { createRouter } from "../../../worker/router";

function gameStore(): GameStore {
  return {
    getSnapshot: vi.fn(async () => null),
    getOperationResponse: vi.fn(async () => null),
    createGame: vi.fn(async () => {
      throw new Error("not used");
    }),
    applyOperation: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

function accountAuth(overrides: Partial<AccountAuthService> = {}): AccountAuthService {
  return {
    register: vi.fn(async (input) => ({
      session: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        userId: "user-123",
        email: input.email,
      },
      profile: {
        userId: "user-123",
        loginId: input.loginId,
        email: input.email,
        coachName: input.coachName,
        schoolName: input.schoolName,
      },
    })),
    login: vi.fn(async () => ({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      userId: "user-123",
      email: "coach@example.com",
    })),
    getProfile: vi.fn(async () => ({
      userId: "user-123",
      loginId: "coach.taku",
      email: "coach@example.com",
      coachName: "高城 監督",
      schoolName: "青葉高校",
    })),
    ...overrides,
  };
}

function router(auth: AccountAuthService) {
  return createRouter({
    accountAuth: auth,
    store: gameStore(),
    verifyAccessToken: vi.fn(async (token) => {
      if (token !== "valid-token") throw new Error("invalid token");
      return { id: "user-123" };
    }),
  });
}

describe("account auth routes", () => {
  it("allows registration without an existing bearer token and normalizes account fields", async () => {
    const auth = accountAuth();
    const response = await router(auth)(
      new Request("https://court-legacy.test/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "  Coach@Example.COM  ",
          loginId: "  Coach.Taku  ",
          password: "password123",
          coachName: "  高城 監督  ",
          schoolName: "  青葉高校  ",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(auth.register).toHaveBeenCalledWith({
      email: "coach@example.com",
      loginId: "coach.taku",
      password: "password123",
      coachName: "高城 監督",
      schoolName: "青葉高校",
    });
  });

  it("returns the same structured credential error for a failed ID login", async () => {
    const auth = accountAuth({
      login: vi.fn(async () => {
        throw new InvalidAccountCredentialsError();
      }),
    });
    const response = await router(auth)(
      new Request("https://court-legacy.test/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId: "missing-user", password: "wrong" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_credentials",
        message: "ログインIDまたはパスワードが正しくありません",
      },
    });
  });

  it("keeps account profile private behind bearer authentication", async () => {
    const auth = accountAuth();
    const route = router(auth);

    const unauthenticated = await route(
      new Request("https://court-legacy.test/api/account/profile"),
    );
    expect(unauthenticated.status).toBe(401);
    expect(auth.getProfile).not.toHaveBeenCalled();

    const authenticated = await route(
      new Request("https://court-legacy.test/api/account/profile", {
        headers: { authorization: "Bearer valid-token" },
      }),
    );
    expect(authenticated.status).toBe(200);
    await expect(authenticated.json()).resolves.toEqual({
      loginId: "coach.taku",
      coachName: "高城 監督",
      schoolName: "青葉高校",
    });
  });
});
