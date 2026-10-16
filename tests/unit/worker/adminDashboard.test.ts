import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseAdminClient } from "../../../worker/data/createSupabaseAdmin";
import { createAdminHandler } from "../../../worker/admin/adminHandler";

const origin = "https://court-legacy.example";
const settings = {
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "admintest",
  ADMIN_SESSION_SECRET: "test-only-strong-session-secret-1234567890",
};
let seconds = 1_792_200_000;
let claimCount = 0;

function fakeDatabase() {
  return {
    rpc: vi.fn(async (name: string) => {
      if (name === "admin_claim_login_attempt") {
        claimCount += 1;
        return { data: claimCount <= 5, error: null };
      }
      if (name === "admin_dashboard_summary") {
        return { data: { accounts: { total: 18 } }, error: null };
      }
      if (name === "admin_dashboard_accounts") {
        return { data: { rows: [], total: 0 }, error: null };
      }
      return { data: null, error: { message: "missing RPC" } };
    }),
  };
}

function request(path: string, init: RequestInit = {}) {
  return new Request(origin + path, init);
}

function loginRequest(
  username: string,
  password: string,
  extra: HeadersInit = {},
) {
  return request("/api/admin/login", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.4",
      ...extra,
    },
    body: JSON.stringify({ username, password }),
  });
}

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  claimCount = 0;
  seconds = 1_792_200_000;
});
afterEach(() => vi.unstubAllGlobals());

describe("admin management authentication", () => {
  it("fails closed without deployment secrets", async () => {
    const db = fakeDatabase();
    const admin = createAdminHandler(
      {},
      () => db as unknown as SupabaseAdminClient,
    );
    const response = await admin(request("/api/admin/session"));
    expect(response.status).toBe(503);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("requires same-origin login and independently rate limits attempts", async () => {
    const db = fakeDatabase();
    const admin = createAdminHandler(
      settings,
      () => db as unknown as SupabaseAdminClient,
    );
    expect(
      (
        await admin(
          loginRequest("admin", "wrong", {
            origin: "https://elsewhere.example",
          }),
        )
      ).status,
    ).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();

    for (let i = 0; i < 5; i += 1) {
      const response = await admin(loginRequest("admin", "wrong"));
      expect(response.status).toBe(401);
    }
    const blocked = await admin(loginRequest("admin", "admintest"));
    expect(blocked.status).toBe(429);
    expect(db.rpc).toHaveBeenCalledTimes(6);
  });

  it("signs an HttpOnly cookie, rejects tampering/expiry and never calls regular game auth", async () => {
    const db = fakeDatabase();
    const admin = createAdminHandler(
      settings,
      () => db as unknown as SupabaseAdminClient,
      () => seconds,
    );
    const denied = await admin(request("/api/admin/overview"));
    expect(denied.status).toBe(401);
    expect(db.rpc).not.toHaveBeenCalled();

    const login = await admin(loginRequest("admin", "admintest"));
    expect(login.status).toBe(200);
    const setCookie = login.headers.get("set-cookie")!;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Secure");
    expect(setCookie).not.toContain("admintest");
    const cookie = setCookie.split(";")[0]!;
    const overview = await admin(
      request("/api/admin/overview", { headers: { cookie } }),
    );
    expect(overview.status).toBe(200);
    expect((await overview.json()).accounts.total).toBe(18);
    expect(overview.headers.get("cache-control")).toContain("no-store");

    const tampered = cookie.replace(/.$/, "z");
    expect(
      (
        await admin(
          request("/api/admin/overview", { headers: { cookie: tampered } }),
        )
      ).status,
    ).toBe(401);
    const list = await admin(
      request("/api/admin/accounts?search=a&offset=0", { headers: { cookie } }),
    );
    expect(list.status).toBe(200);

    seconds += 7201;
    expect(
      (await admin(request("/api/admin/overview", { headers: { cookie } })))
        .status,
    ).toBe(401);
  });

  it("logs out via same origin and clears cookie", async () => {
    const db = fakeDatabase();
    const admin = createAdminHandler(
      settings,
      () => db as unknown as SupabaseAdminClient,
    );
    expect(
      (await admin(request("/api/admin/logout", { method: "POST" }))).status,
    ).toBe(403);
    const logout = await admin(
      request("/api/admin/logout", { method: "POST", headers: { origin } }),
    );
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
