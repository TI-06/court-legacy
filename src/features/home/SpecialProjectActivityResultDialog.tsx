import type { UniversityJointTrainingResult } from "../../domain/school/schoolSpecialProjectActivities";
import "./training-camp-result.css";

interface SpecialProjectActivityResultDialogProps {
  result: UniversityJointTrainingResult;
  onClose: () => void;
}

const focusLabels = {
  attack: "攻撃",
  defense: "守備",
  physical: "フィジカル",
} as const;

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

export function SpecialProjectActivityResultDialog({
  result,
  onClose,
}: SpecialProjectActivityResultDialogProps) {
  return (
    <div className="training-camp-event-layer">
      <section
        aria-labelledby="special-project-activity-result-title"
        aria-modal="true"
        className="training-camp-event"
        role="dialog"
      >
        <header className="training-camp-event__header">
          <span>特別事業</span>
          <h2 id="special-project-activity-result-title">
            大学チーム合同練習の結果
          </h2>
          <p>{focusLabels[result.focus]}をテーマにした合同練習を終えました。</p>
        </header>

        <main className="training-camp-event__content">
          <div
            aria-label="大学チーム合同練習サマリー"
            className="training-camp-event__summary"
          >
            <div>
              <span>テーマ</span>
              <strong>{focusLabels[result.focus]}</strong>
            </div>
            <div>
              <span>参加</span>
              <strong>{result.participantCount}人</strong>
            </div>
            <div>
              <span>能力成長</span>
              <strong>{signed(result.totalAbilityGrowth)}</strong>
            </div>
            <div
              data-tone={
                result.injuredPlayerIds.length > 0 ? "danger" : "normal"
              }
            >
              <span>怪我</span>
              <strong>{result.injuredPlayerIds.length}人</strong>
            </div>
          </div>

          <p className="training-camp-event__note">
            合同練習の成長・疲労・怪我は現在の選手状態へ反映されています。
          </p>
        </main>

        <footer className="training-camp-event__actions">
          <button onClick={onClose} type="button">
            結果を確認した
          </button>
        </footer>
      </section>
    </div>
  );
}
