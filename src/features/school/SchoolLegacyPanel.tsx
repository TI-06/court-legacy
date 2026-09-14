import type {
  SchoolLegacyPresentation,
  SchoolLegacyOpponentPresentation,
} from "../season/seasonProgressPresentation";
import "./school-legacy.css";

const labelText = {
  "destiny-rival": "宿敵",
  rivalry: "因縁",
  nemesis: "天敵",
  revenge: "雪辱戦",
  "winning-streak": "連勝中",
  "losing-streak": "連敗中",
} as const;

function formatDate(value: string): string {
  const [, month, day] = value.split("-").map(Number);
  if (!month || !day) return value;
  return `${month}/${day}`;
}

function RivalryChips({
  opponent,
}: {
  opponent: SchoolLegacyOpponentPresentation;
}) {
  const visible = opponent.labels.slice(0, 3);
  if (visible.length === 0) return null;
  return (
    <div className="school-legacy__chips" aria-label="因縁ラベル">
      {visible.map((label) => (
        <span key={label}>{labelText[label]}</span>
      ))}
    </div>
  );
}

export function SchoolLegacyPanel({
  presentation,
}: {
  presentation: SchoolLegacyPresentation;
}) {
  if (
    presentation.opponents.length === 0 &&
    presentation.notableMatches.length === 0
  ) {
    return null;
  }

  return (
    <section className="school-legacy" aria-label="対戦史">
      <div className="school-legacy__heading">
        <div>
          <span>RIVALRY</span>
          <h4>対戦史</h4>
        </div>
        <small>過去の対戦から自動集計</small>
      </div>

      {presentation.opponents.length > 0 ? (
        <div className="school-legacy__opponents">
          {presentation.opponents.map((opponent) => (
            <article
              className="school-legacy__opponent"
              data-testid="school-legacy-opponent"
              key={opponent.schoolId}
            >
              <div className="school-legacy__opponent-main">
                <div>
                  <strong>{opponent.displayName}</strong>
                  <small>{opponent.meetingLabel}</small>
                </div>
                <b>{opponent.recordLabel}</b>
              </div>
              <div className="school-legacy__opponent-meta">
                <RivalryChips opponent={opponent} />
                {opponent.streakLabel ? (
                  <span>{opponent.streakLabel}</span>
                ) : null}
                {opponent.rivalryScore > 0 ? (
                  <small>因縁度 {opponent.rivalryScore}</small>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {presentation.notableMatches.length > 0 ? (
        <div className="school-legacy__notable">
          <h5>記憶に残る試合</h5>
          {presentation.notableMatches.map((match) => (
            <article key={match.matchId}>
              <time>{formatDate(match.date)}</time>
              <div>
                <strong>{match.opponentName}</strong>
                <small>{match.reasons.join("・")}</small>
              </div>
              <b>{match.resultLabel}</b>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
