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

interface PreMatchComparisonProps {
  state: GameState;
  homeSelection: TeamSelection;
  awaySelection: TeamSelection;
  homeStrength: number;
  awayStrength: number;
}

const PROFILE_ROWS = [
  ["attack", "アタック"],
  ["block", "ブロック"],
  ["serve", "サーブ"],
  ["receive", "レシーブ"],
  ["teamwork", "連携"],
  ["stamina", "スタミナ"],
] as const satisfies readonly [keyof TeamProfile, string][];

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
  serve: "サーブレシーブを安定させ、Aパスから先手を取る。",
  receive: "サーブのコースと強弱を散らし、相手の攻撃準備を崩す。",
  teamwork: "ラリーで焦らず、切り返しの精度を落とさない。",
  stamina: "序盤からサーブで圧力をかけ、短いラリーで得点を狙う。",
};

function strongestKeys(profile: TeamProfile): (keyof TeamProfile)[] {
  return PROFILE_ROWS.map(([key]) => key).sort(
    (first, second) => profile[second] - profile[first],
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

      <div className="match-profile-table">
        <div className="match-profile-table__header" aria-hidden="true">
          <strong>自校</strong>
          <span>能力</span>
          <strong>相手</strong>
        </div>
        {PROFILE_ROWS.map(([key, label]) => (
          <div className="match-profile-row" key={key}>
            <strong>{home[key]}</strong>
            <div>
              <span>{label}</span>
              <div className="match-profile-bars">
                <i style={{ width: `${home[key]}%` }} />
                <i style={{ width: `${away[key]}%` }} />
              </div>
            </div>
            <strong>{away[key]}</strong>
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
  const mvpTeamName = teamNameFor(
    summary.mvp.schoolId,
    match,
    homeName,
    awayName,
  );
  const rows = [
    ["アタック得点", user.attackPoints, opponent.attackPoints],
    ["ブロック得点", user.blockPoints, opponent.blockPoints],
    ["サーブエース", user.serviceAces, opponent.serviceAces],
    [
      "スパイク決定率",
      `${user.attackSuccessRate}%`,
      `${opponent.attackSuccessRate}%`,
    ],
    [
      "Aパス率",
      `${user.perfectReceiveRate}%`,
      `${opponent.perfectReceiveRate}%`,
    ],
    ["ミス数", user.serveErrors, opponent.serveErrors],
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
            {summary.mvp.points}得点 / ブロック{summary.mvp.blockPoints} /
            サーブエース
            {summary.mvp.serviceAces}。攻守で最も勝敗に影響した選手です。
          </p>
        </div>
        <div className="match-mvp-card__metrics">
          <span>
            <small>得点</small>
            <strong>{summary.mvp.points}</strong>
          </span>
          <span>
            <small>決定率</small>
            <strong>{summary.mvp.attackSuccessRate}%</strong>
          </span>
          <span>
            <small>Aパス率</small>
            <strong>{summary.mvp.perfectReceiveRate}%</strong>
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
          <b>Aパス {summary.bestReceiver.perfectReceiveRate}%</b>
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
            <strong>あなた</strong>
            <span>項目</span>
            <strong>相手</strong>
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
