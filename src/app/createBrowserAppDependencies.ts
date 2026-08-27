import type {
  CloudGameSnapshot,
  PersistedOperationResponse,
} from "../../worker/data/GameStore";
import type { GameActionRequest } from "../../worker/game/actionSchema";
import { applyGameAction } from "../../worker/game/applyGameAction";
import { autoSelectTeam } from "../domain/team/autoSelectTeam";
import type { AuthClient } from "../services/auth/AuthClient";
import {
  E2E_AUTH_SESSION,
  MockAuthClient,
} from "../services/auth/MockAuthClient";
import { createSupabaseAuthClient } from "../services/auth/SupabaseAuthClient";
import {
  ApiError,
  HttpGameApiClient,
  type GameApiClient,
  type OnboardingInput,
} from "../services/api/GameApiClient";
import { createDemoGame } from "./createDemoGame";
import { createInitialGame } from "./createInitialGame";

interface BrowserAppEnvironment {
  MODE?: string;
  VITE_E2E_AUTH_BYPASS?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export interface BrowserAppDependencies {
  auth: AuthClient;
  api: GameApiClient;
}

export const E2E_SERVER_SNAPSHOT_KEY = "court-legacy:e2e-server-snapshot";
export const E2E_GAME_STATE_KEY = "court-legacy:e2e-game-state";
export const E2E_ACTION_DELAY_MS_KEY = "court-legacy:e2e-action-delay-ms";

function createHarnessSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: E2E_AUTH_SESSION.userId,
    schoolDbId: "e2e-school",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function readSessionStorage(key: string): string | null {
  try {
    return globalThis.sessionStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeSessionStorage(key: string, value: string): void {
  try {
    globalThis.sessionStorage?.setItem(key, value);
  } catch {
    // E2E persistence is only a browser test adapter; in-memory state still works.
  }
}

function readPersistedHarnessSnapshot(): CloudGameSnapshot | null {
  try {
    const raw = readSessionStorage(E2E_SERVER_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as CloudGameSnapshot) : null;
  } catch {
    return null;
  }
}

function writePersistedHarnessSnapshot(snapshot: CloudGameSnapshot): void {
  writeSessionStorage(E2E_SERVER_SNAPSHOT_KEY, JSON.stringify(snapshot));
  writeSessionStorage(E2E_GAME_STATE_KEY, "ready");
}

function readHarnessDelay(): number {
  const parsed = Number(readSessionStorage(E2E_ACTION_DELAY_MS_KEY) ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 5_000)) : 0;
}

class StaticGameApiClient implements GameApiClient {
  private snapshot: CloudGameSnapshot | null;
  private readonly operationResponses = new Map<
    string,
    PersistedOperationResponse
  >();

  constructor(private readonly persistAcrossReloads: boolean) {
    const explicitGameState = persistAcrossReloads
      ? readSessionStorage(E2E_GAME_STATE_KEY)
      : null;
    this.snapshot =
      explicitGameState === "needs-onboarding"
        ? null
        : (persistAcrossReloads ? readPersistedHarnessSnapshot() : null) ??
          createHarnessSnapshot();
    if (persistAcrossReloads && this.snapshot) {
      writePersistedHarnessSnapshot(this.snapshot);
    }
  }

  private replaceSnapshot(next: CloudGameSnapshot): void {
    this.snapshot = next;
    if (this.persistAcrossReloads) {
      writePersistedHarnessSnapshot(next);
    }
  }

  async bootstrap() {
    return this.snapshot
      ? ({ status: "ready" as const, game: this.snapshot } as const)
      : ({ status: "needs-onboarding" as const } as const);
  }

  async onboard(_accessToken: string, input: OnboardingInput) {
    const state = createInitialGame({
      seed: `e2e:${input.schoolName}:${input.coachName}`,
      schoolName: input.schoolName,
      schoolShortName: input.schoolShortName,
      coachName: input.coachName,
      regionId: input.regionId,
      uniform: {
        primary: "#17365D",
        secondary: "#FFFFFF",
        accent: "#D99B2B",
      },
    });
    const game: CloudGameSnapshot = {
      userId: E2E_AUTH_SESSION.userId,
      schoolDbId: "e2e-school",
      revision: 1,
      state,
      teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
    };
    this.replaceSnapshot(game);
    return { status: "ready" as const, game };
  }

  async applyAction(_accessToken: string, request: GameActionRequest) {
    if (!this.snapshot) {
      throw new ApiError(
        409,
        "game_not_ready",
        "学校データを作成してから操作してください",
      );
    }

    const cached = this.operationResponses.get(request.operationId);
    if (cached) {
      return cached;
    }
    if (request.revision !== this.snapshot.revision) {
      throw new ApiError(
        409,
        "revision_conflict",
        "別の操作でテスト用データが更新されています",
      );
    }

    if (this.persistAcrossReloads) {
      const delay = readHarnessDelay();
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const applied = applyGameAction(this.snapshot, request.action);
    this.replaceSnapshot({
      ...this.snapshot,
      revision: this.snapshot.revision + 1,
      state: applied.state,
      teamSelection: applied.teamSelection,
    });
    const response: PersistedOperationResponse = {
      game: this.snapshot,
      operationId: request.operationId,
    };
    if (applied.outcome !== undefined) {
      response.outcome = applied.outcome;
    }
    this.operationResponses.set(request.operationId, response);
    return response;
  }
}

class UnavailableAuthClient implements AuthClient {
  private error(): Error {
    return new Error(
      "認証設定が見つかりません。Supabaseの公開設定を確認してください。",
    );
  }

  async getSession(): Promise<null> {
    throw this.error();
  }

  subscribe(): () => void {
    return () => undefined;
  }

  async signInWithGoogle(): Promise<void> {
    throw this.error();
  }

  async signInWithEmail(): Promise<void> {
    throw this.error();
  }

  async signOut(): Promise<void> {
    throw this.error();
  }
}

function browserEnvironment(): BrowserAppEnvironment {
  return {
    MODE: import.meta.env.MODE,
    VITE_E2E_AUTH_BYPASS: import.meta.env.VITE_E2E_AUTH_BYPASS,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env
      .VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function createBrowserAppDependencies(
  env: BrowserAppEnvironment = browserEnvironment(),
): BrowserAppDependencies {
  if (env.MODE === "test") {
    return {
      auth: new MockAuthClient(),
      api: new StaticGameApiClient(false),
    };
  }

  if (env.VITE_E2E_AUTH_BYPASS === "true") {
    return {
      auth: new MockAuthClient({ persistAcrossReloads: true }),
      api: new StaticGameApiClient(true),
    };
  }

  const api = new HttpGameApiClient();
  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    return { auth: new UnavailableAuthClient(), api };
  }

  return {
    auth: createSupabaseAuthClient({
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    }),
    api,
  };
}
