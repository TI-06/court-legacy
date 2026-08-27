import type {
  AuthGateway,
  AuthSession,
  AuthUser,
  SignUpResult,
} from "./AuthGateway";

const SESSION_STORAGE_KEY = "court-legacy.auth.session.v1";
const SESSION_REFRESH_MARGIN_SECONDS = 30;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface LocationLike {
  origin: string;
  hash: string;
  assign(url: string): void;
  replace(url: string): void;
}

interface SupabaseHttpAuthGatewayInput {
  url: string;
  publishableKey: string;
  fetchImpl?: typeof fetch;
  storage?: StorageLike;
  location?: LocationLike;
}

interface AuthPayload {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_at?: unknown;
  expires_in?: unknown;
  user?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseUser(value: unknown): AuthUser {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error("invalid auth user response");
  }

  return {
    id: value.id,
    email: typeof value.email === "string" ? value.email : null,
  };
}

function parseAuthSession(payload: unknown): AuthSession {
  if (!isRecord(payload)) {
    throw new Error("invalid auth session response");
  }

  const authPayload = payload as AuthPayload;
  if (
    typeof authPayload.access_token !== "string" ||
    typeof authPayload.refresh_token !== "string"
  ) {
    throw new Error("auth response did not include a session");
  }

  let expiresAt: number;
  if (typeof authPayload.expires_at === "number") {
    expiresAt = authPayload.expires_at;
  } else if (typeof authPayload.expires_in === "number") {
    expiresAt = Math.floor(Date.now() / 1000) + authPayload.expires_in;
  } else {
    throw new Error("auth response did not include session expiry");
  }

  return {
    accessToken: authPayload.access_token,
    refreshToken: authPayload.refresh_token,
    expiresAt,
    user: parseUser(authPayload.user),
  };
}

function parseStoredSession(value: string): AuthSession {
  const parsed: unknown = JSON.parse(value);
  if (
    !isRecord(parsed) ||
    typeof parsed.accessToken !== "string" ||
    typeof parsed.refreshToken !== "string" ||
    typeof parsed.expiresAt !== "number"
  ) {
    throw new Error("invalid stored auth session");
  }

  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken,
    expiresAt: parsed.expiresAt,
    user: parseUser(parsed.user),
  };
}

export class SupabaseHttpAuthGateway implements AuthGateway {
  private readonly baseUrl: string;
  private readonly publishableKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly storage: StorageLike;
  private readonly location: LocationLike;

  constructor(input: SupabaseHttpAuthGatewayInput) {
    this.baseUrl = input.url.replace(/\/+$/, "");
    this.publishableKey = input.publishableKey;
    this.fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.storage = input.storage ?? globalThis.localStorage;
    this.location =
      input.location ??
      ({
        origin: globalThis.location.origin,
        hash: globalThis.location.hash,
        assign: (url: string) => globalThis.location.assign(url),
        replace: (url: string) => globalThis.location.replace(url),
      } satisfies LocationLike);
  }

  async restoreSession(): Promise<AuthSession | null> {
    let session = this.readStoredSession();
    if (!session) {
      return null;
    }

    try {
      if (this.shouldRefresh(session)) {
        session = await this.refreshSession(session.refreshToken);
      }

      const user = await this.fetchUser(session.accessToken);
      const restored = { ...session, user };
      this.persistSession(restored);
      return restored;
    } catch {
      this.storage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  }

  async signInWithPassword(
    email: string,
    password: string,
  ): Promise<AuthSession> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: this.jsonHeaders(),
        body: JSON.stringify({ email, password }),
      },
    );
    const payload = await this.readJson(response);
    const session = parseAuthSession(payload);
    this.persistSession(session);
    return session;
  }

  async signUpWithPassword(
    email: string,
    password: string,
  ): Promise<SignUpResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({ email, password }),
    });
    const payload = await this.readJson(response);

    if (
      isRecord(payload) &&
      typeof payload.access_token === "string" &&
      typeof payload.refresh_token === "string"
    ) {
      const session = parseAuthSession(payload);
      this.persistSession(session);
      return { session };
    }

    return { session: null };
  }

  signInWithGoogle(): void {
    const redirectTo = encodeURIComponent(this.location.origin);
    this.location.assign(
      `${this.baseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`,
    );
  }

  async signOut(): Promise<void> {
    const session = this.readStoredSession();

    try {
      if (session) {
        await this.fetchImpl(`${this.baseUrl}/auth/v1/logout`, {
          method: "POST",
          headers: this.authorizedHeaders(session.accessToken),
        });
      }
    } finally {
      this.storage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  private readStoredSession(): AuthSession | null {
    const stored = this.storage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    try {
      return parseStoredSession(stored);
    } catch {
      this.storage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
  }

  private persistSession(session: AuthSession): void {
    this.storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  private shouldRefresh(session: AuthSession): boolean {
    return (
      session.expiresAt <=
      Math.floor(Date.now() / 1000) + SESSION_REFRESH_MARGIN_SECONDS
    );
  }

  private async refreshSession(refreshToken: string): Promise<AuthSession> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: this.jsonHeaders(),
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );
    const session = parseAuthSession(await this.readJson(response));
    this.persistSession(session);
    return session;
  }

  private async fetchUser(accessToken: string): Promise<AuthUser> {
    const response = await this.fetchImpl(`${this.baseUrl}/auth/v1/user`, {
      headers: this.authorizedHeaders(accessToken),
    });
    return parseUser(await this.readJson(response));
  }

  private jsonHeaders(): Record<string, string> {
    return {
      apikey: this.publishableKey,
      "content-type": "application/json",
    };
  }

  private authorizedHeaders(accessToken: string): Record<string, string> {
    return {
      apikey: this.publishableKey,
      authorization: `Bearer ${accessToken}`,
    };
  }

  private async readJson(response: Response): Promise<unknown> {
    const payload: unknown = await response.json();
    if (!response.ok) {
      throw new Error("Supabase authentication request failed");
    }
    return payload;
  }
}
