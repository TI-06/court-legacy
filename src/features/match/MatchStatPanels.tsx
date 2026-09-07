import type { GameState } from "../../domain/model/GameState";
import type { MatchState } from "../../domain/model/Match";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type { SchoolId } from "../../domain/model/identifiers";
import {
  buildMatchStatSummary,
  buildTeamProfile,
  type TeamProfile,
} from "./matchPresentation";
import "./matchGameStats.css";
import { ratingToGrade } from "./teamRatingGrade";

interface PreMatchComparisonProps {
  state: GameState;
  homeSelection: TeamSelection;
  awaySelection: TeamSelection;
  homeStrength: number;
  awayStrength: number;
}

type RadarProfileKey = "attack" | "block" | "serve" | "receive" | "teamwork";

const PROFILE_ROWS = [
  ["attack", "攻撃"],
  ["block", "ブロック"],
  ["serve", "サーブ"],
  ["receive", "レシーブ"],
  ["teamwork", "連携"],
] as const satisfies readonly [RadarProfileKey, string][];

const PROFILE_TRAITS: Record<keyof TeamProfile, string> = {
  attack: "攻撃の決定力が高く、サイドから押し切る力があります。",
  block: "ネット際が強く、ブロックで流れを止めるのが得意です。",
  serve: "サーブで崩して主導権を握る力があります。",
  receive: "レシーブが安定していて、簡単には崩れません。",
  teamwork: "連携がよく、長いラリーでも形を崩しにくいチームです。",
  stamina: "終盤まで運動量が落ちにくく、粘り強さがあります。",
};

const PROFILE_TACTICS: Record<keyof TeamProfile, string> = {
  attack: "ブロックとディグの連携を優先し、エースのコースを絞る。",
  block: "速いトスと攻撃分散で、相手ブロックを一枚にする。",
  serve: "サーブレシーブを安定させ、良い返球から先手を取る。",
  receive: "サーブのコースと強弱を散らし、相手の攻撃準備を崩す。",
  teamwork: "ラリーで焦らず、切り返しの精度を落とさない。",
  stamina: "序盤からサーブで圧力をかけ、短いラリーで得点を狙う。",
};

const RADAR_CENTER = 100;
const RADAR_RADIUS = 67;
const RADAR_LABEL_RADIUS = 88;

