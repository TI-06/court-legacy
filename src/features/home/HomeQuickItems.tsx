import { VolleyballLoader } from "../../ui/status/VolleyballLoader";
import { useState } from "react";
import type { GameState } from "../../domain/model/GameState";
import type { PlayerId } from "../../domain/model/identifiers";
import type { ShopItemId } from "../../domain/shop/shopCatalog";
import type {
  ShopStatusResponse,
  ShopUseTarget,
} from "../../domain/shop/shopContracts";
import {
  SPECIAL_COACH_FOCUS_ABILITIES,
  type SpecialCoachFocus,
} from "../../domain/shop/shopEffects";
import { BottomSheet } from "../../ui/BottomSheet";
import { ShopUseResultPanel } from "../shop/ShopScreen";
import type { ShopUsePresentation } from "../shop/shopUsePresentation";
import "./home-quick-items.css";

const HOME_ITEM_IDS: readonly ShopItemId[] = [
  "training-camp",
  "training-efficiency-boost",
  "fatigue-recovery",
  "special-coach",
];

const FOCUS_LABELS: Record<SpecialCoachFocus, string> = {
  spike: "スパイク",
  serve: "サーブ",
  receive: "レシーブ",
  block: "ブロック",
  physical: "フィジカル",
  decision: "判断力",
};

interface HomeQuickItemsProps {
  state: GameState;
  status: ShopStatusResponse | null;
  loading: boolean;
  error: string | null;
  pending: boolean;
  resultMessage: string | null;
  retryAvailable: boolean;
  latestUseResult?: ShopUsePresentation | null;
  onRetry: () => void;
  onRetryMutation: () => void;
  onOpenShop: () => void;
  onUse: (itemId: ShopItemId, target?: ShopUseTarget) => void;
}

