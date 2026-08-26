import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { AuthGateway, AuthSession } from "./AuthGateway";
import "./auth.css";

interface AuthGateProps {
  gateway: AuthGateway;
  children: (session: AuthSession) => ReactNode;
}

type AuthPhase =
  | "checking"
  | "signed-out"
  | "signing-in"
  | "signing-up"
  | "signed-in";

export function AuthGate({ gateway, children }: AuthGateProps) {
  const [phase, setPhase] = useState<AuthPhase>("checking");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void gateway
      .restoreSession()
      .then((restored) => {
        if (!active) {
          return;
        }
        setSession(restored);
        setPhase(restored ? "signed-in" : "signed-out");
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setError("ログイン状態を確認できませんでした。もう一度お試しください。");
        setPhase("signed-out");
      });

    return () => {
      active = false;
    };
  }, [gateway]);

  const submitSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phase === "signing-in" || phase === "signing-up") {
      return;
    }

    setError(null);
    setNotice(null);
    setPhase("signing-in");
    try {
      const signedIn = await gateway.signInWithPassword(email.trim(), password);
      setSession(signedIn);
      setPhase("signed-in");
    } catch {
      setError("ログインできませんでした。メールアドレスとパスワードをご確認ください。");
      setPhase("signed-out");
    }
  };

  const submitSignUp = async () => {
    if (phase === "signing-in" || phase === "signing-up") {
      return;
    }

    setError(null);
    setNotice(null);
    setPhase("signing-up");
    try {
      const result = await gateway.signUpWithPassword(email.trim(), password);
      if (result.session) {
        setSession(result.session);
        setPhase("signed-in");
        return;
      }
      setNotice("確認メールを送信しました。メール内のリンクから登録を完了してください。");
      setPhase("signed-out");
    } catch {
      setError("アカウントを作成できませんでした。入力内容をご確認ください。");
      setPhase("signed-out");
    }
  };

  if (phase === "checking") {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card--status" role="status">
          <span className="auth-spinner" aria-hidden="true" />
          <strong>ログイン状態を確認中</strong>
          <p>アカウントとセーブデータを確認しています。</p>
        </section>
      </main>
    );
  }

  if (phase === "signed-in" && session) {
    return <>{children(session)}</>;
  }

  const busy = phase === "signing-in" || phase === "signing-up";

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-heading">
        <div className="auth-brand">
          <span>COURT LEGACY</span>
          <h1 id="auth-heading">ログイン</h1>
          <p>監督データをクラウドに保存するため、アカウントでログインしてください。</p>
        </div>

        {busy ? (
          <div className="auth-progress" role="status">
            <span className="auth-spinner" aria-hidden="true" />
            <strong>{phase === "signing-up" ? "アカウント作成中" : "ログイン中"}</strong>
          </div>
        ) : null}

        {error ? <p role="alert" className="auth-message auth-message--error">{error}</p> : null}
        {notice ? <p role="status" className="auth-message">{notice}</p> : null}

        <form className="auth-form" onSubmit={submitSignIn}>
          <label>
            <span>メールアドレス</span>
            <input
              autoComplete="email"
              disabled={busy}
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>パスワード</span>
            <input
              autoComplete="current-password"
              disabled={busy}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <button className="auth-primary" disabled={busy} type="submit">
            {phase === "signing-in" ? "ログイン中" : "ログインする"}
          </button>
          <button
            className="auth-secondary"
            disabled={busy}
            onClick={() => void submitSignUp()}
            type="button"
          >
            {phase === "signing-up" ? "アカウント作成中" : "新規アカウントを作成"}
          </button>
        </form>

        <div className="auth-divider" aria-hidden="true">
          <span>または</span>
        </div>
        <button
          className="auth-google"
          disabled={busy}
          onClick={() => gateway.signInWithGoogle()}
          type="button"
        >
          Googleでログイン
        </button>
      </section>
    </main>
  );
}