function radarPoint(index: number, value: number, radius = RADAR_RADIUS): string {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / PROFILE_ROWS.length;
  const normalized = Math.max(0, Math.min(100, value)) / 100;
  const distance = radius * normalized;
  const x = RADAR_CENTER + Math.cos(angle) * distance;
  const y = RADAR_CENTER + Math.sin(angle) * distance;
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

function radarPolygon(profile: TeamProfile, scale = 1): string {
  return PROFILE_ROWS.map(([key], index) =>
    radarPoint(index, profile[key] * scale),
  ).join(" ");
}

function radarGridPolygon(level: number): string {
  return PROFILE_ROWS.map((_, index) => radarPoint(index, level)).join(" ");
}

function radarLabelPoint(index: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / PROFILE_ROWS.length;
  return {
    x: RADAR_CENTER + Math.cos(angle) * RADAR_LABEL_RADIUS,
    y: RADAR_CENTER + Math.sin(angle) * RADAR_LABEL_RADIUS,
  };
}

function strongestKeys(profile: TeamProfile): RadarProfileKey[] {
  return PROFILE_ROWS.map(([key]) => key).sort(
    (first, second) => profile[second] - profile[first],
  );
}

function TeamRadar({ home, away }: { home: TeamProfile; away: TeamProfile }) {
  return (
    <div className="match-radar">
      <svg
        aria-label="自校と相手の5項目戦力比較"
        className="match-radar__chart"
        role="img"
        viewBox="0 0 200 200"
      >
        {[20, 40, 60, 80, 100].map((level) => (
          <polygon
            className="match-radar__grid"
            key={level}
            points={radarGridPolygon(level)}
          />
        ))}
        {PROFILE_ROWS.map((_, index) => (
          <line
            className="match-radar__axis"
            key={index}
            x1={RADAR_CENTER}
            x2={radarPoint(index, 100).split(",")[0]}
            y1={RADAR_CENTER}
            y2={radarPoint(index, 100).split(",")[1]}
          />
        ))}
        <polygon className="match-radar__home" points={radarPolygon(home)} />
        <polygon className="match-radar__away" points={radarPolygon(away)} />
        {PROFILE_ROWS.map(([, label], index) => {
          const point = radarLabelPoint(index);
          return (
            <text
              className="match-radar__label"
              key={label}
              textAnchor="middle"
              x={point.x}
              y={point.y + 3}
            >
              {label}
            </text>
          );
        })}
      </svg>
      <div className="match-radar__legend" aria-hidden="true">
        <span className="match-radar__legend-home">自校</span>
        <span className="match-radar__legend-away">相手</span>
      </div>
    </div>
  );
}

export function PreMatchComparison({
  state,
  homeSelection,
  awaySelection,
  homeStrength,
  awayStrength,
}: PreMatchComparisonProps) {
  const home = buildTeamProfile(state, homeSelection);
  const away = buildTeamProfile(state, awaySelection);
  const opponentStrengths = strongestKeys(away).slice(0, 3);
  const strengthDifference = homeStrength - awayStrength;

  return (
    <section
      className="match-comparison-panel"
      aria-labelledby="team-comparison-heading"
    >
      <div className="match-game-heading">
        <div>
          <p className="section-kicker">対戦分析</p>
          <h2 id="team-comparison-heading">チームステータス比較</h2>
        </div>
        <span
          className={`match-power-diff ${strengthDifference >= 0 ? "match-power-diff--ahead" : "match-power-diff--behind"}`}
        >
          戦力差 {strengthDifference > 0 ? "+" : ""}
          {strengthDifference}
        </span>
      </div>

      <div className="match-power-versus" aria-label="総合戦力比較">
        <div>
          <small>自校</small>
          <strong>{homeStrength}</strong>
        </div>
        <span>VS</span>
        <div>
          <small>相手</small>
          <strong>{awayStrength}</strong>
        </div>
      </div>

      <TeamRadar away={away} home={home} />

      <div className="match-profile-table">
        <div className="match-profile-table__header" aria-hidden="true">
          <strong>自校</strong>
          <span>能力</span>
          <strong>相手</strong>
        </div>
        {PROFILE_ROWS.map(([key, label]) => (
          <div className="match-profile-row" key={key}>
            <strong title={`${home[key]}`}>{ratingToGrade(home[key])}</strong>
            <div>
              <span>{label}</span>
              <div className="match-profile-bars" aria-hidden="true">
                <i style={{ width: `${home[key]}%` }} />
                <i style={{ width: `${away[key]}%` }} />
              </div>
            </div>
            <strong title={`${away[key]}`}>{ratingToGrade(away[key])}</strong>
          </div>
        ))}
      </div>

      <div className="match-scout-grid">
        <article>
          <h3>相手の特徴</h3>
          <ul>
            {opponentStrengths.map((key) => (
              <li key={key}>{PROFILE_TRAITS[key]}</li>
            ))}
          </ul>
        </article>
        <article className="match-scout-grid__tactics">
          <h3>おすすめ戦術</h3>
          <ul>
            {opponentStrengths.map((key) => (
              <li key={key}>{PROFILE_TACTICS[key]}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

interface MatchResultStatsProps {
  state: GameState;
  match: MatchState;
  userSchoolId: SchoolId;
  homeName: string;
  awayName: string;
}

function teamNameFor(
  schoolId: SchoolId,
  match: MatchState,
  homeName: string,
  awayName: string,
): string {
  return schoolId === match.homeSchoolId ? homeName : awayName;
}

export function MatchResultStats({
  state,
  match,
  userSchoolId,
  homeName,
  awayName,
}: MatchResultStatsProps) {
  const summary = buildMatchStatSummary(state, match);
  const userIsHome = match.homeSchoolId === userSchoolId;
  const user = userIsHome ? summary.home : summary.away;
  const opponent = userIsHome ? summary.away : summary.home;
  const userName = userIsHome ? homeName : awayName;
  const opponentName = userIsHome ? awayName : homeName;
  const mvpTeamName = teamNameFor(
    summary.mvp.schoolId,
    match,
    homeName,
    awayName,
  );
  const rows = [
    ["総得点", user.totalPoints, opponent.totalPoints],
    ["アタック得点", user.attackPoints, opponent.attackPoints],
    ["ブロック得点", user.blockPoints, opponent.blockPoints],
    ["サーブエース", user.serviceAces, opponent.serviceAces],
    ["ラリー得点", user.rallyPoints, opponent.rallyPoints],
    ["相手ミス得点", user.opponentErrorPoints, opponent.opponentErrorPoints],
    [
      "アタック決定率",
      `${user.attackSuccessRate}%`,
      `${opponent.attackSuccessRate}%`,
    ],
    ["サーブミス", user.serveErrors, opponent.serveErrors],
  ] as const;

  return (
    <>
      <section className="match-mvp-card" aria-labelledby="match-mvp-heading">
        <div className="match-mvp-card__badge" aria-hidden="true">
          MVP
        </div>
        <div className="match-mvp-card__copy">
          <p className="section-kicker">PLAYER OF THE MATCH</p>
          <h2 id="match-mvp-heading">MVP</h2>
          <strong>{summary.mvp.name}</strong>
          <span>
            {summary.mvp.position} ・ {mvpTeamName}
          </span>
          <p>
            {summary.mvp.points}得点（アタック{summary.mvp.attackPoints} /
            ブロック
            {summary.mvp.blockPoints} / エース{summary.mvp.serviceAces}）
            {summary.mvp.defensePoints > 0
              ? `。守備でも${summary.mvp.defensePoints}回、得点につながるプレー。`
              : "。直接得点で勝利に大きく貢献。"}
          </p>
        </div>
        <div className="match-mvp-card__metrics">
          <span>
            <small>得点</small>
            <strong>{summary.mvp.points}</strong>
          </span>
          <span>
            <small>ブロック</small>
            <strong>{summary.mvp.blockPoints}</strong>
          </span>
          <span>
            <small>サーブエース</small>
            <strong>{summary.mvp.serviceAces}</strong>
          </span>
        </div>
      </section>

      <section className="match-awards" aria-label="試合個人賞">
        <article>
          <span>最多得点</span>
          <strong>{summary.topScorer.name}</strong>
          <b>{summary.topScorer.points}得点</b>
        </article>
        <article>
          <span>最多ブロック</span>
          <strong>{summary.topBlocker.name}</strong>
          <b>{summary.topBlocker.blockPoints}本</b>
        </article>
        <article>
          <span>サーブエース</span>
          <strong>{summary.topServer.name}</strong>
          <b>{summary.topServer.serviceAces}本</b>
        </article>
        <article>
          <span>ベストレシーバー</span>
          <strong>{summary.bestReceiver.name}</strong>
          <b>
            好レシーブ {summary.bestReceiver.perfectReceives}/
            {summary.bestReceiver.receiveAttempts}
          </b>
        </article>
      </section>

      <section className="match-box-score" aria-labelledby="team-stats-heading">
        <div className="match-game-heading">
          <div>
            <p className="section-kicker">BOX SCORE</p>
            <h2 id="team-stats-heading">チームスタッツ</h2>
          </div>
        </div>
        <div className="match-box-score__table">
          <div className="match-box-score__header">
            <strong>{userName}</strong>
            <span>項目</span>
            <strong>{opponentName}</strong>
          </div>
          {rows.map(([label, userValue, opponentValue]) => (
            <div className="match-box-score__row" key={label}>
              <strong>{userValue}</strong>
              <span>{label}</span>
              <strong>{opponentValue}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
