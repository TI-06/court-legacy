import { useState } from "react";
import type { ShopItemId } from "../../domain/shop/shopCatalog";
import type {
  ShopBlockedReason,
  ShopPublicStatusItem,
  ShopStatusResponse,
} from "../../domain/shop/shopContracts";
import "./shop.css";

type ShopView = "products" | "inventory";
type ShopPendingAction = "purchase" | "use";

interface ShopScreenProps {
  status: ShopStatusResponse | null;
  loading: boolean;
  error: string | null;
  pendingAction?: ShopPendingAction | null;
  pendingItemId?: ShopItemId | null;
  resultMessage?: string | null;
  onBack: () => void;
  onRetry: () => void;
  onPurchase?: (itemId: ShopItemId) => void;
  onUse?: (itemId: ShopItemId) => void;
}

const blockedReasonLabels: Record<ShopBlockedReason, string> = {
  item_disabled: "現在利用できません",
  purchase_limit_reached: "今年度の上限に達しました",
  use_limit_reached: "今年度の使用上限に達しました",
  inventory_empty: "所持していません",
};

function blockedReason(reason: ShopBlockedReason | null): string | null {
  return reason ? blockedReasonLabels[reason] : null;
}

function ProductCard({
  item,
  pendingAction,
  pendingItemId,
  onPurchase,
}: {
  item: ShopPublicStatusItem;
  pendingAction: ShopPendingAction | null;
  pendingItemId: ShopItemId | null;
  onPurchase: (itemId: ShopItemId) => void;
}) {
  const purchasePending =
    pendingAction === "purchase" && pendingItemId === item.itemId;
  const reason = blockedReason(item.purchaseBlockedReason);
  const buttonLabel = purchasePending
    ? `${item.displayName}を購入処理中…`
    : `${item.displayName}を購入`;

  return (
    <article className="shop-card">
      <div className="shop-card__heading">
        <div>
          <h3>{item.displayName}</h3>
          <p>{item.description}</p>
        </div>
        <strong>¥0</strong>
      </div>

      <div className="shop-card__status">
        <span>
          購入 {item.purchasedCount} / {item.annualPurchaseLimit}
        </span>
        <span>
          使用 {item.usedCount} / {item.annualUseLimit}
        </span>
        <span>所持 {item.quantityOwned}</span>
      </div>

      {reason ? <p className="shop-card__blocked">{reason}</p> : null}

      <button
        aria-label={buttonLabel}
        disabled={!item.canPurchase || purchasePending}
        onClick={() => onPurchase(item.itemId)}
        type="button"
      >
        {purchasePending ? "購入処理中…" : "¥0で購入"}
      </button>
    </article>
  );
}

function InventoryCard({
  item,
  pendingAction,
  pendingItemId,
  onUse,
}: {
  item: ShopPublicStatusItem;
  pendingAction: ShopPendingAction | null;
  pendingItemId: ShopItemId | null;
  onUse: (itemId: ShopItemId) => void;
}) {
  const usePending = pendingAction === "use" && pendingItemId === item.itemId;
  const reason = blockedReason(item.useBlockedReason);
  const buttonLabel = usePending
    ? `${item.displayName}を使用処理中…`
    : `${item.displayName}を使用`;

  return (
    <article className="shop-card shop-card--inventory">
      <div className="shop-card__heading">
        <div>
          <h3>{item.displayName}</h3>
          <p>{item.description}</p>
        </div>
        <strong>×{item.quantityOwned}</strong>
      </div>

      <div className="shop-card__status">
        <span>今年度のみ有効</span>
        <span>
          使用 {item.usedCount} / {item.annualUseLimit}
        </span>
      </div>

      {reason ? <p className="shop-card__blocked">{reason}</p> : null}

      <button
        aria-label={buttonLabel}
        disabled={!item.canUse || usePending}
        onClick={() => onUse(item.itemId)}
        type="button"
      >
        {usePending ? "使用処理中…" : "使用する"}
      </button>
    </article>
  );
}

export function ShopScreen({
  status,
  loading,
  error,
  pendingAction = null,
  pendingItemId = null,
  resultMessage = null,
  onBack,
  onRetry,
  onPurchase = () => undefined,
  onUse = () => undefined,
}: ShopScreenProps) {
  const [view, setView] = useState<ShopView>("products");
  const ownedItems =
    status?.items.filter((item) => item.quantityOwned > 0) ?? [];

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

      <div aria-label="ショップ表示" className="shop-screen__tabs" role="group">
        <button
          aria-pressed={view === "products"}
          onClick={() => setView("products")}
          type="button"
        >
          商品
        </button>
        <button
          aria-pressed={view === "inventory"}
          onClick={() => setView("inventory")}
          type="button"
        >
          所持品
        </button>
      </div>

      {loading ? (
        <p aria-live="polite" className="shop-screen__notice" role="status">
          ショップ情報を読み込んでいます…
        </p>
      ) : null}

      {error ? (
        <div
          className="shop-screen__notice shop-screen__notice--error"
          role="alert"
        >
          <p>{error}</p>
          <button onClick={onRetry} type="button">
            再読み込み
          </button>
        </div>
      ) : null}

      {resultMessage ? (
        <p className="shop-screen__notice shop-screen__notice--success">
          {resultMessage}
        </p>
      ) : null}

      {status ? (
        <>
          <p className="shop-screen__year">
            年度 {status.academicYearIndex} ・ 所持品は年度更新で失効
          </p>

          {view === "products" ? (
            <section aria-label="商品一覧" className="shop-screen__grid">
              {status.items.map((item) => (
                <ProductCard
                  item={item}
                  key={item.itemId}
                  onPurchase={onPurchase}
                  pendingAction={pendingAction}
                  pendingItemId={pendingItemId}
                />
              ))}
            </section>
          ) : ownedItems.length > 0 ? (
            <section aria-label="所持品一覧" className="shop-screen__grid">
              {ownedItems.map((item) => (
                <InventoryCard
                  item={item}
                  key={item.itemId}
                  onUse={onUse}
                  pendingAction={pendingAction}
                  pendingItemId={pendingItemId}
                />
              ))}
            </section>
          ) : (
            <p className="shop-screen__notice">
              今年度の所持アイテムはありません。
            </p>
          )}
        </>
      ) : null}
    </main>
  );
}
