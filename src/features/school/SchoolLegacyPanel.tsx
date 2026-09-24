import { useState } from "react";
import type {
  SchoolLegacyMatchPresentation,
  SchoolLegacyPresentation,
  SchoolLegacyOpponentPresentation,
} from "../season/seasonProgressPresentation";
import { BottomSheet } from "../../ui/BottomSheet";
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

function OpponentCard({
  opponent,
}: {
  opponent: SchoolLegacyOpponentPresentation;
}) {
  return (
    <article
      className="school-legacy__opponent"
      data-testid="school-legacy-opponent"
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
        {opponent.streakLabel ? <span>{opponent.streakLabel}</span> : null}
        {opponent.rivalryScore > 0 ? (
          <small>因縁度 {opponent.rivalryScore}</small>
        ) : null}
      </div>
    </article>
  );
}

function NotableMatchRow({
  match,
}: {
  match: SchoolLegacyMatchPresentation;
}) {
  return (
    <article data-testid="school-legacy-notable-match">
      <time>{formatDate(match.date)}</time>
      <div>
        <strong>{match.opponentName}</strong>
        <small>{match.reasons.join("・")}</small>
      </div>
      <b>{match.resultLabel}</b>
    </article>
  );
}

function LegacyContent({
  opponents,
  notableMatches,
}: {
  opponents: readonly SchoolLegacyOpponentPresentation[];
  notableMatches: readonly SchoolLegacyMatchPresentation[];
}) {
  return (
    <>
      {opponents.length > 0 ? (
        <div className="school-legacy__opponents">
          {opponents.map((opponent) => (
            <OpponentCard key={opponent.schoolId} opponent={opponent} />
          ))}
        </div>
      ) : null}

      {notableMatches.length > 0 ? (
        <div className="school-legacy__notable">
          <h5>記憶に残る試合</h5>
          {notableMatches.map((match) => (
            <NotableMatchRow key={match.matchId} match={match} />
          ))}
        </div>
      ) : null}
    </>
  );
}

export function SchoolLegacyPanel({
  presentation,
}: {
  presentation: SchoolLegacyPresentation;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (
    presentation.opponents.length === 0 &&
    presentation.notableMatches.length === 0
  ) {
    return null;
  }

  const previewOpponents = presentation.opponents.slice(0, 2);
  const previewMatches = presentation.notableMatches.slice(0, 2);
  const hasMore =
    presentation.opponents.length > previewOpponents.length ||
    presentation.notableMatches.length > previewMatches.length;

  return (
    <>
      <section className="school-legacy" aria-label="対戦史">
        <div className="school-legacy__heading">
          <div>
            <span>RIVALRY</span>
            <h4>対戦史</h4>
          </div>
          <small>
            {presentation.opponents.length}校・記憶
            {presentation.notableMatches.length}試合
          </small>
        </div>

        <LegacyContent
          notableMatches={previewMatches}
          opponents={previewOpponents}
        />

        {hasMore ? (
          <button
            aria-label="対戦史をすべて見る"
            className="school-legacy__all"
            onClick={() => setArchiveOpen(true)}
            type="button"
          >
            <span>すべての対戦史</span>
            <b aria-hidden="true">›</b>
          </button>
        ) : null}
      </section>

      <BottomSheet
        className="ui-bottom-sheet--game-choice"
        description={`対戦校${presentation.opponents.length}校と記憶に残る${presentation.notableMatches.length}試合を表示します。`}
        onClose={() => setArchiveOpen(false)}
        open={archiveOpen}
        title="対戦史一覧"
      >
        <div className="school-legacy__archive">
          <LegacyContent
            notableMatches={presentation.notableMatches}
            opponents={presentation.opponents}
          />
        </div>
      </BottomSheet>
    </>
  );
}
