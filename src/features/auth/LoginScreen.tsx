import { useState, type FormEvent } from "react";
import type {
  AccountRegistrationInput,
  AuthClient,
} from "../../services/auth/AuthClient";
import "./auth.css";

interface LoginScreenProps {
  authClient: AuthClient;
}

type AuthView = "login" | "register" | "forgot";

const LOGIN_ID_PATTERN = /^[a-z0-9._-]{4,24}$/;

function normalizeLoginId(value: string): string {
  return value.trim().toLowerCase();
}

export function LoginScreen({ authClient }: LoginScreenProps) {
  const [view, setView] = useState<AuthView>("login");
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [coachName, setCoachName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changeView = (next: AuthView) => {
    if (pending) return;
    setView(next);
    setError(null);
    setStatus(null);
    setPassword("");
    setPasswordConfirmation("");
  };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const normalizedLoginId = normalizeLoginId(loginId);
    if (!LOGIN_ID_PATTERN.test(normalizedLoginId)) {
      setError(
        "ログインIDは半角英数字・._-を使った4〜24文字で入力してください。",
      );
      return;
    }

    setPending(true);
    setError(null);
    setStatus("ログイン中…");
    try {
      await authClient.signInWithCredentials(normalizedLoginId, password);
    } catch (reason) {
      setStatus(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "ログインIDまたはパスワードが正しくありません。",
      );
    } finally {
      setPending(false);
    }
  };

  const submitRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const normalizedLoginId = normalizeLoginId(loginId);
    if (!LOGIN_ID_PATTERN.test(normalizedLoginId)) {
      setError(
        "ログインIDは半角英数字・._-を使った4〜24文字で入力してください。",
      );
      return;
    }
    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください。");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("パスワードが一致しません。もう一度ご確認ください。");
      return;
    }

    const input: AccountRegistrationInput = {
      email: email.trim().toLowerCase(),
      loginId: normalizedLoginId,
      password,
      coachName: coachName.trim(),
      schoolName: schoolName.trim(),
    };

    setPending(true);
    setError(null);
    setStatus("アカウントを作成中…");
    try {
      await authClient.registerAccount(input);
      setStatus("登録が完了しました。ゲームを準備しています…");
    } catch (reason) {
      setStatus(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "アカウントを作成できませんでした。入力内容をご確認ください。",
      );
    } finally {
      setPending(false);
    }
  };

  const submitPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setStatus("再設定メールを送信中…");
    try {
      await authClient.requestPasswordReset(email.trim().toLowerCase());
      setStatus("パスワード再設定メールを送信しました");
    } catch {
      setStatus(null);
      setError(
        "再設定メールを送信できませんでした。メールアドレスをご確認ください。",
      );
    } finally {
      setPending(false);
    }
  };

  const title =
    view === "login"
      ? "監督としてログイン"
      : view === "register"
        ? "監督アカウントを作成"
        : "パスワードを再設定";

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-heading">
        <div className="login-brand">
          <span className="login-brand__eyebrow">COURT LEGACY</span>
          <h1 id="login-heading">{title}</h1>
          <p>
            {view === "login"
              ? "登録したログインIDとパスワードで、監督データを呼び出します。"
              : view === "register"
                ? "監督名と高校名もここで決めて、そのままゲームを始められます。"
                : "登録時のメールアドレスへ、安全な再設定リンクを送ります。"}
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

        {view === "login" ? (
          <form className="login-form" onSubmit={submitLogin}>
            <label htmlFor="login-id">ログインID</label>
            <input
              autoCapitalize="none"
              autoComplete="username"
              disabled={pending}
              id="login-id"
              maxLength={24}
              onChange={(event) => setLoginId(event.target.value)}
              placeholder="coach.taku"
              required
              value={loginId}
            />
            <label htmlFor="login-password">パスワード</label>
            <input
              autoComplete="current-password"
              disabled={pending}
              id="login-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <button className="login-primary" disabled={pending} type="submit">
              {pending ? "ログイン中…" : "ログインする"}
            </button>
            <button
              className="login-secondary"
              disabled={pending}
              onClick={() => changeView("register")}
              type="button"
            >
              新規登録はこちら
            </button>
            <button
              className="login-link"
              disabled={pending}
              onClick={() => changeView("forgot")}
              type="button"
            >
              パスワードを忘れた方
            </button>
          </form>
        ) : null}

        {view === "register" ? (
          <form className="login-form" onSubmit={submitRegistration}>
            <label htmlFor="register-email">メールアドレス</label>
            <input
              autoComplete="email"
              disabled={pending}
              id="register-email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="coach@example.com"
              required
              type="email"
              value={email}
            />
            <label htmlFor="register-id">ログインID</label>
            <input
              autoCapitalize="none"
              autoComplete="username"
              disabled={pending}
              id="register-id"
              maxLength={24}
              onChange={(event) => setLoginId(event.target.value)}
              placeholder="coach.taku"
              required
              value={loginId}
            />
            <p className="login-field-note">半角英数字・._- の4〜24文字</p>
            <label htmlFor="register-password">パスワード</label>
            <input
              autoComplete="new-password"
              disabled={pending}
              id="register-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <label htmlFor="register-password-confirmation">
              パスワード確認
            </label>
            <input
              autoComplete="new-password"
              disabled={pending}
              id="register-password-confirmation"
              minLength={8}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              required
              type="password"
              value={passwordConfirmation}
            />
            <label htmlFor="register-coach-name">監督名</label>
            <input
              disabled={pending}
              id="register-coach-name"
              maxLength={40}
              onChange={(event) => setCoachName(event.target.value)}
              placeholder="例：高城 監督"
              required
              value={coachName}
            />
            <label htmlFor="register-school-name">高校名</label>
            <input
              disabled={pending}
              id="register-school-name"
              maxLength={60}
              onChange={(event) => setSchoolName(event.target.value)}
              placeholder="例：青葉高校"
              required
              value={schoolName}
            />
            <button className="login-primary" disabled={pending} type="submit">
              {pending ? "登録中…" : "この内容で登録"}
            </button>
            <button
              className="login-secondary"
              disabled={pending}
              onClick={() => changeView("login")}
              type="button"
            >
              ログインへ戻る
            </button>
          </form>
        ) : null}

        {view === "forgot" ? (
          <form className="login-form" onSubmit={submitPasswordReset}>
            <label htmlFor="forgot-email">メールアドレス</label>
            <input
              autoComplete="email"
              disabled={pending}
              id="forgot-email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="coach@example.com"
              required
              type="email"
              value={email}
            />
            <button className="login-primary" disabled={pending} type="submit">
              {pending ? "送信中…" : "再設定メールを送信"}
            </button>
            <button
              className="login-secondary"
              disabled={pending}
              onClick={() => changeView("login")}
              type="button"
            >
              ログインへ戻る
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
