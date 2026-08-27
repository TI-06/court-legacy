import "./more.css";

interface MoreScreenProps {
  accountLabel: string;
  onOpenSchool: () => void;
  onSignOut: () => void;
}

export function MoreScreen({
  accountLabel,
  onOpenSchool,
  onSignOut,
}: MoreScreenProps) {
  return (
    <main className="app-content more-screen">
      <section className="more-screen__heading">
        <p className="section-kicker">MANAGEMENT</p>
        <h2>その他</h2>
        <p>学校運営とアカウント設定をまとめています。</p>
      </section>

      <section className="more-screen__menu" aria-label="その他のメニュー">
        <button
          aria-label="学校管理"
          className="more-screen__item"
          onClick={onOpenSchool}
          type="button"
        >
          <span>
            <strong>学校管理</strong>
            <small>施設・資金・学校情報を確認</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </section>

      <section className="more-screen__account" aria-label="アカウント">
        <div>
          <span>ログイン中</span>
          <strong>{accountLabel}</strong>
        </div>
        <button onClick={onSignOut} type="button">
          ログアウト
        </button>
      </section>
    </main>
  );
}
