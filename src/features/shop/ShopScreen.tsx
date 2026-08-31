import { useMemo, useState } from "react";
import type { GameState } from "../../domain/model/GameState";
import type { PlayerId } from "../../domain/model/identifiers";
import type { PlayerAbilities } from "../../domain/model/Player";
import type { ShopItemId } from "../../domain/shop/shopCatalog";
import type { SpecialCoachFocus } from "../../domain/shop/shopEffects";
import type {
  ShopBlockedReason,
  ShopPublicStatusItem,
  ShopStatusResponse,
  ShopUseTarget,
} from "../../domain/shop/shopContracts";
import "./shop.css";
import type { ShopUsePresentation } from "./shopUsePresentation";

type AbilityKey = keyof PlayerAbilities;

type ShopView = "products" | "inventory";
type ShopPendingAction = "purchase" | "use";

interface ShopScreenProps {
  status: ShopStatusResponse | null;
  loading: boolean;
  error: string | null;
  state?: GameState;
  pendingAction?: ShopPendingAction | null;
  pendingItemId?: ShopItemId | null;
  resultMessage?: string | null;
  latestUseResult?: ShopUsePresentation | null;
  retryAction?: ShopPendingAction | null;
  onBack: () => void;
  onRetry: () => void;
  onRetryMutation?: () => void;
  onPurchase?: (itemId: ShopItemId) => void;
  onUse?: (itemId: ShopItemId, target?: ShopUseTarget) => void;
}

const blockedReasonLabels: Record<ShopBlockedReason, string> = {
  item_disabled: "現在利用できません",
  purchase_limit_reached: "今年度の上限に達しました",
  use_limit_reached: "今年度の使用上限に達しました",
  inventory_empty: "所持していません",
};

const specialCoachFocusLabels: Array<{
  focus: SpecialCoachFocus;
  label: string;
}> = [
  { focus: "spike", label: "スパイク" },
  { focus: "serve", label: "サーブ" },
  { focus: "receive", label: "レシーブ" },
  { focus: "block", label: "ブロック" },
  { focus: "physical", label: "フィジカル" },
  { focus: "decision", label: "判断力" },
];

const abilityLabels: Record<AbilityKey, string> = {
  spike: "スパイク",
  serve: "サーブ",
  receive: "レシーブ",
  block: "ブロック",
  set: "トス",
  speed: "スピード",
  jump: "ジャンプ",
  stamina: "スタミナ",
  mental: "メンタル",
  decision: "判断力",
};

