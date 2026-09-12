import type {
  SeasonProgressPresentation,
  SeasonRankingPresentation,
} from "../season/seasonProgressPresentation";
import "./school-season-ranking.css";

function rankMovementLabel(movement: number): string {
  if (movement > 0) return `▲${movement}`;
  if (movement < 0) return `▼${Math.abs(movement)}`;
  return "→0";
}

function RankingScope({
  label,
  ranking,
}: {
  label: "県内" | "全国";
  ranking: SeasonRankingPresentation;
}) {
  return (
    <section
      aria-label={`${label}ランキング`}
      className="school-season-ranking__scope"
    >
      <div className="school-season-ranking__scope-heading">
        <div>
          <span>{label}ランキング</span>
          <strong>
            {ranking.rank}位 / {ranking.total}校
          </strong>
        </div>
        <b className={ranking.movement < 0 ? "is-down" : undefined}>
          {rankMovementLabel(ranking.movement)}
        </b>
      </div>
      <small>開始時 {ranking.startingRank}位</small>

      <div className="school-season-ranking__nearby" aria-label={`${label}周辺校`}>
        {ranking.nearby.map((row) => (
          <div
            className={`school-season-ranking__row${row.isUserSchool ? " is-user" : ""}`}
            data-testid={
              row.isUserSchool
                ? "school-ranking-user-row"
                : "school-ranking-row"
            }
            key={row.schoolId}
          >
            <b>{row.rank}</b>
            <span title={row.displayName}>{row.shortName}</span>
            <small>評判 {row.reputationPoints}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SchoolSeasonRanking({
  presentation,
}: {
  presentation: SeasonProgressPresentation;
}) {
  return (
    <section className="school-season-ranking" aria-label="今季ランキング">
      <div className="school-season-ranking__heading">
        <div>
          <span>SEASON</span>
          <h4>今季ランキング</h4>
        </div>
        <strong>
          {presentation.achievedCount}/{presentation.goalCount} 目標達成
        </strong>
      </div>

      <div className="school-season-ranking__goals">
        {presentation.goals.map((goal) => (
          <article className={goal.achieved ? "is-achieved" : undefined} key={goal.id}>
            <div>
              <strong>{goal.label}</strong>
              <small>{goal.progressLabel}</small>
            </div>
            <b aria-label={goal.achieved ? "達成済み" : "挑戦中"}>
              {goal.achieved ? "✓" : "進行中"}
            </b>
          </article>
        ))}
      </div>

      <div className="school-season-ranking__scopes">
        <RankingScope label="県内" ranking={presentation.regional} />
        <RankingScope label="全国" ranking={presentation.national} />
      </div>
    </section>
  );
}
