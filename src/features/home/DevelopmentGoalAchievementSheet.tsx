import type { DevelopmentGoalAchievementNotification } from "../../domain/notifications/gameNotifications";
import type { PlayerId } from "../../domain/model/identifiers";
import { BottomSheet } from "../../ui/BottomSheet";
import "./training-result-notification.css";

interface DevelopmentGoalAchievementSheetProps {
  notification: DevelopmentGoalAchievementNotification | null;
  onClose: () => void;
  onOpenPlayerGrowth: (playerId: PlayerId) => void;
}

export function DevelopmentGoalAchievementSheet({
  notification,
  onClose,
  onOpenPlayerGrowth,
}: DevelopmentGoalAchievementSheetProps) {
  return (
    <BottomSheet
      description={
        notification
          ? `第${notification.weekOfYear}週・達成した選手を確認できます`
          : undefined
      }
      onClose={onClose}
      open={notification !== null}
      title="育成目標達成"
    >
      {notification ? (
        <div className="development-goal-achievement">
          <div className="development-goal-achievement__hero">
            <span>GOAL COMPLETE</span>
            <strong>{notification.payload.items.length}人が目標達成</strong>
            <p>次の育成目標を設定して、成長をつなげましょう。</p>
          </div>

          <div
            aria-label="育成目標を達成した選手"
            className="development-goal-achievement__list"
          >
            {notification.payload.items.map((item) => (
              <button
                aria-label={`${item.displayName}の成長画面を開く`}
                key={item.playerId}
                onClick={() => onOpenPlayerGrowth(item.playerId)}
                type="button"
              >
                <span>
                  <strong>{item.displayName}</strong>
                  <small>{item.areaLabel}</small>
                </span>
                <b>{item.achievedGrade} 達成</b>
                <em aria-hidden="true">›</em>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
