import type { GameState } from "../../domain/model/GameState";
import type { UniversityJointTrainingResult } from "../../domain/school/specialProjectActivities";
import "./training-camp-result.css";

interface SpecialProjectActivityResultDialogProps {
  state: GameState;
  result: UniversityJointTrainingResult;
  onClose: () => void;
}

const focusLabels = {
  attack: "攻撃",
  defense: "守備",
  physical: "フィジカル",
} as const;

function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded >= 0 ? `+${rounded}` : String(rounded);
}

export function SpecialProjectActivityResultDialog({
  state,
  result,
  onClose,
}: SpecialProjectActivityResultDialogProps) {
  const topGrowth = [...result.playerLogs]
    .filter((log) => log.totalAbilityGrowth > 0)
    .sort(
      (left, right) =>
        right.totalAbilityGrowth - left.totalAbilityGrowth ||
        String(left.playerId).localeCompare(String(right.playerId)),
    )
    .slice(0, 3);

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
          <p>
            {focusLabels[result.focus]}をテーマにした合同練習が終了しました。
          </p>
        </header>

        <main className="training-camp-event__content">
          <div
            aria-label="大学合同練習サマリー"
            className="training-camp-event__summary"
          >
            <div>
              <span>参加</span>
              <strong>{result.participantCount}人</strong>
            </div>
            <div>
              <span>能力成長</span>
              <strong>{signed(result.totalAbilityGrowth)}</strong>
            </div>
            <div>
              <span>平均疲労</span>
              <strong>{signed(result.averageFatigueChange)}</strong>
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

          <section className="training-camp-event__growth">
            <div className="training-camp-event__section-heading">
              <span>GROWTH</span>
              <h3>成長した選手</h3>
            </div>
            {topGrowth.length > 0 ? (
              <div className="training-camp-event__growth-list">
                {topGrowth.map((growth, index) => {
                  const player = state.players[growth.playerId];
                  if (!player) return null;
                  return (
                    <article key={growth.playerId}>
                      <span className="training-camp-event__rank">
                        {index + 1}
                      </span>
                      <div>
                        <strong>
                          {player.lastName} {player.firstName}
                        </strong>
                        <small>
                          {player.grade}年・{player.preferredPosition}
                        </small>
                      </div>
                      <b>{signed(growth.totalAbilityGrowth)}</b>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="training-camp-event__note">
                今回は能力値の上昇はありませんでした。
              </p>
            )}
          </section>

          <p className="training-camp-event__note">
            合同練習の成長・疲労・怪我は、次週開始時点の選手状態へ反映されています。
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
