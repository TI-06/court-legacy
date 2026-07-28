import { useEffect, useMemo, useState } from "react";
import type { SimulateMatchResult } from "../../domain/match/simulateMatch";
import type { GameState } from "../../domain/model/GameState";
import type { School } from "../../domain/model/School";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import { validateTeamSelection } from "../../domain/team/validateTeamSelection";
import { presentMatchEvent, summarizeSetScore } from "./matchPresentation";
import "./match.css";

interface MatchScreenProps {
  state: GameState;
  opponent: School;
  homeSelection: TeamSelection;
  awaySelection: TeamSelection;
  homeStrength: number;
  awayStrength: number;
  result: SimulateMatchResult | null;
  reducedMotion: boolean;
  onStart: () => void;
  onReturnHome: () => void;
}

type PlaybackSpeed = 1 | 2 | 4;

export function MatchScreen(props: MatchScreenProps) {
  const playbackKey = props.result?.match.id ?? "pre-match";
  return <MatchScreenContent key={playbackKey} {...props} />;
}

function MatchScreenContent({
  state,
  opponent,
  homeSelection,
  awaySelection,
  homeStrength,
  awayStrength,
  result,
  reducedMotion,
  onStart,
  onReturnHome,
}: MatchScreenProps) {
  const [visibleEventIndex, setVisibleEventIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const homeSchool = state.schools[state.userSchoolId];
  if (!homeSchool) {
    throw new Error(`user school not found: ${state.userSchoolId}`);
  }

  const homeIssues = validateTeamSelection({
    state,
    schoolId: state.userSchoolId,
    selection: homeSelection,
  });
  const awayIssues = validateTeamSelection({
    state,
    schoolId: opponent.id,
    selection: awaySelection,
  });
  const canStart = homeIssues.length === 0 && awayIssues.length === 0;
  const eventCount = result?.match.eventLog.length ?? 0;
  const lastEventIndex = Math.max(0, eventCount - 1);
  const matchComplete = Boolean(result && visibleEventIndex >= lastEventIndex);

  useEffect(() => {
    if (!result || !playing || matchComplete || reducedMotion) {
      return;
    }

    const timer = window.setInterval(
      () => {
        setVisibleEventIndex((current) => {
          if (current >= lastEventIndex) {
            setPlaying(false);
            return current;
          }
          const next = current + 1;
          if (next >= lastEventIndex) {
            setPlaying(false);
          }
          return next;
        });
      },
      Math.round(800 / speed),
    );

    return () => window.clearInterval(timer);
  }, [lastEventIndex, matchComplete, playing, reducedMotion, result, speed]);

  const presentedEvents = useMemo(() => {
    if (!result) {
      return [];
    }
    return result.match.eventLog
      .slice(0, visibleEventIndex + 1)
      .map((event) => presentMatchEvent(event, { state, match: result.match }));
  }, [result, state, visibleEventIndex]);

  if (!result) {
    const strengthDifference = homeStrength - awayStrength;
    const comparisonLabel =
      strengthDifference >= 5
        ? "自校優勢"
        : strengthDifference <= -5
          ? "相手優勢"
          : "互角";

    return (
      <main className="app-content match-screen">
        <section className="match-prep-hero" aria-labelledby="match-heading">
          <p className="section-kicker">PRACTICE MATCH</p>
          <h2 id="match-heading">練習試合</h2>
          <p>編成と戦力を確認して、試合を開始します。</p>
        </section>

        <section className="match-versus-card" aria-label="対戦カード">
          <article className="match-team-card match-team-card--home">
            <span>HOME</span>
            <strong>{homeSchool.name}</strong>
            <b>戦力 {homeStrength}</b>
          </article>
          <div className="match-versus-mark">
            <strong>VS</strong>
            <span>{comparisonLabel}</span>
          </div>
          <article className="match-team-card match-team-card--away">
            <span>AWAY</span>
            <strong>{opponent.name}</strong>
            <b>戦力 {awayStrength}</b>
          </article>
        </section>

        <section
          className="match-prep-panel"
          aria-labelledby="match-ready-heading"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">LINEUP CHECK</p>
              <h2 id="match-ready-heading">試合準備</h2>
            </div>
            <span className={canStart ? "match-ready" : "match-not-ready"}>
              {canStart ? "準備完了" : "編成を確認"}
            </span>
          </div>
          <div className="match-prep-summary">
            <article>
              <span>形式</span>
              <strong>3セットマッチ</strong>
            </article>
            <article>
              <span>自校先発</span>
              <strong>{homeSelection.rotation.length}人</strong>
            </article>
            <article>
              <span>相手先発</span>
              <strong>{awaySelection.rotation.length}人</strong>
            </article>
          </div>
          {!canStart ? (
            <div className="match-lineup-warning" role="alert">
              {[...homeIssues, ...awayIssues].map((issue, index) => (
                <p key={`${issue.code}-${issue.playerId ?? index}`}>
                  {issue.message}
                </p>
              ))}
            </div>
          ) : null}
          <button
            className="match-start-button"
            disabled={!canStart}
            onClick={onStart}
            type="button"
          >
            試合開始
          </button>
        </section>
      </main>
    );
  }

  const visibleRawEvents = result.match.eventLog.slice(
    0,
    visibleEventIndex + 1,
  );
  const revealedHomeSets = visibleRawEvents.filter(
    (event) =>
      event.type === "set-end" &&
      event.winnerSchoolId === result.match.homeSchoolId,
  ).length;
  const revealedAwaySets = visibleRawEvents.filter(
    (event) =>
      event.type === "set-end" &&
      event.winnerSchoolId === result.match.awaySchoolId,
  ).length;
  const currentEvent = presentedEvents.at(-1);
  const winner = state.schools[result.analysis.winnerSchoolId];
  const recentEvents = presentedEvents.slice(-4).reverse();

  if (!currentEvent || !winner) {
    throw new Error("completed match is missing presentation data");
  }

  return (
    <main className="app-content match-screen">
      {!matchComplete ? (
        <>
          <section className="match-live-hero" aria-labelledby="live-heading">
            <div>
              <p className="section-kicker">MATCH LIVE</p>
              <h2 id="live-heading">試合ダイジェスト</h2>
            </div>
            <span data-testid="event-sequence">
              {visibleEventIndex + 1} / {eventCount}
            </span>
          </section>

          <section className="match-scoreboard" aria-label="現在のスコア">
            <article>
              <span>{homeSchool.shortName}</span>
              <strong>{currentEvent.score.split(" - ")[0]}</strong>
              <small>セット {revealedHomeSets}</small>
            </article>
            <div>
              <span>
                第{result.match.eventLog[visibleEventIndex]!.setNumber}セット
              </span>
              <strong>—</strong>
            </div>
            <article>
              <span>{opponent.shortName}</span>
              <strong>{currentEvent.score.split(" - ")[1]}</strong>
              <small>セット {revealedAwaySets}</small>
            </article>
          </section>

          <section
            className={`match-current-event match-current-event--${currentEvent.tone}`}
            aria-live="polite"
          >
            <span className="match-current-event__number">
              {currentEvent.sequence}
            </span>
            <div>
              <strong>{currentEvent.title}</strong>
              <p>{currentEvent.detail}</p>
            </div>
          </section>

          <section className="match-controls" aria-label="再生操作">
            <div className="match-playback-row">
              <button
                disabled={reducedMotion}
                onClick={() => setPlaying((current) => !current)}
                type="button"
              >
                {playing ? "一時停止" : "再生"}
              </button>
              <button
                disabled={visibleEventIndex >= lastEventIndex}
                onClick={() => {
                  setPlaying(false);
                  setVisibleEventIndex((current) =>
                    Math.min(lastEventIndex, current + 1),
                  );
                }}
                type="button"
              >
                次のプレー
              </button>
              <button
                onClick={() => {
                  setPlaying(false);
                  setVisibleEventIndex(lastEventIndex);
                }}
                type="button"
              >
                結果まで進む
              </button>
            </div>
            <div className="match-speed-row" role="group" aria-label="再生速度">
              {([1, 2, 4] as const).map((value) => (
                <button
                  aria-pressed={speed === value}
                  key={value}
                  onClick={() => setSpeed(value)}
                  type="button"
                >
                  {value}倍
                </button>
              ))}
            </div>
            {reducedMotion ? (
              <p className="match-reduced-motion-note">
                動きを減らす設定中のため、自動再生は無効です。
              </p>
            ) : null}
          </section>

          <section
            className="match-timeline"
            aria-labelledby="timeline-heading"
          >
            <div className="section-heading">
              <div>
                <p className="section-kicker">PLAY LOG</p>
                <h2 id="timeline-heading">直近のプレー</h2>
              </div>
            </div>
            <div className="match-timeline__list">
              {recentEvents.map((event) => (
                <article key={event.sequence}>
                  <span>{event.score}</span>
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section
            className="match-result-hero"
            aria-labelledby="result-heading"
          >
            <p className="section-kicker">FULL TIME</p>
            <h2 id="result-heading">試合結果</h2>
            <strong>{winner.name} 勝利</strong>
            <div className="match-result-score">
              <span>{homeSchool.shortName}</span>
              <b>
                {result.match.homeSetsWon} - {result.match.awaySetsWon}
              </b>
              <span>{opponent.shortName}</span>
            </div>
            <p>{summarizeSetScore(result.match).split("｜")[1]}</p>
          </section>

          <section className="match-analysis" aria-labelledby="factor-heading">
            <div className="section-heading">
              <div>
                <p className="section-kicker">MATCH ANALYSIS</p>
                <h2 id="factor-heading">勝敗を分けた要因</h2>
              </div>
            </div>
            <div className="match-analysis__list">
              {result.analysis.principalFactors.slice(0, 3).map((factor) => (
                <article key={factor.code}>
                  <span>{Math.round(factor.impact)}</span>
                  <div>
                    <strong>{factor.title}</strong>
                    <p>{factor.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section
            className="match-analysis"
            aria-labelledby="recommend-heading"
          >
            <div className="section-heading">
              <div>
                <p className="section-kicker">NEXT PLAN</p>
                <h2 id="recommend-heading">次戦への改善提案</h2>
              </div>
            </div>
            <div className="match-recommendations">
              {result.analysis.recommendations.slice(0, 3).map((factor) => (
                <article key={factor.code}>
                  <strong>{factor.title}</strong>
                  <p>{factor.detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="match-result-actions">
            <button
              onClick={() => {
                setVisibleEventIndex(0);
                setPlaying(false);
              }}
              type="button"
            >
              ダイジェストを最初から
            </button>
            <button onClick={onReturnHome} type="button">
              ホームへ戻る
            </button>
          </section>
        </>
      )}
    </main>
  );
}
