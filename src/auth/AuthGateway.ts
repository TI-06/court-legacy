export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

export interface SignUpResult {
  session: AuthSession | null;
}

export interface AuthGateway {
  restoreSession(): Promise<AuthSession | null>;
  signInWithPassword(email: string, password: string): Promise<AuthSession>;
  signUpWithPassword(email: string, password: string): Promise<SignUpResult>;
  signInWithGoogle(): void;
  signOut(): Promise<void>;
}
