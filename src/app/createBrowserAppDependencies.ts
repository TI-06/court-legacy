import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import type { GameActionRequest } from "../../worker/game/actionSchema";
import { autoSelectTeam } from "../domain/team/autoSelectTeam";
import type { AuthClient, AuthSession } from "../services/auth/AuthClient";
import { createSupabaseAuthClient } from "../services/auth/SupabaseAuthClient";
import {
  HttpGameApiClient,
  type GameApiClient,
  type OnboardingInput,
} from "../services/api/GameApiClient";
import { createDemoGame } from "./createDemoGame";

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

const HARNESS_SESSION: AuthSession = {
  userId: "e2e-user",
  email: "e2e@court-legacy.test",
  accessToken: "e2e-access-token",
};

function createHarnessSnapshot(): CloudGameSnapshot {
  const state = createDemoGame();
  return {
    userId: HARNESS_SESSION.userId,
    schoolDbId: "e2e-school",
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

class StaticAuthClient implements AuthClient {
  async getSession(): Promise<AuthSession> {
    return HARNESS_SESSION;
  }

  subscribe(): () => void {
    return () => undefined;
  }

  async signInWithGoogle(): Promise<void> {}

  async signInWithEmail(): Promise<void> {}

  async signOut(): Promise<void> {}
}

class StaticGameApiClient implements GameApiClient {
  async bootstrap() {
    return { status: "ready" as const, game: createHarnessSnapshot() };
  }

  async onboard(_accessToken: string, _input: OnboardingInput) {
    return { status: "ready" as const, game: createHarnessSnapshot() };
  }

  async applyAction(_accessToken: string, request: GameActionRequest) {
    return {
      game: createHarnessSnapshot(),
      operationId: request.operationId,
    };
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
  if (env.MODE === "test" || env.VITE_E2E_AUTH_BYPASS === "true") {
    return {
      auth: new StaticAuthClient(),
      api: new StaticGameApiClient(),
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
