import type { SupabaseAdminClient } from "../data/createSupabaseAdmin";

export interface AccountProfile {
  userId: string;
  loginId: string;
  email: string;
  coachName: string;
  schoolName: string;
}

export interface AccountAuthSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string | null;
}

export interface RegisterAccountInput {
  email: string;
  loginId: string;
  password: string;
  coachName: string;
  schoolName: string;
}

export interface AccountAuthService {
  register(input: RegisterAccountInput): Promise<{
    session: AccountAuthSession;
    profile: AccountProfile;
  }>;
  login(loginId: string, password: string): Promise<AccountAuthSession>;
  getProfile(userId: string): Promise<AccountProfile | null>;
}

export class AccountConflictError extends Error {
  constructor() {
    super("account unavailable");
    this.name = "AccountConflictError";
  }
}

export class InvalidAccountCredentialsError extends Error {
  constructor() {
    super("invalid account credentials");
    this.name = "InvalidAccountCredentialsError";
  }
}

interface SupabaseAccountAuthServiceInput {
  admin: SupabaseAdminClient;
  url: string;
  secretKey: string;
  fetchImpl?: typeof fetch;
}

interface TokenPayload {
  access_token?: unknown;
  refresh_token?: unknown;
  user?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeProfileRow(value: unknown): AccountProfile | null {
  if (!isRecord(value)) return null;
  const userId = value.user_id;
  const loginId = value.login_id;
  const email = value.email;
  const coachName = value.coach_name;
  const schoolName = value.school_name;
  if (
    typeof userId !== "string" ||
    typeof loginId !== "string" ||
    typeof email !== "string" ||
    typeof coachName !== "string" ||
    typeof schoolName !== "string"
  ) {
    return null;
  }
  return { userId, loginId, email, coachName, schoolName };
}

function parseTokenPayload(value: unknown): AccountAuthSession {
  if (!isRecord(value)) {
    throw new InvalidAccountCredentialsError();
  }
  const payload = value as TokenPayload;
  if (
    typeof payload.access_token !== "string" ||
    typeof payload.refresh_token !== "string" ||
    !isRecord(payload.user) ||
    typeof payload.user.id !== "string"
  ) {
    throw new InvalidAccountCredentialsError();
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    userId: payload.user.id,
    email: typeof payload.user.email === "string" ? payload.user.email : null,
  };
}

export class SupabaseAccountAuthService implements AccountAuthService {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly input: SupabaseAccountAuthServiceInput) {
    this.baseUrl = input.url.replace(/\/+$/, "");
    this.fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async register(input: RegisterAccountInput): Promise<{
    session: AccountAuthSession;
    profile: AccountProfile;
  }> {
    const existing = await this.input.admin
      .from("account_profiles")
      .select("user_id")
      .eq("login_id", input.loginId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) throw new AccountConflictError();

    const created = await this.input.admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new AccountConflictError();
    }

    const userId = created.data.user.id;
    const inserted = await this.input.admin
      .from("account_profiles")
      .insert({
        user_id: userId,
        login_id: input.loginId,
        email: input.email,
        coach_name: input.coachName,
        school_name: input.schoolName,
      })
      .select("user_id,login_id,email,coach_name,school_name")
      .single();

    const profile = normalizeProfileRow(inserted.data);
    if (inserted.error || !profile) {
      await this.input.admin.auth.admin.deleteUser(userId).catch(() => undefined);
      if (inserted.error?.code === "23505") {
        throw new AccountConflictError();
      }
      throw inserted.error ?? new Error("account profile insert failed");
    }

    try {
      const session = await this.passwordToken(input.email, input.password);
      return { session, profile };
    } catch (error) {
      await this.input.admin
        .from("account_profiles")
        .delete()
        .eq("user_id", userId);
      await this.input.admin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw error;
    }
  }

  async login(loginId: string, password: string): Promise<AccountAuthSession> {
    const result = await this.input.admin
      .from("account_profiles")
      .select("email")
      .eq("login_id", loginId)
      .maybeSingle();
    if (result.error || !isRecord(result.data) || typeof result.data.email !== "string") {
      throw new InvalidAccountCredentialsError();
    }
    return this.passwordToken(result.data.email, password);
  }

  async getProfile(userId: string): Promise<AccountProfile | null> {
    const result = await this.input.admin
      .from("account_profiles")
      .select("user_id,login_id,email,coach_name,school_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (result.error) throw result.error;
    return normalizeProfileRow(result.data);
  }

  private async passwordToken(
    email: string,
    password: string,
  ): Promise<AccountAuthSession> {
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.baseUrl}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            apikey: this.input.secretKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        },
      );
    } catch {
      throw new InvalidAccountCredentialsError();
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      throw new InvalidAccountCredentialsError();
    }
    if (!response.ok) {
      throw new InvalidAccountCredentialsError();
    }
    return parseTokenPayload(payload);
  }
}
