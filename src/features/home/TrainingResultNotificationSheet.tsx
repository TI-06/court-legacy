import type { TrainingResultNotification } from "../../domain/notifications/gameNotifications";
import type { AbilityKey } from "../../domain/validation/gameDataSchema";
import { BottomSheet } from "../../ui/BottomSheet";
import "./training-result-notification.css";

interface TrainingResultNotificationSheetProps {
  notification: TrainingResultNotification | null;
  onClose: () => void;
}

const abilityLabels: Record<AbilityKey, string> = {
  spike: "スパイク",
  jump: "ジャンプ",
  receive: "レシーブ",
  serve: "サーブ",
  set: "トス",
  block: "ブロック",
  speed: "スピード",
  stamina: "スタミナ",
  decision: "判断",
  mental: "メンタル",
};

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function TrainingResultNotificationSheet({
  notification,
  onClose,
}: TrainingResultNotificationSheetProps) {
  return (
    <BottomSheet
      open={notification !== null}
      title="今週の練習結果"
      description={
        notification
          ? `第${notification.weekOfYear}週・${notification.createdGameDate}`
          : undefined
      }
      onClose={onClose}
    >
      {notification ? (
        <div className="training-result-notification">
          <div className="training-result-notification__menu">
            <span>チーム練習</span>
            <strong>{notification.payload.teamTrainingMenuName}</strong>
          </div>
          <div
            className="training-result-notification__summary"
            aria-label="練習結果サマリー"
          >
            <div>
              <span>能力成長</span>
              <strong>{signed(notification.payload.totalAbilityGrowth)}</strong>
            </div>
            <div>
              <span>疲労</span>
              <strong>{signed(notification.payload.totalFatigueChange)}</strong>
            </div>
            <div>
              <span>怪我</span>
              <strong>{notification.payload.injuredCount}人</strong>
            </div>
          </div>

          {notification.payload.players.length > 0 ? (
            <section
              className="training-result-notification__players"
              aria-label="選手別結果"
            >
              <h3>選手別</h3>
              <div className="training-result-notification__player-list">
                {notification.payload.players.map((player) => {
                  const abilityChanges = Object.entries(
                    player.abilityChanges,
                  ).filter(
                    (entry): entry is [AbilityKey, number] =>
                      typeof entry[1] === "number" && entry[1] !== 0,
                  );

                  return (
                    <article
                      className="training-result-notification__player"
                      key={player.playerId}
                    >
                      <header>
                        <strong>{player.displayName}</strong>
                        <span>
                          {player.grade}年・{player.preferredPosition}
                        </span>
                      </header>

                      {abilityChanges.length > 0 ? (
                        <div className="training-result-notification__abilities">
                          {abilityChanges.map(([ability, value]) => (
                            <span key={ability}>
                              {abilityLabels[ability]} {signed(value)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="training-result-notification__no-growth">
                          能力変化なし
                        </p>
                      )}

                      <div className="training-result-notification__changes">
                        <span>疲労 {signed(player.fatigueChange)}</span>
                        <span>
                          コンディション {signed(player.conditionChange)}
                        </span>
                        <span>信頼 {signed(player.trustChange)}</span>
                        <span className={player.injured ? "is-injured" : ""}>
                          {player.injured ? "怪我あり" : "怪我なし"}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}
