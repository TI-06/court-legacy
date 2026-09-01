from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "src/features/home/HomeScreen.tsx"
path.write_text(r'''import { useState } from "react";
import type { CohesionTrend } from "../../domain/dynamics/teamDynamicsTypes";
import type { SimulateMatchResult } from "../../domain/match/simulateMatch";
import type { GameState } from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { School, SchoolReputation } from "../../domain/model/School";
import { getPlayerConditionPresentation } from "../../domain/player/playerCondition";
import {
  selectHomeTrainingNotifications,
  type TrainingResultNotification,
} from "../../domain/notifications/gameNotifications";
import { selectNextOfficialEvent } from "../../domain/tournament/tournamentSelectors";
import type {
  TournamentCircuit,
  TournamentLevel,
  TournamentRound,
} from "../../domain/tournament/tournamentTypes";
import { TrainingResultNotificationSheet } from "./TrainingResultNotificationSheet";
import "./home.css";
import "./training-result-notification.css";

interface HomeScreenProps {
  state: GameState;
  opponent: School;
  latestMatch: SimulateMatchResult | null;
  homeStrength: number;
  trainingCompleted: boolean;
  practiceMatchCompleted: boolean;
  onOpenSchool: () => void;
  onOpenTeam: () => void;
  onOpenMatch: () => void;
  onOpenOfficialTournament: () => void;
  onAdvanceWeek: () => void;
  onAcceptPracticeOffer: () => void;
  onDeclinePracticeOffer: () => void;
  operationPending: boolean;
  onMarkNotificationRead: (notificationId: string) => Promise<void> | void;
}

const reputationLabels: Record<SchoolReputation, string> = {
  unknown: "無名校",
  "district-contender": "地区有力校",
  "prefectural-power": "県内強豪",
  "national-qualifier": "全国出場",
  "national-regular": "全国常連",
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
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function shortDate(value: string): string {
  const [, month, day] = value.split("-").map(Number);
  if (!month || !day) return value;
  return `${month}/${day}`;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function HomeScreen({
  state,
  opponent,
  latestMatch,
  homeStrength,
  trainingCompleted,
  practiceMatchCompleted,
  onOpenSchool,
  onOpenTeam,
  onOpenMatch,
  onOpenOfficialTournament,
  onAdvanceWeek,
  onAcceptPracticeOffer,
  onDeclinePracticeOffer,
  operationPending,
  onMarkNotificationRead,
}: HomeScreenProps) {
  const [selectedNotification, setSelectedNotification] =
    useState<TrainingResultNotification | null>(null);
  const school = state.schools[state.userSchoolId];
  if (!school) throw new Error(`user school not found: ${state.userSchoolId}`);

  const players = school.playerIds
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player));
  const injuredCount = players.filter((player) => player.injury).length;
  const teamCondition = getPlayerConditionPresentation(
    average(players.map((player) => player.condition)),
  );
  const latestWinner = latestMatch
    ? state.schools[latestMatch.analysis.winnerSchoolId]
    : null;
  const nextOfficial = selectNextOfficialEvent(state);
  const homeNotifications = selectHomeTrainingNotifications(state.notifications);
  const scheduledPracticeOpponentId =
    state.weeklySchedule.practiceMatch.scheduledOpponentId;
  const scheduledPracticeOpponent = scheduledPracticeOpponentId
    ? state.schools[scheduledPracticeOpponentId]
    : null;
  const displayedOpponent = scheduledPracticeOpponent ?? opponent;
  const incomingOffer = state.weeklySchedule.practiceMatch.incomingOffer;
  const incomingSchool = incomingOffer
    ? state.schools[incomingOffer.schoolId]
    : null;
  const trainingStatus = trainingCompleted ? "完了 ✓" : "設定済";
  const practiceStatus = practiceMatchCompleted
    ? "完了 ✓"
    : scheduledPracticeOpponentId
      ? "対戦決定"
      : "未決定";

  const openNotification = (notification: TrainingResultNotification) => {
    setSelectedNotification(notification);
    if (notification.readAtGameDate === null) void onMarkNotificationRead(notification.id);
  };

  return (
    <main className="app-content home-screen" data-testid="home-screen" aria-label="ホーム">
      <section className="home-week-card" aria-labelledby="home-week-heading">
        <div className="home-week-card__heading">
          <div>
            <span className="home-label">今週</span>
            <h2 id="home-week-heading">
              {shortDate(state.date)}・第{state.calendar.weekOfYear}週
            </h2>
          </div>
          <span className="home-week-card__school">{school.shortName}</span>
        </div>

        <div className="home-week-card__match">
          <div className="home-week-card__opponent">
            <span>練習試合</span>
            <strong title={displayedOpponent.name}>{displayedOpponent.shortName}</strong>
          </div>
          <div className="home-week-card__strength">
            <span>自校戦力</span>
            <strong>{homeStrength}</strong>
          </div>
        </div>

        <div className="home-week-card__status" aria-label="今週の進行状況">
          <span className={trainingCompleted ? "is-complete" : ""}>
            練習 <strong>{trainingStatus}</strong>
          </span>
          <span className={practiceMatchCompleted ? "is-complete" : ""}>
            試合 <strong>{practiceStatus}</strong>
          </span>
        </div>

        {incomingOffer && incomingSchool && !scheduledPracticeOpponentId ? (
          <section className="home-practice-offer" aria-label="練習試合の申し込み">
            <div>
              <span>練習試合の申し込み</span>
              <strong>{incomingSchool.shortName}</strong>
              <small>
                成長 {incomingOffer.growthRating}/5 ・ 負荷 {incomingOffer.loadRating}/5
              </small>
            </div>
            <div>
              <button disabled={operationPending} onClick={onDeclinePracticeOffer} type="button">
                断る
              </button>
              <button className="is-primary" disabled={operationPending} onClick={onAcceptPracticeOffer} type="button">
                受ける
              </button>
            </div>
          </section>
        ) : null}

        <div className="home-week-card__actions" aria-label="今週の操作">
          <button aria-label="選手を確認" onClick={onOpenTeam} type="button">選手</button>
          <button aria-label="学校を確認" onClick={onOpenSchool} type="button">学校</button>
          <button aria-label="練習試合へ" disabled={practiceMatchCompleted} onClick={onOpenMatch} type="button">
            試合
          </button>
        </div>

        <button aria-label="次の週へ進む" className="home-next-week-button" onClick={onAdvanceWeek} type="button">
          次の週へ進む
        </button>
      </section>

      {homeNotifications.length > 0 ? (
        <section className="home-notification-list" aria-label="練習結果のお知らせ">
          {homeNotifications.map((notification) => {
            const unread = notification.readAtGameDate === null;
            return (
              <button
                aria-label={`今週の練習結果 ${notification.payload.teamTrainingMenuName}`}
                className={`home-notification-row${unread ? " is-unread" : ""}`}
                key={notification.id}
                onClick={() => openNotification(notification)}
                type="button"
              >
                <span className="home-notification-row__content">
                  <span className="home-notification-row__headline">
                    <span className={`home-notification-row__badge${unread ? "" : " is-read"}`}>
                      {unread ? "NEW" : "確認済み"}
                    </span>
                    <strong>今週の練習結果</strong>
                  </span>
                  <span className="home-notification-row__summary">
                    <strong>{notification.payload.teamTrainingMenuName}</strong>
                    <small>
                      成長 {signed(notification.payload.totalAbilityGrowth)}・怪我 {notification.payload.injuredCount}人
                    </small>
                  </span>
                </span>
                <span className="home-notification-row__chevron" aria-hidden="true">›</span>
              </button>
            );
          })}
        </section>
      ) : null}

      <section className="home-team-status" data-testid="home-team-status" aria-label="チーム状況">
        <article>
          <span>評判</span>
          <strong>{school.reputationPoints}</strong>
          <small>{reputationLabels[school.reputation]}</small>
        </article>
        <article className={`player-condition--${teamCondition.colorToken}`}>
          <span>調子</span>
          <strong aria-label={teamCondition.label}>{teamCondition.icon}</strong>
          <small>{teamCondition.label}</small>
        </article>
        <article>
          <span>部員</span>
          <strong>{players.length}</strong>
          <small>{injuredCount > 0 ? `怪我 ${injuredCount}` : "怪我なし"}</small>
        </article>
        <article>
          <span>結束</span>
          <strong>{state.teamDynamics.cohesion}</strong>
          <small>{cohesionTrendLabels[state.teamDynamics.cohesionTrend]}</small>
        </article>
      </section>

      {nextOfficial ? (
        <section
          className={`home-official-card${nextOfficial.kind === "match" && nextOfficial.timing === "due" ? " is-due" : ""}`}
          aria-labelledby="home-official-heading"
        >
          <div className="home-official-card__top">
            <div>
              <span className="home-label">公式戦</span>
              <h2 id="home-official-heading">
                {circuitLabels[nextOfficial.circuit]} {levelLabels[nextOfficial.level]}
              </h2>
            </div>
            <strong className="home-official-card__timing">
              {nextOfficial.kind === "match" && nextOfficial.timing === "due"
                ? "今週"
                : `あと${nextOfficial.weeksUntil}週`}
            </strong>
          </div>
          <div className="home-official-card__summary">
            {nextOfficial.kind === "match" ? (
              <span>
                <strong>{roundLabels[nextOfficial.round]}</strong>
                <span>vs</span>
                <b title={nextOfficial.opponent.displayName}>{nextOfficial.opponent.shortName}</b>
              </span>
            ) : (
              <span><strong>{nextOfficial.scheduledWeek}週目</strong><span>開幕</span></span>
            )}
            <button onClick={onOpenOfficialTournament} type="button">大会表を見る</button>
          </div>
        </section>
      ) : null}

      {latestMatch || injuredCount > 0 ? (
        <section className="home-recent-status" aria-label="最近の状況">
          {latestMatch && latestWinner ? (
            <div>
              <span className="home-recent-status__tag">最近</span>
              <strong>
                {latestWinner.shortName}勝利&nbsp;{latestMatch.match.homeSetsWon} - {latestMatch.match.awaySetsWon}
              </strong>
            </div>
          ) : null}
          {injuredCount > 0 ? (
            <div className="is-alert">
              <span className="home-recent-status__tag">注意</span>
              <strong>怪我 {injuredCount}人</strong>
            </div>
          ) : null}
        </section>
      ) : null}

      <TrainingResultNotificationSheet
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
      />
    </main>
  );
}
''', encoding="utf-8")
