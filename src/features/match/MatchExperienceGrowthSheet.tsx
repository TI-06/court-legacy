import type { MatchExperienceNotification } from "../../domain/notifications/gameNotifications";
import { BottomSheet } from "../../ui/BottomSheet";
import "./match-experience-growth.css";

interface MatchExperienceGrowthSheetProps {
  notification: MatchExperienceNotification | null;
  onClose: () => void;
}

const abilityLabels = {
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
} as const;

export function MatchExperienceGrowthSheet({
  notification,
  onClose,
}: MatchExperienceGrowthSheetProps) {
  return (
    <BottomSheet
      description="試合経験で伸びた能力だけ表示しています。"
      onClose={onClose}
      open={notification !== null}
      title="試合後の成長"
    >
      {notification ? (
        <div className="match-growth-sheet">
          <div className="match-growth-sheet__summary">
            <span>MATCH EXPERIENCE</span>
            <strong>{notification.payload.players.length}人が成長</strong>
          </div>
          <div className="match-growth-sheet__players">
            {notification.payload.players.map((player) => (
              <article key={player.playerId}>
                <header>
                  <strong>{player.displayName}</strong>
                  <span>
                    {player.grade}年・{player.preferredPosition}
                  </span>
                </header>
                <div className="match-growth-sheet__abilities">
                  {player.abilityProgress.map((progress) => (
                    <div key={progress.ability}>
                      <span>{abilityLabels[progress.ability]}</span>
                      <b>
                        {progress.before} {progress.beforeGrade}
                      </b>
                      <em aria-hidden="true">→</em>
                      <strong>
                        {progress.after} {progress.afterGrade}
                      </strong>
                      <small>+{progress.change}</small>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
