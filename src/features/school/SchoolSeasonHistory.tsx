import { useState } from "react";
import type { SeasonResultPresentation } from "../season/seasonResultPresentation";
import { BottomSheet } from "../../ui/BottomSheet";
import "./school-season-history.css";

interface SchoolSeasonHistoryProps {
  presentations: readonly SeasonResultPresentation[];
}

function rankMovementLabel(movement: number): string {
  if (movement > 0) return `▲${movement}`;
  if (movement < 0) return `▼${Math.abs(movement)}`;
  return "→0";
}

function SeasonHistoryCard({
  presentation,
  expanded,
}: {
  presentation: SeasonResultPresentation;
  expanded: boolean;
}) {
  return (
    <details
      className="school-season-history__card"
      data-testid="school-season-history-card"
      open={expanded}
    >
      <summary>
        <div>
          <h5>{presentation.academicYear}年目</h5>
          <span>
            {presentation.achievedCount}/{presentation.goalCount}目標達成・報酬
            +{presentation.earnedRewardFunds}
          </span>
        </div>
        <div className="school-season-history__final-ranks">
          <span>県内 {presentation.regional.finalRank}位</span>
          <span>全国 {presentation.national.finalRank}位</span>
        </div>
      </summary>

      <div className="school-season-history__body">
        <div className="school-season-history__rank-change">
          <span>
            県内 {presentation.regional.startingRank}位 →{" "}
            {presentation.regional.finalRank}位
            <b
              className={
                presentation.regional.movement < 0 ? "is-down" : undefined
              }
            >
              {rankMovementLabel(presentation.regional.movement)}
            </b>
          </span>
          <span>
            全国 {presentation.national.startingRank}位 →{" "}
            {presentation.national.finalRank}位
            <b
              className={
                presentation.national.movement < 0 ? "is-down" : undefined
              }
            >
              {rankMovementLabel(presentation.national.movement)}
            </b>
          </span>
        </div>

        <div className="school-season-history__goals">
          {presentation.goals.map((goal) => (
            <article
              className={goal.achieved ? "is-achieved" : undefined}
              data-testid={`school-season-history-goal-${goal.id}`}
              key={goal.id}
            >
              <div>
                <strong>{goal.label}</strong>
                <small>
                  {goal.progressLabel}
                  {goal.achieved ? `・+${goal.rewardFunds}獲得` : ""}
                </small>
              </div>
              <b>{goal.achieved ? "達成" : "未達成"}</b>
            </article>
          ))}
        </div>

        <div className="school-season-history__results">
          <span>
            公式戦勝利<strong>{presentation.deltas.officialWins}</strong>
          </span>
          <span>
            県優勝<strong>{presentation.deltas.prefecturalTitles}</strong>
          </span>
          <span>
            全国出場<strong>{presentation.deltas.nationalAppearances}</strong>
          </span>
          <span>
            全国優勝<strong>{presentation.deltas.nationalTitles}</strong>
          </span>
        </div>
      </div>
    </details>
  );
}

export function SchoolSeasonHistory({
  presentations,
}: SchoolSeasonHistoryProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (presentations.length === 0) {
    return null;
  }

  const preview = presentations.slice(0, 3);

  return (
    <>
      <section aria-label="過去シーズン" className="school-season-history">
        <div className="school-season-history__heading">
          <div>
            <span>シーズン履歴</span>
            <h4>過去シーズン</h4>
          </div>
          <strong>{presentations.length}年分</strong>
        </div>

        <div className="school-season-history__list">
          {preview.map((presentation, index) => (
            <SeasonHistoryCard
              expanded={index === 0}
              key={`${presentation.academicYear}-${index}`}
              presentation={presentation}
            />
          ))}
        </div>

        {presentations.length > preview.length ? (
          <button
            aria-label={`過去${presentations.length}年分をすべて見る`}
            className="school-season-history__all"
            onClick={() => setArchiveOpen(true)}
            type="button"
          >
            <span>すべてのシーズン</span>
            <b aria-hidden="true">›</b>
          </button>
        ) : null}
      </section>

      <BottomSheet
        className="ui-bottom-sheet--game-choice"
        description={`保存されている過去${presentations.length}年分のシーズン結果です。`}
        onClose={() => setArchiveOpen(false)}
        open={archiveOpen}
        title="過去シーズン一覧"
      >
        <div className="school-season-history__archive-list">
          {presentations.map((presentation, index) => (
            <SeasonHistoryCard
              expanded={false}
              key={`archive-${presentation.academicYear}-${index}`}
              presentation={presentation}
            />
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