export function HomeQuickItems({
  state,
  status,
  loading,
  error,
  pending,
  resultMessage,
  retryAvailable,
  latestUseResult = null,
  onRetry,
  onRetryMutation,
  onOpenShop,
  onUse,
}: HomeQuickItemsProps) {
  const [targetItem, setTargetItem] = useState<
    "fatigue-recovery" | "special-coach" | null
  >(null);
  const [coachPlayerId, setCoachPlayerId] = useState<PlayerId | null>(null);
  const playerIds = state.schools[state.userSchoolId]?.playerIds ?? [];
  const players = playerIds
    .map((id) => state.players[id])
    .filter((player) => player !== undefined);
  const eligiblePlayers =
    targetItem === "fatigue-recovery"
      ? players.filter((player) => player.fatigue > 0 || player.condition < 100)
      : players.filter((player) => player.injury === null);
  const trainingCampReserved = Boolean(
    state.shopEffects?.pendingTrainingCamp ||
    (latestUseResult?.itemId === "training-camp" &&
      latestUseResult.result.pending === true),
  );
  const items = HOME_ITEM_IDS.flatMap((id) => {
    // A reserved camp is no longer an actionable item. Its status is shown
    // once above the list, even after consuming the final inventory item.
    if (id === "training-camp" && trainingCampReserved) return [];
    const item = status?.items.find((entry) => entry.itemId === id);
    return item && item.quantityOwned > 0 ? [item] : [];
  });
  const unusable = pending || loading;

  const closeTargets = () => {
    setTargetItem(null);
    setCoachPlayerId(null);
  };
  const chooseItem = (id: ShopItemId) => {
    if (id === "fatigue-recovery" || id === "special-coach") {
      setTargetItem(id);
      setCoachPlayerId(null);
      return;
    }
    onUse(id);
  };

  return (
    <div className="home-quick-items" data-testid="home-quick-items">
      <div className="home-quick-items__heading">
        <strong>アイテムを使う</strong>
        <button onClick={onOpenShop} type="button">
          ショップへ
        </button>
      </div>
      {error ? (
        <div className="home-quick-items__error" role="alert">
          <span>{error}</span>
          <button
            onClick={retryAvailable ? onRetryMutation : onRetry}
            type="button"
          >
            {retryAvailable ? "同じ操作を再試行" : "再読み込み"}
          </button>
        </div>
      ) : null}
      {!error &&
      latestUseResult &&
      latestUseResult.itemId !== "training-camp" ? (
        <ShopUseResultPanel presentation={latestUseResult} state={state} />
      ) : !error &&
        !latestUseResult &&
        resultMessage &&
        !resultMessage.includes("合宿を予約") ? (
        <p className="home-quick-items__success" role="status">
          {resultMessage}
        </p>
      ) : !error && trainingCampReserved ? (
        <p className="home-quick-items__reservation" role="status">
          強化合宿：予約中（次週結果）
        </p>
      ) : null}
      {loading ? (
        <p className="home-quick-items__empty" role="status">
          <VolleyballLoader size="small" />
          所持アイテムを確認中…
        </p>
      ) : items.length === 0 ? (
        trainingCampReserved ? null : (
          <p className="home-quick-items__empty">
            {status
              ? "使用できるアイテムはありません"
              : "所持品を読み込めませんでした"}
          </p>
        )
      ) : (
        <div className="home-quick-items__list">
          {items.map((item) => {
            const alreadyActive =
              (item.itemId === "training-camp" &&
                Boolean(state.shopEffects?.pendingTrainingCamp)) ||
              (item.itemId === "training-efficiency-boost" &&
                Boolean(state.shopEffects?.nextTrainingGrowthBoost));
            return (
              <article className="home-quick-items__row" key={item.itemId}>
                <div>
                  <strong>{item.displayName}</strong>
                  <small>所持 {item.quantityOwned}個</small>
                </div>
                <button
                  disabled={unusable || !item.canUse || alreadyActive}
                  onClick={() => chooseItem(item.itemId)}
                  type="button"
                >
                  {pending ? <VolleyballLoader size="tiny" /> : null}
                  {pending ? "処理中…" : alreadyActive ? "適用中" : "使用"}
                </button>
              </article>
            );
          })}
        </div>
      )}
      <BottomSheet
        description={
          targetItem === "fatigue-recovery"
            ? "疲労が残っている選手を選択してください。"
            : "育成する選手と重点能力を選択してください。"
        }
        onClose={closeTargets}
        open={targetItem !== null}
        title={targetItem === "fatigue-recovery" ? "疲労回復" : "特別コーチ"}
      >
        {targetItem === "special-coach" && coachPlayerId ? (
          <div className="home-quick-items__targets">
            {Object.keys(SPECIAL_COACH_FOCUS_ABILITIES).map((focus) => (
              <button
                disabled={pending}
                key={focus}
                onClick={() => {
                  onUse("special-coach", {
                    type: "special-coach",
                    playerId: coachPlayerId,
                    focus: focus as SpecialCoachFocus,
                  });
                  closeTargets();
                }}
                type="button"
              >
                {FOCUS_LABELS[focus as SpecialCoachFocus]}
              </button>
            ))}
          </div>
        ) : eligiblePlayers.length ? (
          <div className="home-quick-items__targets">
            {eligiblePlayers.map((player) => (
              <button
                disabled={pending}
                key={player.id}
                onClick={() => {
                  if (targetItem === "fatigue-recovery") {
                    onUse("fatigue-recovery", {
                      type: "player",
                      playerId: player.id,
                    });
                    closeTargets();
                  } else {
                    setCoachPlayerId(player.id);
                  }
                }}
                type="button"
              >
                {player.lastName} {player.firstName}・{player.preferredPosition}
                {targetItem === "fatigue-recovery"
                  ? `・疲労 ${player.fatigue}`
                  : ""}
              </button>
            ))}
          </div>
        ) : (
          <p className="home-quick-items__empty">対象の選手がいません</p>
        )}
      </BottomSheet>
    </div>
  );
}
