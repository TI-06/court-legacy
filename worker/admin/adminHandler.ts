import type { SupabaseAdminClient } from "../data/createSupabaseAdmin";
import { json, jsonError } from "../http/json";

export interface AdminEnvironment {
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
}

const cookieName = "court_admin_session";
const sessionLifetimeSeconds = 2 * 60 * 60;
const encoder = new TextEncoder();

function noStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store, private, max-age=0");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  return new Response(response.body, { status: response.status, headers });
}

function getCookie(request: Request): string | null {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === cookieName) return value.join("=") || null;
  }
  return null;
}

function base64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[a-zA-Z0-9_-]{43}$/.test(value)) return null;
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  try {
    const decoded = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sessionKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function createSession(secret: string, now: number): Promise<string> {
  const expires = now + sessionLifetimeSeconds;
  const payload = `admin-v1:${expires}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await sessionKey(secret),
    encoder.encode(payload),
  );
  return `${expires}.${base64Url(signature)}`;
}

async function validSession(
  value: string | null,
  secret: string,
  now: number,
): Promise<boolean> {
  if (!value) return false;
  const [exp, sig, extra] = value.split(".");
  if (extra !== undefined || !exp || !sig || !/^\d{10}$/.test(exp))
    return false;
  const expires = Number(exp);
  if (expires <= now || expires > now + sessionLifetimeSeconds) return false;
  const signature = fromBase64Url(sig);
  if (!signature) return false;
  return crypto.subtle.verify(
    "HMAC",
    await sessionKey(secret),
    signature,
    encoder.encode(`admin-v1:${exp}`),
  );
}

async function equalCredentials(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const x = new Uint8Array(left);
  const y = new Uint8Array(right);
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

async function throttleKey(secret: string, request: Request): Promise<string> {
  const address = request.headers.get("cf-connecting-ip") ?? "unknown";
  const hash = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${secret}:admin-login:${address}`),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function sameOriginPost(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

function sessionCookie(
  request: Request,
  value: string,
  maxAge: number,
): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function respond(data: unknown, status = 200, cookie?: string): Response {
  const headers = cookie ? { "set-cookie": cookie } : undefined;
  return noStore(json(data, { status, headers }));
}

function failure(status: number, code: string, message: string): Response {
  return noStore(jsonError(status, code, message));
}

export function createAdminHandler(
  environment: AdminEnvironment,
  getDatabase: () => SupabaseAdminClient,
  nowSeconds: () => number = () => Math.floor(Date.now() / 1000),
): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const username = environment.ADMIN_USERNAME?.trim() || "admin";
    const password = environment.ADMIN_PASSWORD;
    const secret = environment.ADMIN_SESSION_SECRET;
    if (!password || !secret || secret.length < 32) {
      return failure(
        503,
        "admin_not_configured",
        "管理画面の認証設定が未完了です",
      );
    }

    if (url.pathname === "/api/admin/session" && request.method === "GET") {
      return respond({
        authenticated: await validSession(
          getCookie(request),
          secret,
          nowSeconds(),
        ),
      });
    }

    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      if (!sameOriginPost(request)) {
        return failure(403, "forbidden", "不正なアクセスです");
      }
      let input: unknown;
      try {
        const raw = await request.text();
        if (raw.length > 1024)
          return failure(400, "invalid_request", "入力を確認してください");
        input = JSON.parse(raw) as unknown;
      } catch {
        return failure(400, "invalid_request", "入力を確認してください");
      }
      if (
        !input ||
        typeof input !== "object" ||
        !("username" in input) ||
        !("password" in input) ||
        typeof input.username !== "string" ||
        typeof input.password !== "string"
      ) {
        return failure(400, "invalid_request", "入力を確認してください");
      }
      try {
        const key = await throttleKey(secret, request);
        const { data: allowed, error } = await getDatabase().rpc(
          "admin_claim_login_attempt",
          { p_key: key },
        );
        if (error) throw error;
        if (allowed !== true)
          return failure(
            429,
            "too_many_attempts",
            "ログイン回数の上限に達しました。15分後にお試しください",
          );
      } catch {
        return failure(
          503,
          "admin_unavailable",
          "認証サービスを利用できません",
        );
      }
      const correctUser = await equalCredentials(input.username, username);
      const correctPassword = await equalCredentials(input.password, password);
      if (!correctUser || !correctPassword) {
        return failure(
          401,
          "invalid_credentials",
          "IDまたはパスワードが違います",
        );
      }
      const token = await createSession(secret, nowSeconds());
      return respond(
        { authenticated: true },
        200,
        sessionCookie(request, token, sessionLifetimeSeconds),
      );
    }

    if (url.pathname === "/api/admin/logout" && request.method === "POST") {
      if (!sameOriginPost(request))
        return failure(403, "forbidden", "不正なアクセスです");
      return respond(
        { authenticated: false },
        200,
        sessionCookie(request, "", 0),
      );
    }

    if (!(await validSession(getCookie(request), secret, nowSeconds()))) {
      return failure(
        401,
        "admin_unauthorized",
        "管理画面へのログインが必要です",
      );
    }

    if (url.pathname === "/api/admin/overview" && request.method === "GET") {
      try {
        const { data, error } = await getDatabase().rpc(
          "admin_dashboard_summary",
        );
        if (error || !data || typeof data !== "object")
          throw error ?? new Error("invalid summary");
        return respond(data);
      } catch {
        return failure(
          503,
          "admin_data_unavailable",
          "集計情報を取得できません。DBの更新状況を確認してください",
        );
      }
    }

    if (url.pathname === "/api/admin/accounts" && request.method === "GET") {
      const search = (url.searchParams.get("search") ?? "").trim();
      const offset = Number(url.searchParams.get("offset") ?? "0");
      const limit = 25;
      if (
        search.length > 100 ||
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset > 10000
      ) {
        return failure(400, "invalid_query", "検索条件を確認してください");
      }
      try {
        const { data, error } = await getDatabase().rpc(
          "admin_dashboard_accounts",
          {
            p_search: search,
            p_offset: offset,
            p_limit: limit,
          },
        );
        if (error || !data || typeof data !== "object")
          throw error ?? new Error("invalid accounts");
        return respond(data);
      } catch {
        return failure(
          503,
          "admin_data_unavailable",
          "アカウント一覧を取得できません",
        );
      }
    }

    return failure(404, "not_found", "API route not found");
  };
}
