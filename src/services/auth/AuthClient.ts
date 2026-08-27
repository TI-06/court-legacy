export interface AuthSession {
  userId: string;
  email: string | null;
  accessToken: string;
}

export interface AuthClient {
  getSession(): Promise<AuthSession | null>;
  subscribe(listener: (session: AuthSession | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
}
