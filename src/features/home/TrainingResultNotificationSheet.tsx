import type { TrainingResultNotification } from "../../domain/notifications/gameNotifications";
import { BottomSheet } from "../../ui/BottomSheet";
import "./training-result-notification.css";

interface TrainingResultNotificationSheetProps {
  notification: TrainingResultNotification | null;
  onClose: () => void;
}

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
        </div>
      ) : null}
    </BottomSheet>
  );
}
