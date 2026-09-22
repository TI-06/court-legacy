import type { GameState } from "../../domain/model/GameState";
import type { MatchState } from "../../domain/model/Match";
import { buildPracticeMatchReview } from "./practiceMatchReview";

export function PracticeMatchReviewPanel({
  state,
  match,
  homeStrength,
  awayStrength,
}: {
  state: GameState;
  match: MatchState;
  homeStrength: number;
  awayStrength: number;
}) {
  const review = buildPracticeMatchReview({
    state,
    match,
    homeStrength,
    awayStrength,
  });

  return (
    <section
      aria-label="練習試合レビュー"
      className="practice-match-review"
    >
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
    </section>
  );
}
