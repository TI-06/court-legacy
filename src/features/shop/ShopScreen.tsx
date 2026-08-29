import type { ShopStatusResponse } from "../../domain/shop/shopContracts";
import "./shop.css";

interface ShopScreenProps {
  status: ShopStatusResponse | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
}

export function ShopScreen({
  status,
  loading,
  error,
  onBack,
  onRetry,
}: ShopScreenProps) {
  return (
    <main className="app-content shop-screen">
      <div className="shop-screen__topbar">
        <button onClick={onBack} type="button">
          その他へ戻る
        </button>
        <span>TEST / ALL ¥0</span>
      </div>

      <section className="shop-screen__heading">
        <p className="section-kicker">SHOP</p>
        <h2>ショップ</h2>
        <p>テスト期間中は、すべてのアイテムを¥0で利用できます。</p>
      </section>

      {loading ? (
        <p aria-live="polite" role="status">
          ショップ情報を読み込んでいます…
        </p>
      ) : null}

      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button onClick={onRetry} type="button">
            再読み込み
          </button>
        </div>
      ) : null}

      {status ? (
        <p className="shop-screen__year">年度 {status.academicYearIndex}</p>
      ) : null}
    </main>
  );
}
