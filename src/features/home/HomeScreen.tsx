import type { SimulateMatchResult } from "../../domain/match/simulateMatch";
import type { GameState } from "../../domain/model/GameState";
import type { School } from "../../domain/model/School";
import { summarizeSetScore } from "../match/matchPresentation";
import "./home.css";

interface HomeScreenProps {
  state: GameState;
  opponent: School;
  latestMatch: SimulateMatchResult | null;
  homeStrength: number;
  onOpenTraining: () => void;
  onOpenTeam: () => void;
  onOpenMatch: () => void;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }
  return `${year}年${month}月${day}日`;
}

export function HomeScreen({
  state,
  opponent,
  latestMatch,
  homeStrength,
  onOpenTraining,
  onOpenTeam,
  onOpenMatch,
}: HomeScreenProps) {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error(`user school not found: ${state.userSchoolId}`);
  }

  const players = school.playerIds
    .map((playerId) => state.players[playerId])
    .filter((player) => Boolean(player));
  const averageFatigue = average(players.map((player) => player!.fatigue));
  const injuredCount = players.filter((player) => player?.injury).length;
  const fatigueWarningCount = players.filter(
    (player) => (player?.fatigue ?? 0) >= 65,
  ).length;
  const latestWinner = latestMatch
    ? state.schools[latestMatch.analysis.winnerSchoolId]
    : null;

  return (
    <main className="app-content home-screen">
      <section className="home-hero" aria-labelledby="home-heading">
        <div className="home-hero__heading">
          <div>
            <p className="section-kicker">YEAR {state.yearIndex}</p>
            <h2 id="home-heading">監督ホーム</h2>
            <p>{formatDate(state.date)}</p>
          </div>
          <span>{school.shortName}</span>
        </div>
        <div className="home-opponent-card">
          <div>
            <span>練習試合候補</span>
            <strong>{opponent.name}</strong>
            <small>編成を確認して、いつでも試合を開始できます。</small>
          </div>
          <div className="home-strength-badge">
            <span>自校</span>
            <strong>戦力 {homeStrength}</strong>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="チーム状況">
        <article className="metric-card">
          <span>学校評判</span>
          <strong>{school.reputationPoints}</strong>
          <small>{school.reputation}</small>
        </article>
        <article className="metric-card">
          <span>平均疲労</span>
          <strong>{averageFatigue}</strong>
          <small>
            {fatigueWarningCount > 0
              ? `注意 ${fatigueWarningCount}人`
              : "全員安定"}
          </small>
        </article>
        <article className="metric-card">
          <span>部員</span>
          <strong>{players.length}</strong>
          <small>
            {injuredCount > 0 ? `怪我 ${injuredCount}人` : "怪我なし"}
          </small>
        </article>
      </section>

      <section className="home-actions" aria-labelledby="action-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">NEXT ACTION</p>
            <h2 id="action-heading">次に何をする？</h2>
          </div>
        </div>
        <div className="home-action-grid">
          <button
            className="home-action-card home-action-card--primary"
            onClick={onOpenTraining}
            type="button"
          >
            <span className="home-action-card__icon" aria-hidden="true">
              育
            </span>
            <span>
              <strong>育成を決める</strong>
              <small>チーム練習と重点選手を選択</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
          <button
            className="home-action-card"
            onClick={onOpenTeam}
            type="button"
          >
            <span className="home-action-card__icon" aria-hidden="true">
              編
            </span>
            <span>
              <strong>チーム編成を確認</strong>
              <small>先発・リベロ・安全交代を調整</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
          <button
            className="home-action-card home-action-card--match"
            onClick={onOpenMatch}
            type="button"
          >
            <span className="home-action-card__icon" aria-hidden="true">
              試
            </span>
            <span>
              <strong>練習試合へ</strong>
              <small>{opponent.shortName}との戦力比較を確認</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </section>

      {latestMatch && latestWinner ? (
        <section
          className="latest-match-card"
          aria-labelledby="latest-match-heading"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">LATEST MATCH</p>
              <h2 id="latest-match-heading">直近の試合</h2>
            </div>
            <span className="latest-match-card__result">
              {latestWinner.name} 勝利
            </span>
          </div>
          <div className="latest-match-card__score">
            <strong>
              {latestMatch.match.homeSetsWon} - {latestMatch.match.awaySetsWon}
            </strong>
            <span>{summarizeSetScore(latestMatch.match).split("｜")[1]}</span>
          </div>
        </section>
      ) : null}

      <section className="home-report" aria-labelledby="report-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">COACH REPORT</p>
            <h2 id="report-heading">現在の状態</h2>
          </div>
        </div>
        <div className="home-report__list">
          <article>
            <span
              className={
                injuredCount > 0
                  ? "report-dot report-dot--danger"
                  : "report-dot"
              }
            />
            <div>
              <strong>
                {injuredCount > 0
                  ? `怪我人が${injuredCount}人います`
                  : "出場できない怪我人はいません"}
              </strong>
              <p>
                {injuredCount > 0
                  ? "チーム編成で安全交代設定を確認してください。"
                  : "現時点では全選手を編成候補にできます。"}
              </p>
            </div>
          </article>
          <article>
            <span
              className={
                fatigueWarningCount > 0
                  ? "report-dot report-dot--warning"
                  : "report-dot"
              }
            />
            <div>
              <strong>
                {fatigueWarningCount > 0
                  ? `疲労注意の選手が${fatigueWarningCount}人います`
                  : "チームの疲労は安定しています"}
              </strong>
              <p>
                {fatigueWarningCount > 0
                  ? "試合前に回復重視の練習も検討してください。"
                  : "育成方針を決めて次の成長へ進めます。"}
              </p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
