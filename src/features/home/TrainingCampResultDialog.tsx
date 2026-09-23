import type { GameState } from "../../domain/model/GameState";
import type { TrainingCampResult } from "../../domain/shop/shopEffects";
import "./training-camp-result.css";

interface TrainingCampResultDialogProps {
  state: GameState;
  result: TrainingCampResult;
  pending: boolean;
  onAcknowledge: () => void | Promise<void>;
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

export function TrainingCampResultDialog({
  state,
  result,
  pending,
  onAcknowledge,
}: TrainingCampResultDialogProps) {
  return (
    <div className="training-camp-event-layer">
      <section
        aria-labelledby="training-camp-result-title"
        aria-modal="true"
        className="training-camp-event"
        role="dialog"
      >
        <header className="training-camp-event__header">
          <span>特別イベント</span>
          <h2 id="training-camp-result-title">強化合宿の結果</h2>
          <p>先週の強化合宿を終え、選手たちが帰ってきました。</p>
        </header>

        <main className="training-camp-event__content">
          <div
            aria-label="強化合宿サマリー"
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
            <div data-tone={result.injuredPlayerIds.length > 0 ? "danger" : "normal"}>
              <span>怪我</span>
              <strong>{result.injuredPlayerIds.length}人</strong>
            </div>
          </div>

          {result.topGrowth.length > 0 ? (
            <section
              aria-label="合宿で伸びた選手"
              className="training-camp-event__growth"
            >
              <div className="training-camp-event__section-heading">
                <span>GROWTH</span>
                <h3>伸びた選手</h3>
              </div>
              <div className="training-camp-event__growth-list">
                {result.topGrowth.map((growth, index) => {
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
            </section>
          ) : null}

          <p className="training-camp-event__note">
            合宿の成長・疲労・怪我は次週開始時点の選手状態へ反映されています。
          </p>
        </main>

        <footer className="training-camp-event__actions">
          <button
            disabled={pending}
            onClick={() => void onAcknowledge()}
            type="button"
          >
            {pending ? "保存中…" : "結果を確認した"}
          </button>
        </footer>
      </section>
    </div>
  );
}