function blockedReason(reason: ShopBlockedReason | null): string | null {
  return reason ? blockedReasonLabels[reason] : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function ShopUseResultPanel({
  presentation,
  state,
}: {
  presentation: ShopUsePresentation;
  state?: GameState;
}) {
  const result = presentation.result;

  if (presentation.itemId === "fatigue-recovery") {
    const before = asRecord(result.before);
    const after = asRecord(result.after);
    const beforeFatigue = asNumber(before?.fatigue);
    const afterFatigue = asNumber(after?.fatigue);
    const beforeCondition = asNumber(before?.condition);
    const afterCondition = asNumber(after?.condition);
    if (
      beforeFatigue === null ||
      afterFatigue === null ||
      beforeCondition === null ||
      afterCondition === null
    ) {
      return null;
    }

    return (
      <section className="shop-use-result" aria-live="polite">
        <h3>疲労回復の結果</h3>
        <div className="shop-use-result__metrics">
          <span>
            疲労 {beforeFatigue} → {afterFatigue}
          </span>
          <span>
            状態 {beforeCondition} → {afterCondition}
          </span>
        </div>
      </section>
    );
  }

  if (presentation.itemId === "training-camp") {
    const participantCount = asNumber(result.participantCount);
    const totalAbilityGrowth = asNumber(result.totalAbilityGrowth);
    const averageFatigueChange = asNumber(result.averageFatigueChange);
    const injuredPlayerIds = Array.isArray(result.injuredPlayerIds)
      ? result.injuredPlayerIds
      : null;
    if (
      participantCount === null ||
      totalAbilityGrowth === null ||
      averageFatigueChange === null ||
      injuredPlayerIds === null
    ) {
      return null;
    }

    return (
      <section className="shop-use-result" aria-live="polite">
        <h3>強化合宿の結果</h3>
        <div className="shop-use-result__metrics">
          <span>参加 {participantCount}人</span>
          <span>能力成長 {signed(totalAbilityGrowth)}</span>
          <span>平均疲労 {signed(averageFatigueChange)}</span>
          <span>怪我 {injuredPlayerIds.length}人</span>
        </div>
      </section>
    );
  }

  if (presentation.itemId === "special-coach") {
    const playerId =
      typeof result.playerId === "string" ? result.playerId : null;
    const totalAbilityGrowth = asNumber(result.totalAbilityGrowth);
    const fatigueChange = asNumber(result.fatigueChange);
    const abilityChanges = asRecord(result.abilityChanges);
    if (
      playerId === null ||
      totalAbilityGrowth === null ||
      fatigueChange === null ||
      abilityChanges === null
    ) {
      return null;
    }
    const player = state?.players[playerId as PlayerId];
    const changedAbilities = Object.entries(abilityChanges).flatMap(
      ([ability, rawValue]) => {
        const value = asNumber(rawValue);
        return value !== null && value !== 0 && ability in abilityLabels
          ? [[ability as AbilityKey, value] as const]
          : [];
      },
    );

    return (
      <section className="shop-use-result" aria-live="polite">
        <h3>特別コーチの結果</h3>
        {player ? (
          <strong>
            {player.lastName} {player.firstName}
          </strong>
        ) : null}
        <div className="shop-use-result__metrics">
          <span>能力成長 {signed(totalAbilityGrowth)}</span>
          {changedAbilities.map(([ability, value]) => (
            <span key={ability}>
              {abilityLabels[ability]} {signed(value)}
            </span>
          ))}
          <span>疲労 {signed(fatigueChange)}</span>
        </div>
      </section>
    );
  }

  if (presentation.itemId === "training-efficiency-boost") {
    const pending = result.pending === true;
    const percent = asNumber(result.percent);
    if (!pending || percent === null) return null;

    return (
      <section className="shop-use-result" aria-live="polite">
        <h3>練習効率アップの結果</h3>
        <p>次回練習の成長効率 +{percent}% を有効化しました</p>
      </section>
    );
  }

  if (presentation.itemId === "extra-scout-candidate") {
    const candidateCount = asNumber(result.candidateCount);
    if (candidateCount === null) return null;
    return (
      <section className="shop-use-result" aria-live="polite">
        <h3>新入生候補追加の結果</h3>
        <p>今年度のスカウト候補が {candidateCount}人 になりました。</p>
      </section>
    );
  }

  return null;
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
  const scoutingTargetRequired =
    item.itemId === "scout-research" || item.itemId === "potential-appraisal";
  const buttonLabel = usePending
    ? `${item.displayName}を使用処理中…`
    : scoutingTargetRequired
      ? `${item.displayName}はスカウト画面で使用`
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

      {scoutingTargetRequired ? (
        <p className="shop-card__blocked">
          スカウト画面で候補を選んで使用します
        </p>
      ) : reason ? (
        <p className="shop-card__blocked">{reason}</p>
      ) : null}

      <button
        aria-label={buttonLabel}
        disabled={!item.canUse || usePending || scoutingTargetRequired}
        onClick={() => onUse(item.itemId)}
        type="button"
      >
        {usePending
          ? "効果を反映中…"
          : scoutingTargetRequired
            ? "スカウト画面で使用"
            : "使用する"}
      </button>
    </article>
  );
}

