import type { GameState } from "../../domain/model/GameState";
import type { MatchState } from "../../domain/model/Match";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type { SchoolId } from "../../domain/model/identifiers";
import { schoolStrengthToGrade } from "../../domain/selectors/ratingGrades";
import {
  buildMatchStatSummary,
  buildTeamProfile,
  type TeamProfile,
} from "./matchPresentation";
import "./matchGameStats.css";
import { PreMatchRivalryContext } from "./PreMatchRivalryContext";
import { ratingToGrade } from "./teamRatingGrade";
import { buildMatchReviewEvaluation } from "./matchReviewEvaluation";

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

function radarPoint(
  index: number,
  value: number,
  radius = RADAR_RADIUS,
): string {
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

function fiveCategoryOverall(profile: TeamProfile): number {
  return Math.round(
    PROFILE_ROWS.reduce((sum, [key]) => sum + profile[key], 0) /
      PROFILE_ROWS.length,
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
  const homeFiveCategoryOverall = fiveCategoryOverall(home);
  const awayFiveCategoryOverall = fiveCategoryOverall(away);

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

      <PreMatchRivalryContext opponentSelection={awaySelection} state={state} />

      <div className="match-power-versus" aria-label="総合戦力比較">
        <div>
          <small>自校</small>
          <strong>{homeStrength}</strong>
          <em>学校評価 {schoolStrengthToGrade(homeStrength)}</em>
        </div>
        <span>VS</span>
        <div>
          <small>相手</small>
          <strong>{awayStrength}</strong>
          <em>学校評価 {schoolStrengthToGrade(awayStrength)}</em>
        </div>
      </div>

      <div className="match-five-overall" aria-label="5項目総合比較">
        <span>5項目総合</span>
        <strong title={`自校 ${homeFiveCategoryOverall}`}>
          {ratingToGrade(homeFiveCategoryOverall)}・{homeFiveCategoryOverall}
        </strong>
        <b>VS</b>
        <strong title={`相手 ${awayFiveCategoryOverall}`}>
          {ratingToGrade(awayFiveCategoryOverall)}・{awayFiveCategoryOverall}
        </strong>
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
  homeStrength: number;
  awayStrength: number;
}

export function MatchResultStats({
  state,
  match,
  userSchoolId,
  homeName,
  awayName,
  homeStrength,
  awayStrength,
}: MatchResultStatsProps) {
  const summary = buildMatchStatSummary(state, match);
  const evaluation = buildMatchReviewEvaluation({
    match,
    summary,
    userSchoolId,
    homeStrength,
    awayStrength,
  });
  const userIsHome = match.homeSchoolId === userSchoolId;
  const user = userIsHome ? summary.home : summary.away;
  const opponent = userIsHome ? summary.away : summary.home;
  const userName = userIsHome ? homeName : awayName;
  const opponentName = userIsHome ? awayName : homeName;
  const userPlayers = summary.players
    .filter((player) => player.schoolId === userSchoolId)
    .map((player) => ({
      stats: player,
      evaluation: evaluation.players.find(
        (item) => item.playerId === player.playerId,
      ),
    }))
    .sort((first, second) => {
      const firstScore = first.evaluation?.score ?? -1;
      const secondScore = second.evaluation?.score ?? -1;
      if (secondScore !== firstScore) return secondScore - firstScore;
      if (second.stats.points !== first.stats.points) {
        return second.stats.points - first.stats.points;
      }
      return first.stats.playerId.localeCompare(second.stats.playerId);
    });
  const teamMvp =
    userPlayers.find(
      (player) => player.stats.playerId === evaluation.teamMvpPlayerId,
    ) ?? userPlayers[0];
  const rows = [
    ["総得点", user.totalPoints, opponent.totalPoints],
    ["アタック", user.attackPoints, opponent.attackPoints],
    ["決定率", `${user.attackSuccessRate}%`, `${opponent.attackSuccessRate}%`],
    ["ブロック", user.blockPoints, opponent.blockPoints],
    ["サーブACE", user.serviceAces, opponent.serviceAces],
    ["好レシーブ率", `${user.perfectReceiveRate}%`, `${opponent.perfectReceiveRate}%`],
  ] as const;
  const categoryRows = [
    ["攻撃", evaluation.team.attack],
    ["ブロック", evaluation.team.block],
    ["サーブ", evaluation.team.serve],
    ["レシーブ", evaluation.team.receive],
  ] as const;

  return (
    <>
      <section
        className="match-review-summary"
        aria-labelledby="match-review-heading"
      >
        <div className="match-review-summary__grade">
          <span>TEAM RATING</span>
          <strong>{evaluation.team.grade}</strong>
          <b>{evaluation.team.score}</b>
        </div>
        <div className="match-review-summary__copy">
          <p className="section-kicker">MATCH REVIEW</p>
          <h2 id="match-review-heading">自校の試合評価</h2>
          <small>
            勝敗・相手戦力・実際のプレー内容から評価
            {evaluation.team.strengthAdjustment !== 0
              ? ` / 戦力差補正 ${evaluation.team.strengthAdjustment > 0 ? "+" : ""}${evaluation.team.strengthAdjustment}`
              : ""}
          </small>
        </div>
        <div className="match-review-summary__categories">
          {categoryRows.map(([label, item]) => (
            <span key={label}>
              <small>{label}</small>
              <strong>{item.grade}</strong>
              <b>{item.score}</b>
            </span>
          ))}
        </div>
        {teamMvp ? (
          <div className="match-team-mvp">
            <span>TEAM MVP</span>
            <div>
              <strong>{teamMvp.stats.name}</strong>
              <small>{teamMvp.stats.position}</small>
            </div>
            <b>
              {teamMvp.evaluation?.grade ?? "--"}
              {teamMvp.evaluation?.score !== null &&
              teamMvp.evaluation?.score !== undefined
                ? `・${teamMvp.evaluation.score}`
                : ""}
            </b>
          </div>
        ) : null}
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

      <section
        className="match-player-review"
        aria-labelledby="player-review-heading"
      >
        <div className="match-game-heading">
          <div>
            <p className="section-kicker">PLAYER REVIEW</p>
            <h2 id="player-review-heading">選手評価</h2>
          </div>
          <small>自校のみ</small>
        </div>
        <div className="match-player-review__list">
          {userPlayers.map(({ stats, evaluation: playerEvaluation }) => (
            <article key={stats.playerId}>
              <header>
                <div>
                  <strong>{stats.name}</strong>
                  <small>{stats.position}</small>
                </div>
                <span
                  className={
                    playerEvaluation?.rated
                      ? "match-player-review__grade"
                      : "match-player-review__grade is-unrated"
                  }
                >
                  <b>{playerEvaluation?.grade ?? "--"}</b>
                  <small>{playerEvaluation?.score ?? "評価なし"}</small>
                </span>
              </header>
              <div className="match-player-review__metrics">
                <span>
                  <small>得点</small>
                  <b>{stats.points}</b>
                </span>
                <span>
                  <small>ATT</small>
                  <b>
                    {stats.attackPoints}/{stats.attackAttempts}
                  </b>
                </span>
                <span>
                  <small>BLK</small>
                  <b>{stats.blockPoints}</b>
                </span>
                <span>
                  <small>ACE</small>
                  <b>{stats.serviceAces}</b>
                </span>
                <span>
                  <small>REC</small>
                  <b>
                    {stats.perfectReceives}/{stats.receiveAttempts}
                  </b>
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
