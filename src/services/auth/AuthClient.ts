export interface AuthSession {
  userId: string;
  email: string | null;
  accessToken: string;
}

export interface AccountRegistrationInput {
  email: string;
  loginId: string;
  password: string;
  coachName: string;
  schoolName: string;
}

export interface AuthClient {
  getSession(): Promise<AuthSession | null>;
  subscribe(listener: (session: AuthSession | null) => void): () => void;
  signInWithCredentials(loginId: string, password: string): Promise<void>;
  registerAccount(input: AccountRegistrationInput): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  isPasswordRecovery(): boolean;
  signOut(): Promise<void>;
}
