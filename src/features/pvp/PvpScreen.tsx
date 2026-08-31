import type {
  PvpChallengeResponse,
  PvpHistoryEntry,
  PvpOpponentSummary,
  PvpPublishedTeamSummary,
  PvpRankingEntry,
} from "../../domain/pvp/pvpContracts";
import "./pvp.css";

export interface PvpScreenProps {
  publishedTeam: PvpPublishedTeamSummary | null;
  seasonId: string | null;
  opponents: PvpOpponentSummary[];
  ranking: PvpRankingEntry[];
  history: PvpHistoryEntry[];
  result: PvpChallengeResponse | null;
  loading: boolean;
  publishing: boolean;
  challengingSnapshotId: string | null;
  error: string | null;
  onPublish: () => void;
  onRefresh: () => void;
  onChallenge: (snapshotId: string) => void;
  onReturnPractice: () => void;
}

function signedRatingDelta(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function outcomeLabel(outcome: "win" | "loss"): string {
  return outcome === "win" ? "勝利" : "敗北";
}

function shortOutcomeLabel(outcome: "win" | "loss"): string {
  return outcome === "win" ? "勝" : "敗";
}

function historySetScore(entry: PvpHistoryEntry): [number, number] {
  return entry.perspective === "challenger"
    ? [entry.result.challengerSetsWon, entry.result.defenderSetsWon]
    : [entry.result.defenderSetsWon, entry.result.challengerSetsWon];
}

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function OpponentCard({
  opponent,
  pending,
  disabled,
  onChallenge,
}: {
  opponent: PvpOpponentSummary;
  pending: boolean;
  disabled: boolean;
  onChallenge: (snapshotId: string) => void;
}) {
  return (
    <article className="pvp-opponent-card">
      <div className="pvp-opponent-card__topline">
        <span className="pvp-rank-chip">{opponent.reputationRank}</span>
        <span>{opponent.academicYear}年度</span>
      </div>
      <div className="pvp-opponent-card__school">
        <div>
          <strong>{opponent.schoolName}</strong>
          <span>公開戦力 {opponent.teamPower}</span>
        </div>
        <b>レート {opponent.rating}</b>
      </div>
      <div className="pvp-opponent-card__record">
        <span>
          {opponent.wins}勝 {opponent.losses}敗
        </span>
        <span>連勝 {opponent.currentWinStreak}</span>
        <span>{formatPublishedAt(opponent.publishedAt)} 更新</span>
      </div>
      <button
        aria-label={
          pending
            ? `対戦中… ${opponent.schoolName}`
            : `対戦する ${opponent.schoolName}`
        }
        className="pvp-challenge-button"
        disabled={disabled}
        onClick={() => onChallenge(opponent.snapshotId)}
        type="button"
      >
        {pending ? "対戦結果を計算中…" : "この学校に挑戦"}
      </button>
    </article>
  );
}

export function PvpScreen({
  publishedTeam,
  seasonId,
  opponents,
  ranking,
  history,
  result,
  loading,
  publishing,
  challengingSnapshotId,
  error,
  onPublish,
  onRefresh,
  onChallenge,
  onReturnPractice,
}: PvpScreenProps) {
  const operationPending = publishing || challengingSnapshotId !== null;

  return (
    <main className="app-content pvp-screen">
      <section className="pvp-hero" aria-labelledby="pvp-heading">
        <div className="pvp-hero__copy">
          <p className="section-kicker">非同期対人戦</p>
          <h2 id="pvp-heading">対人戦</h2>
          <p>育てた高校を公開し、他プレイヤーの公開チームへ挑戦します。</p>
        </div>
        <div className="pvp-mode-actions">
          <button onClick={onReturnPractice} type="button">
            通常試合へ
          </button>
          <button
            disabled={loading || operationPending}
            onClick={onRefresh}
            type="button"
          >
            更新
          </button>
        </div>
      </section>

      <section
        className="pvp-publish-card"
        aria-labelledby="pvp-publish-heading"
      >
        <div className="pvp-section-heading">
          <div>
            <p className="section-kicker">自分のチーム</p>
            <h3 id="pvp-publish-heading">公開チーム</h3>
          </div>
          <span
            className={publishedTeam ? "pvp-status-live" : "pvp-status-off"}
          >
            {publishedTeam ? "公開中" : "未公開"}
          </span>
        </div>

        {publishedTeam ? (
          <div className="pvp-published-summary">
            <div>
              <span>学校</span>
              <strong>{publishedTeam.schoolName}</strong>
            </div>
            <div>
              <span>公開戦力</span>
              <strong>{publishedTeam.teamPower}</strong>
            </div>
            <div>
              <span>評判</span>
              <strong>{publishedTeam.reputationRank}</strong>
            </div>
            <div>
              <span>更新</span>
              <strong>{formatPublishedAt(publishedTeam.publishedAt)}</strong>
            </div>
          </div>
        ) : (
          <p className="pvp-publish-note">
            公開すると、現在の育成チームが他プレイヤーの対戦候補に表示されます。
          </p>
        )}

        <button
          className="pvp-publish-button"
          disabled={publishing || challengingSnapshotId !== null}
          onClick={onPublish}
          type="button"
        >
          {publishing
            ? "チーム公開中…"
            : publishedTeam
              ? "公開チームを更新"
              : "チームを公開"}
        </button>
      </section>

      {loading ? (
        <section className="pvp-loading-card" role="status" aria-live="polite">
          <span className="pvp-spinner" aria-hidden="true" />
          <div>
            <strong>対人戦データを読み込んでいます…</strong>
            <p>公開チーム・ランキング・対戦履歴を同期中です。</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="pvp-error-card" role="alert">
          <strong>{error}</strong>
          <button disabled={operationPending} onClick={onRefresh} type="button">
            再試行
          </button>
        </section>
      ) : null}

      {result ? (
        <section
          className={`pvp-result-card pvp-result-card--${result.result.outcome}`}
          aria-labelledby="pvp-result-heading"
        >
          <div className="pvp-result-card__headline">
            <div>
              <p className="section-kicker">レート戦結果</p>
              <h3 id="pvp-result-heading">
                {outcomeLabel(result.result.outcome)}
              </h3>
            </div>
            <strong>{signedRatingDelta(result.rating.delta)}</strong>
          </div>
          <div className="pvp-result-card__score">
            <span>自校</span>
            <b>
              {result.result.challengerSetsWon} -{" "}
              {result.result.defenderSetsWon}
            </b>
            <span>{result.opponent.schoolShortName}</span>
          </div>
          <div className="pvp-result-card__rating">
            <span>レート</span>
            <strong>
              {result.rating.before} → {result.rating.after}
            </strong>
          </div>
          <div className="pvp-set-list" aria-label="セット結果">
            {result.result.sets.map((set) => (
              <span key={set.setNumber}>
                第{set.setNumber}セット {set.challengerScore} - {set.defenderScore}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="pvp-panel" aria-labelledby="pvp-opponents-heading">
        <div className="pvp-section-heading">
          <div>
            <p className="section-kicker">対戦候補</p>
            <h3 id="pvp-opponents-heading">対戦相手</h3>
          </div>
          {seasonId ? (
            <span className="pvp-season-chip">シーズン {seasonId}</span>
          ) : null}
        </div>
        {opponents.length > 0 ? (
          <div className="pvp-opponent-list">
            {opponents.map((opponent) => (
              <OpponentCard
                disabled={operationPending}
                key={opponent.snapshotId}
                onChallenge={onChallenge}
                opponent={opponent}
                pending={challengingSnapshotId === opponent.snapshotId}
              />
            ))}
          </div>
        ) : !loading ? (
          <p className="pvp-empty-state">
            現在対戦できる公開チームはありません。
          </p>
        ) : null}
      </section>

      <section className="pvp-panel" aria-labelledby="pvp-ranking-heading">
        <div className="pvp-section-heading">
          <div>
            <p className="section-kicker">ランキング</p>
            <h3 id="pvp-ranking-heading">シーズンランキング</h3>
          </div>
        </div>
        {ranking.length > 0 ? (
          <div className="pvp-ranking-list">
            {ranking.slice(0, 10).map((entry) => (
              <article key={`${entry.rank}-${entry.snapshotId}`}>
                <strong>{entry.rank}位</strong>
                <div>
                  <b>{entry.schoolName}</b>
                  <span>
                    {entry.wins}勝 / {entry.losses}敗
                  </span>
                </div>
                <em>{entry.rating}</em>
              </article>
            ))}
          </div>
        ) : !loading ? (
          <p className="pvp-empty-state">
            今シーズンのランキングはまだありません。
          </p>
        ) : null}
      </section>

      <section className="pvp-panel" aria-labelledby="pvp-history-heading">
        <div className="pvp-section-heading">
          <div>
            <p className="section-kicker">対戦履歴</p>
            <h3 id="pvp-history-heading">対戦履歴</h3>
          </div>
        </div>
        {history.length > 0 ? (
          <div className="pvp-history-list">
            {history.slice(0, 10).map((entry) => {
              const [ownSetsWon, opponentSetsWon] = historySetScore(entry);
              return (
                <article key={entry.matchId}>
                  <span
                    className={`pvp-history-outcome pvp-history-outcome--${entry.outcome}`}
                  >
                    {shortOutcomeLabel(entry.outcome)}
                  </span>
                  <div>
                    <strong>{entry.opponentSchoolName}</strong>
                    <span>
                      {ownSetsWon} - {opponentSetsWon}
                    </span>
                  </div>
                  <b>
                    {signedRatingDelta(entry.ratingAfter - entry.ratingBefore)}
                  </b>
                </article>
              );
            })}
          </div>
        ) : !loading ? (
          <p className="pvp-empty-state">対戦履歴はまだありません。</p>
        ) : null}
      </section>
    </main>
  );
}
