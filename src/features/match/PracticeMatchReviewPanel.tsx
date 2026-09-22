import { isWeeklyActionCompleted } from "../../domain/calendar/weekProgression";
import type { GameState } from "../../domain/model/GameState";
import type { MatchState } from "../../domain/model/Match";
import { buildPracticeMatchReview } from "./practiceMatchReview";

export function PracticeMatchReviewPanel({
  state,
  match,
  homeStrength,
  awayStrength,
  onApplyTrainingRecommendation,
  pending = false,
}: {
  state: GameState;
  match: MatchState;
  homeStrength: number;
  awayStrength: number;
  onApplyTrainingRecommendation?: (menuId: string) => void | Promise<void>;
  pending?: boolean;
}) {
  const review = buildPracticeMatchReview({
    state,
    match,
    homeStrength,
    awayStrength,
  });
  const trainingCompleted = isWeeklyActionCompleted(state, "training");

  return (
    <section aria-label="練習試合レビュー" className="practice-match-review">
      <div className="practice-match-review__heading">
        <div>
          <p className="section-kicker">PRACTICE REVIEW</p>
          <h2>{review.headline}</h2>
        </div>
        <strong>{review.alignmentLabel}</strong>
      </div>

      <div className="practice-match-review__facts">
        <span>
          <small>今季方針</small>
          <b>{review.ambitionLabel}</b>
        </span>
        <span>
          <small>今回の相手</small>
          <b>{review.tierLabel}</b>
        </span>
        <span>
          <small>戦力比較</small>
          <b>{review.strengthDifferenceLabel}</b>
        </span>
      </div>

      <p>{review.nextRecommendation}</p>

      <div
        aria-label="練習試合後の重点練習"
        className="practice-match-review__training"
      >
        <div>
          <span>NEXT TRAINING</span>
          <strong>{review.trainingRecommendation.menuName}</strong>
          <small>{review.trainingRecommendation.reason}</small>
        </div>
        <button
          disabled={
            pending ||
            trainingCompleted ||
            !onApplyTrainingRecommendation
          }
          onClick={() => {
            void onApplyTrainingRecommendation?.(
              review.trainingRecommendation.menuId,
            );
          }}
          type="button"
        >
          {trainingCompleted
            ? "今週の練習は実施済み"
            : pending
              ? "保存中…"
              : "この練習を設定"}
        </button>
      </div>
    </section>
  );
}
