import type { AuthClient, AuthSession } from "./AuthClient";

export const E2E_AUTH_STATE_KEY = "court-legacy:e2e-auth-state";

export const E2E_AUTH_SESSION: AuthSession = {
  userId: "e2e-user",
  email: "e2e@court-legacy.test",
  accessToken: "e2e-access-token",
};

type AuthListener = (session: AuthSession | null) => void;

type PersistedAuthState = "signed-in" | "signed-out";

interface MockAuthClientOptions {
  persistAcrossReloads?: boolean;
  defaultSignedIn?: boolean;
}

function readPersistedState(): PersistedAuthState | null {
  try {
    const value = globalThis.sessionStorage?.getItem(E2E_AUTH_STATE_KEY);
    return value === "signed-in" || value === "signed-out" ? value : null;
  } catch {
    return null;
  }
}

function writePersistedState(state: PersistedAuthState): void {
  try {
    globalThis.sessionStorage?.setItem(E2E_AUTH_STATE_KEY, state);
  } catch {
    // Browser E2E persistence is best-effort only.
  }
}

export class MockAuthClient implements AuthClient {
  private session: AuthSession | null;
  private readonly listeners = new Set<AuthListener>();
  private readonly persistAcrossReloads: boolean;

  constructor({
    persistAcrossReloads = false,
    defaultSignedIn = true,
  }: MockAuthClientOptions = {}) {
    this.persistAcrossReloads = persistAcrossReloads;
    const persisted = persistAcrossReloads ? readPersistedState() : null;
    const signedIn =
      persisted === "signed-in"
        ? true
        : persisted === "signed-out"
          ? false
          : defaultSignedIn;
    this.session = signedIn ? E2E_AUTH_SESSION : null;
    if (persistAcrossReloads && persisted === null) {
      writePersistedState(signedIn ? "signed-in" : "signed-out");
    }
  }

  async getSession(): Promise<AuthSession | null> {
    return this.session;
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async signInWithGoogle(): Promise<void> {
    this.replaceSession(E2E_AUTH_SESSION);
  }

  async signInWithEmail(): Promise<void> {
    this.replaceSession(E2E_AUTH_SESSION);
  }

  async signOut(): Promise<void> {
    this.replaceSession(null);
  }

  private replaceSession(session: AuthSession | null): void {
    this.session = session;
    if (this.persistAcrossReloads) {
      writePersistedState(session ? "signed-in" : "signed-out");
    }
    for (const listener of this.listeners) {
      listener(session);
    }
  }
}