export function ShopScreen({
  status,
  loading,
  error,
  state,
  pendingAction = null,
  pendingItemId = null,
  resultMessage = null,
  latestUseResult = null,
  retryAction = null,
  onBack,
  onRetry,
  onRetryMutation = () => undefined,
  onPurchase = () => undefined,
  onUse = () => undefined,
}: ShopScreenProps) {
  const [view, setView] = useState<ShopView>("products");
  const [targetingItemId, setTargetingItemId] = useState<ShopItemId | null>(
    null,
  );
  const [specialCoachPlayerId, setSpecialCoachPlayerId] =
    useState<PlayerId | null>(null);
  const ownedItems =
    status?.items.filter((item) => item.quantityOwned > 0) ?? [];

  const schoolPlayers = useMemo(() => {
    if (!state) return [];
    const school = state.schools[state.userSchoolId];
    if (!school) return [];
    return school.playerIds
      .map((playerId) => state.players[playerId])
      .filter((player) => player !== undefined);
  }, [state]);

  const fatigueRecoveryTargets = useMemo(
    () =>
      schoolPlayers
        .filter((player) => player.fatigue > 0 || player.condition < 100)
        .sort((left, right) => right.fatigue - left.fatigue),
    [schoolPlayers],
  );
  const specialCoachTargets = useMemo(
    () => schoolPlayers.filter((player) => player.injury === null),
    [schoolPlayers],
  );

  const startUse = (itemId: ShopItemId) => {
    if (!state) {
      onUse(itemId);
      return;
    }
    if (itemId === "fatigue-recovery" || itemId === "special-coach") {
      setTargetingItemId(itemId);
      setSpecialCoachPlayerId(null);
      return;
    }
    onUse(itemId);
  };

  const closeTargeting = () => {
    setTargetingItemId(null);
    setSpecialCoachPlayerId(null);
  };

  const selectFatigueTarget = (playerId: PlayerId) => {
    closeTargeting();
    onUse("fatigue-recovery", { type: "player", playerId });
  };

  const selectSpecialCoachFocus = (focus: SpecialCoachFocus) => {
    if (!specialCoachPlayerId) return;
    const playerId = specialCoachPlayerId;
    closeTargeting();
    onUse("special-coach", { type: "special-coach", playerId, focus });
  };

  return (
    <main className="app-content shop-screen">
      <div className="shop-screen__topbar">
        <button onClick={onBack} type="button">
          その他へ戻る
        </button>
        <span>テスト中 / すべて¥0</span>
      </div>

      <section className="shop-screen__heading">
        <p className="section-kicker">ショップ案内</p>
        <h2>ショップ</h2>
        <p>テスト期間中は、すべてのアイテムを¥0で利用できます。</p>
      </section>

      <div aria-label="ショップ表示" className="shop-screen__tabs" role="group">
        <button
          aria-pressed={view === "products"}
          onClick={() => {
            setView("products");
            closeTargeting();
          }}
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
          {retryAction ? (
            <button onClick={onRetryMutation} type="button">
              {retryAction === "purchase" ? "購入を再試行" : "使用を再試行"}
            </button>
          ) : (
            <button onClick={onRetry} type="button">
              再読み込み
            </button>
          )}
        </div>
      ) : null}

      {resultMessage ? (
        <p className="shop-screen__notice shop-screen__notice--success">
          {resultMessage}
        </p>
      ) : null}

      {latestUseResult ? (
        <ShopUseResultPanel presentation={latestUseResult} state={state} />
      ) : null}

      {targetingItemId === "fatigue-recovery" ? (
        <section className="shop-target-panel" aria-label="疲労回復の対象選択">
          <div className="shop-target-panel__heading">
            <h3>回復する選手を選択</h3>
            <button onClick={closeTargeting} type="button">
              戻る
            </button>
          </div>
          {fatigueRecoveryTargets.length > 0 ? (
            <div className="shop-target-list">
              {fatigueRecoveryTargets.map((player) => (
                <button
                  aria-label={`${player.lastName} ${player.firstName} 疲労 ${player.fatigue}`}
                  key={player.id}
                  onClick={() => selectFatigueTarget(player.id)}
                  type="button"
                >
                  <strong>
                    {player.lastName} {player.firstName}
                  </strong>
                  <span>
                    {player.grade}年・{player.preferredPosition} / 疲労{" "}
                    {player.fatigue} / 状態 {player.condition}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="shop-screen__notice">回復が必要な選手はいません。</p>
          )}
        </section>
      ) : targetingItemId === "special-coach" ? (
        <section
          className="shop-target-panel"
          aria-label="特別コーチの対象選択"
        >
          <div className="shop-target-panel__heading">
            <h3>
              {specialCoachPlayerId
                ? "重点育成を選択"
                : "特別コーチの対象選手を選択"}
            </h3>
            <button onClick={closeTargeting} type="button">
              戻る
            </button>
          </div>
          {specialCoachPlayerId ? (
            <div className="shop-focus-grid">
              {specialCoachFocusLabels.map(({ focus, label }) => (
                <button
                  key={focus}
                  onClick={() => selectSpecialCoachFocus(focus)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <div className="shop-target-list">
              {specialCoachTargets.map((player) => (
                <button
                  aria-label={`${player.lastName} ${player.firstName}を選択`}
                  key={player.id}
                  onClick={() => setSpecialCoachPlayerId(player.id)}
                  type="button"
                >
                  <strong>
                    {player.lastName} {player.firstName}
                  </strong>
                  <span>
                    {player.grade}年・{player.preferredPosition} / 疲労{" "}
                    {player.fatigue}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : status ? (
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
                  onUse={startUse}
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
