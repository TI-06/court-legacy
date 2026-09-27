import { useState } from "react";
import "./more.css";

interface MoreScreenProps {
  accountLabel: string;
  onOpenShop: () => void;
  onOpenInventory: () => void;
  onResetGameData: () => Promise<void>;
  onSignOut: () => void;
}

export function MoreScreen({
  accountLabel,
  onOpenShop,
  onOpenInventory,
  onResetGameData,
  onSignOut,
}: MoreScreenProps) {
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const resetGameData = async () => {
    if (resetPending) return;
    setResetPending(true);
    setResetError(null);
    try {
      await onResetGameData();
    } catch (error) {
      setResetError(
        error instanceof Error
          ? error.message
          : "ゲームデータを初期化できませんでした",
      );
      setResetPending(false);
    }
  };
  return (
    <main className="app-content more-screen">
      <section className="more-screen__heading">
        <p className="section-kicker">管理メニュー</p>
        <h2>その他</h2>
        <p>ショップ、所持品、アカウント設定をまとめています。</p>
      </section>
      <section className="more-screen__menu" aria-label="その他のメニュー">
        <button
          aria-label="ショップ"
          className="more-screen__item"
          onClick={onOpenShop}
          type="button"
        >
          <span>
            <strong>ショップ</strong>
            <small>アイテムを購入</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <button
          aria-label="所持品"
          className="more-screen__item"
          onClick={onOpenInventory}
          type="button"
        >
          <span>
            <strong>所持品</strong>
            <small>アイテムを確認・使用</small>
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
      <section className="more-screen__danger" aria-label="ゲームデータ">
        <div>
          <span>データ管理</span>
          <strong>ゲームデータを完全初期化</strong>
          <p>
            セーブ、ショップ、スカウト、対人戦データを削除します。
            ログインID・パスワードは残ります。
          </p>
        </div>
        {resetConfirming ? (
          <div className="more-screen__reset-confirm">
            <p>この操作は元に戻せません。本当に初期化しますか？</p>
            {resetError ? <p role="alert">{resetError}</p> : null}
            <div>
              <button
                className="more-screen__danger-button"
                disabled={resetPending}
                onClick={() => void resetGameData()}
                type="button"
              >
                {resetPending ? "初期化中…" : "完全に初期化する"}
              </button>
              <button
                disabled={resetPending}
                onClick={() => {
                  setResetConfirming(false);
                  setResetError(null);
                }}
                type="button"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <button
            className="more-screen__danger-button"
            onClick={() => setResetConfirming(true)}
            type="button"
          >
            初期化する
          </button>
        )}
      </section>
    </main>
  );
}
