import { useState, type FormEvent } from "react";
import type { AuthClient } from "../../services/auth/AuthClient";
import "./auth.css";

interface PasswordResetScreenProps {
  authClient: AuthClient;
  onComplete(): void;
}

export function PasswordResetScreen({
  authClient,
  onComplete,
}: PasswordResetScreenProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください。");
      return;
    }
    if (password !== confirmation) {
      setError("パスワードが一致しません。もう一度ご確認ください。");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await authClient.updatePassword(password);
      onComplete();
    } catch {
      setError("パスワードを変更できませんでした。再設定リンクをもう一度お試しください。");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="password-reset-heading">
        <div className="login-brand">
          <span className="login-brand__eyebrow">COURT LEGACY</span>
          <h1 id="password-reset-heading">新しいパスワード</h1>
          <p>これから使用するパスワードを8文字以上で設定してください。</p>
        </div>
        {error ? (
          <div className="login-message login-message--error" role="alert">
            {error}
          </div>
        ) : null}
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="reset-password">新しいパスワード</label>
          <input
            autoComplete="new-password"
            disabled={pending}
            id="reset-password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <label htmlFor="reset-password-confirmation">パスワード確認</label>
          <input
            autoComplete="new-password"
            disabled={pending}
            id="reset-password-confirmation"
            minLength={8}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            type="password"
            value={confirmation}
          />
          <button className="login-primary" disabled={pending} type="submit">
            {pending ? "変更中…" : "新しいパスワードを設定"}
          </button>
        </form>
      </section>
    </main>
  );
}
