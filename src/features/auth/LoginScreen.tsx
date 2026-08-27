import { useState, type FormEvent } from "react";
import type { AuthClient } from "../../services/auth/AuthClient";
import "./auth.css";

interface LoginScreenProps {
  authClient: AuthClient;
}

export function LoginScreen({ authClient }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [googlePending, setGooglePending] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startGoogleLogin = async () => {
    if (googlePending) {
      return;
    }

    setGooglePending(true);
    setError(null);
    setStatus("Googleログインを開始中");
    try {
      await authClient.signInWithGoogle();
    } catch {
      setError(
        "Googleログインを開始できませんでした。もう一度お試しください。",
      );
      setStatus(null);
    } finally {
      setGooglePending(false);
    }
  };

  const sendLoginEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (emailPending) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setEmailPending(true);
    setError(null);
    setStatus("ログイン用メールを送信中");
    try {
      await authClient.signInWithEmail(normalizedEmail);
      setStatus("ログイン用メールを送信しました");
    } catch {
      setError(
        "ログイン用メールを送信できませんでした。もう一度お試しください。",
      );
      setStatus(null);
    } finally {
      setEmailPending(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-heading">
        <div className="login-brand">
          <span className="login-brand__eyebrow">COURT LEGACY</span>
          <h1 id="login-heading">監督として始める</h1>
          <p>
            チームと学校の歴史をクラウドに保存するため、アカウントでログインしてください。
          </p>
        </div>

        {error ? (
          <div className="login-message login-message--error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="login-status" aria-live="polite">
          {status ? <span role="status">{status}</span> : null}
        </div>

        <button
          className="login-google"
          disabled={googlePending}
          onClick={() => void startGoogleLogin()}
          type="button"
        >
          <span aria-hidden="true" className="login-google__mark">
            G
          </span>
          {googlePending ? "Googleログインを開始中" : "Googleで始める"}
        </button>

        <div className="login-divider" aria-hidden="true">
          <span>または</span>
        </div>

        <form className="login-email" onSubmit={sendLoginEmail}>
          <label htmlFor="login-email">メールアドレス</label>
          <input
            autoComplete="email"
            id="login-email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="coach@example.com"
            required
            type="email"
            value={email}
          />
          <button className="login-email__submit" disabled={emailPending} type="submit">
            {emailPending ? "メールを送信中" : "メールでログイン"}
          </button>
        </form>

        <p className="login-note">
          メールの場合は、届いたログインリンクを開くとゲームへ戻れます。
        </p>
      </section>
    </main>
  );
}
