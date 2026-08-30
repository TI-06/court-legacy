import type { CohesionTrend } from "../../domain/dynamics/teamDynamicsTypes";
import type { SimulateMatchResult } from "../../domain/match/simulateMatch";
import type { GameState } from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { School, SchoolReputation } from "../../domain/model/School";
import { selectNextOfficialEvent } from "../../domain/tournament/tournamentSelectors";
import type {
  TournamentCircuit,
  TournamentLevel,
  TournamentRound,
} from "../../domain/tournament/tournamentTypes";
import { summarizeSetScore } from "../match/matchPresentation";
import "./home.css";

interface HomeScreenProps {
  state: GameState;
  opponent: School;
  latestMatch: SimulateMatchResult | null;
  homeStrength: number;
  trainingCompleted: boolean;
  practiceMatchCompleted: boolean;
  onOpenTraining: () => void;
  onOpenTeam: () => void;
  onOpenMatch: () => void;
  onOpenOfficialTournament: () => void;
  onAdvanceWeek: () => void;
}

const reputationLabels: Record<SchoolReputation, string> = {
  unknown: "無名校",
  "district-contender": "地区有力校",
  "prefectural-power": "県内強豪",
  "national-qualifier": "全国大会出場校",
  "national-regular": "全国常連校",
  elite: "全国屈指",
};

const circuitLabels: Record<TournamentCircuit, string> = {
  interhigh: "インターハイ",
  "spring-high": "春高",
};

const levelLabels: Record<TournamentLevel, string> = {
  prefectural: "県大会",
  national: "全国大会",
};

const roundLabels: Record<TournamentRound, string> = {
  "round-of-16": "1回戦",
  quarterfinal: "準々決勝",
  semifinal: "準決勝",
  final: "決勝",
};

const cohesionTrendLabels: Record<CohesionTrend, string> = {
  rising: "上向き",
  stable: "横ばい",
  falling: "低下",
};

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
  trainingCompleted,
  practiceMatchCompleted,
  onOpenTraining,
  onOpenTeam,
  onOpenMatch,
  onOpenOfficialTournament,
  onAdvanceWeek,
}: HomeScreenProps) {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error(`user school not found: ${state.userSchoolId}`);
  }

  const players = school.playerIds
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player));
  const averageFatigue = average(players.map((player) => player.fatigue));
  const injuredCount = players.filter((player) => player.injury).length;
  const fatigueWarningCount = players.filter(
    (player) => player.fatigue >= 65,
  ).length;
  const latestWinner = latestMatch
    ? state.schools[latestMatch.analysis.winnerSchoolId]
    : null;
  const nextOfficial = selectNextOfficialEvent(state);

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
            <small>週が変わると、次の対戦候補も更新されます。</small>
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
          <small>{reputationLabels[school.reputation]}</small>
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
        <article className="metric-card">
          <span>結束力</span>
          <strong>{state.teamDynamics.cohesion}</strong>
          <small>{cohesionTrendLabels[state.teamDynamics.cohesionTrend]}</small>
        </article>
      </section>

      {nextOfficial ? (
        <section
          className="home-official-card"
          aria-labelledby="home-official-heading"
        >
          <div className="section-heading home-official-card__heading">
            <div>
              <p className="section-kicker">OFFICIAL MATCH</p>
              <h2 id="home-official-heading">次の公式戦</h2>
            </div>
            <span
              className={`home-official-card__timing${
                nextOfficial.kind === "match" && nextOfficial.timing === "due"
                  ? " is-due"
                  : ""
              }`}
            >
              {nextOfficial.kind === "match" && nextOfficial.timing === "due"
                ? "今週"
                : `あと${nextOfficial.weeksUntil}週`}
            </span>
          </div>
          <div className="home-official-card__body">
            <div>
              <span>大会</span>
              <strong>
                {circuitLabels[nextOfficial.circuit]}{" "}
                {levelLabels[nextOfficial.level]}
              </strong>
            </div>
            {nextOfficial.kind === "match" ? (
              <>
                <div>
                  <span>ラウンド</span>
                  <strong>{roundLabels[nextOfficial.round]}</strong>
                </div>
                <div>
                  <span>対戦相手</span>
                  <strong>{nextOfficial.opponent.displayName}</strong>
                </div>
              </>
            ) : (
              <div>
                <span>次の大会</span>
                <strong>{nextOfficial.scheduledWeek}週目 開幕</strong>
              </div>
            )}
          </div>
          <button
            className="home-official-card__button"
            onClick={onOpenOfficialTournament}
            type="button"
          >
            大会表を見る
          </button>
        </section>
      ) : null}

      <section className="home-actions" aria-labelledby="action-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">NEXT ACTION</p>
            <h2 id="action-heading">次に何をする？</h2>
          </div>
        </div>
        <div className="home-action-grid">
          <button
            className={`home-action-card home-action-card--primary${trainingCompleted ? " home-action-card--completed" : ""}`}
            disabled={trainingCompleted}
            onClick={onOpenTraining}
            type="button"
          >
            <span className="home-action-card__icon" aria-hidden="true">
              育
            </span>
            <span>
              <strong>
                {trainingCompleted ? "今週の育成は完了" : "育成を決める"}
              </strong>
              <small>
                {trainingCompleted
                  ? "結果は育成タブで確認できます"
                  : "チーム練習と重点選手を選択"}
              </small>
            </span>
            <span aria-hidden="true">{trainingCompleted ? "✓" : "›"}</span>
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
            className={`home-action-card home-action-card--match${practiceMatchCompleted ? " home-action-card--completed" : ""}`}
            disabled={practiceMatchCompleted}
            onClick={onOpenMatch}
            type="button"
          >
            <span className="home-action-card__icon" aria-hidden="true">
              試
            </span>
            <span>
              <strong>
                {practiceMatchCompleted ? "今週の練習試合は完了" : "練習試合へ"}
              </strong>
              <small>
                {practiceMatchCompleted
                  ? "次週になると再び実施できます"
                  : `${opponent.shortName}との戦力比較を確認`}
              </small>
            </span>
            <span aria-hidden="true">{practiceMatchCompleted ? "✓" : "›"}</span>
          </button>
        </div>
      </section>

      <section className="home-week-progress" aria-labelledby="week-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">WEEK PROGRESS</p>
            <h2 id="week-heading">今週を終える</h2>
          </div>
          <span>{state.calendar.weekOfYear}週目</span>
        </div>
        <div className="home-week-status">
          <span className={trainingCompleted ? "is-complete" : ""}>
            練習 {trainingCompleted ? "完了" : "未実施"}
          </span>
          <span className={practiceMatchCompleted ? "is-complete" : ""}>
            試合 {practiceMatchCompleted ? "完了" : "任意"}
          </span>
        </div>
        <button
          aria-label="次の週へ進む"
          className="home-next-week-button"
          disabled={!trainingCompleted}
          onClick={onAdvanceWeek}
          type="button"
        >
          次の週へ進む
        </button>
        <p>
          {trainingCompleted
            ? "次週へ進むと疲労と状態が回復し、怪我の残り週数も進みます。"
            : "今週の練習を終えると、次の週へ進めます。"}
        </p>
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
