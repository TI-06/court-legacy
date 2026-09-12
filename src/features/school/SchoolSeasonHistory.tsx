import type { SeasonResultPresentation } from "../season/seasonResultPresentation";
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
    <details className="school-season-history__card" open={expanded}>
      <summary>
        <div>
          <h5>{presentation.academicYear}年目</h5>
          <span>
            {presentation.achievedCount}/{presentation.goalCount}目標達成
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
              key={goal.id}
            >
              <div>
                <strong>{goal.label}</strong>
                <small>{goal.progressLabel}</small>
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
  if (presentations.length === 0) {
    return null;
  }

  return (
    <section aria-label="過去シーズン" className="school-season-history">
      <div className="school-season-history__heading">
        <div>
          <span>シーズン履歴</span>
          <h4>過去シーズン</h4>
        </div>
        <strong>{presentations.length}年分</strong>
      </div>

      <div className="school-season-history__list">
        {presentations.map((presentation, index) => (
          <SeasonHistoryCard
            expanded={index === 0}
            key={`${presentation.academicYear}-${index}`}
            presentation={presentation}
          />
        ))}
      </div>
    </section>
  );
}
