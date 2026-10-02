import { useEffect, useMemo, useState } from "react";
import type { PendingMatchPresentation } from "../../domain/calendar/advanceWeekOutcome";
import type { MatchStepResult } from "../../domain/match/simulateMatch";
import type { GameState } from "../../domain/model/GameState";
import type { MatchCommand } from "../../domain/model/Match";
import type { School } from "../../domain/model/School";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type { PvpPublicOpponentTarget } from "../../domain/pvp/pvpContracts";
import { validateTeamSelection } from "../../domain/team/validateTeamSelection";
import { BottomSheet } from "../../ui/BottomSheet";
import { MatchCommandPanel } from "./MatchCommandPanel";
import { buildLiveMatchIntelligence } from "./liveMatchIntelligence";
import { buildLiveCoachEffectRows } from "./matchCommandPresentation";
import { tacticOptionLabel } from "../team/tacticsPresentation";
import { MatchResultStats, PreMatchComparison } from "./MatchStatPanels";
import { MatchResultStoryPanel } from "./MatchResultStoryPanel";
import { PracticeMatchReviewPanel } from "./PracticeMatchReviewPanel";
import { presentMatchEvent, summarizeSetScore } from "./matchPresentation";
import "./match.css";

interface MatchScreenProps {
  state: GameState;
  opponent: Pick<School, "id" | "name" | "shortName">;
  homeSelection: TeamSelection;
  awaySelection: TeamSelection;
  opponentTargets?: PvpPublicOpponentTarget[];
  homeStrength: number;
  awayStrength: number;
  result: MatchStepResult | null;
  presentation?: PendingMatchPresentation | null;
  reducedMotion: boolean;
  onStart: () => void;
  onReturnHome: () => void;
  onCommand?: (command: MatchCommand) => void | Promise<void>;
  onApplyPracticeTrainingRecommendation?: (
    menuId: string,
  ) => void | Promise<void>;
  commandPending?: boolean;
  trainingPlanPending?: boolean;
  allowResultSkip?: boolean;
  schoolDisplayNames?: Partial<Record<School["id"], string>>;
}

type PlaybackSpeed = 1 | 2 | 4;
type PlaybackMode = "rally" | "points";

function nextPlaybackEventIndex(
  eventLog: readonly { type: string }[],
  current: number,
  lastEventIndex: number,
  mode: PlaybackMode,
): number {
  if (current >= lastEventIndex) return lastEventIndex;
  if (mode === "rally") return Math.min(lastEventIndex, current + 1);

  for (let index = current + 1; index <= lastEventIndex; index += 1) {
    if (eventLog[index]?.type === "point") {
      return index;
    }
  }
  return lastEventIndex;
}

export function MatchScreen(props: MatchScreenProps) {
  const scheduledOpponentId =
    props.state.weeklySchedule.practiceMatch.scheduledOpponentId;
  if (!props.result && scheduledOpponentId !== props.opponent.id) {
    return null;
  }

  const playbackKey =
    props.presentation?.simulation.match.id ??
    props.result?.match.id ??
    "pre-match";
  return <MatchScreenContent key={playbackKey} {...props} />;
}

function MatchScreenContent({
  state,
  opponent,
  homeSelection,
  awaySelection,
  opponentTargets,
  homeStrength,
  awayStrength,
  result: legacyResult,
  presentation,
  reducedMotion,
  onStart,
  onReturnHome,
  onCommand,
  onApplyPracticeTrainingRecommendation,
  commandPending = false,
  trainingPlanPending = false,
  allowResultSkip = false,
  schoolDisplayNames,
}: MatchScreenProps) {
  const [visibleEventIndex, setVisibleEventIndex] = useState(0);
  const [playing, setPlaying] = useState(!reducedMotion);
  const speed: PlaybackSpeed = 4;
  const playbackMode: PlaybackMode = "points";
  const [matchGrowthOpen, setMatchGrowthOpen] = useState(true);
  const [skipTargetMatchId, setSkipTargetMatchId] = useState<string | null>(
    null,
  );
  const result = presentation?.simulation ?? legacyResult;
  const homeSchool = state.schools[state.userSchoolId];
  if (!homeSchool) {
    throw new Error(`user school not found: ${state.userSchoolId}`);
  }

  const homeIssues = result
    ? []
    : validateTeamSelection({
        state,
        schoolId: state.userSchoolId,
        selection: homeSelection,
      });
  const awayIssues = result
    ? []
    : validateTeamSelection({
        state,
        schoolId: opponent.id,
        selection: awaySelection,
      });
  const canStart = homeIssues.length === 0 && awayIssues.length === 0;
  const eventCount = result?.match.eventLog.length ?? 0;
  const lastEventIndex = Math.max(0, eventCount - 1);
  const resultSkipResolved = Boolean(
    result?.analysis && skipTargetMatchId === String(result.match.id),
  );
  const revealedEventIndex = resultSkipResolved
    ? lastEventIndex
    : visibleEventIndex;
  const segmentRevealed = revealedEventIndex >= lastEventIndex;
  const matchComplete = Boolean(result?.analysis && segmentRevealed);
  const decisionReady = Boolean(
    result &&
    segmentRevealed &&
    result.match.phase === "coach-decision" &&
    result.match.pendingCoachCommandForSchoolId === state.userSchoolId &&
    onCommand,
  );

  useEffect(() => {
    if (
      !result ||
      !playing ||
      matchComplete ||
      decisionReady ||
      reducedMotion
    ) {
      return;
    }

    const timer = window.setInterval(
      () => {
        setVisibleEventIndex((current) => {
          if (current >= lastEventIndex) {
            setPlaying(false);
            return current;
          }
          const next = nextPlaybackEventIndex(
            result.match.eventLog,
            current,
            lastEventIndex,
            playbackMode,
          );
          if (next >= lastEventIndex) {
            setPlaying(false);
          }
          return next;
        });
      },
      Math.round(800 / speed),
    );

    return () => window.clearInterval(timer);
  }, [
    decisionReady,
    lastEventIndex,
    matchComplete,
    playing,
    reducedMotion,
    playbackMode,
    result,
    speed,
  ]);

  const presentedEvents = useMemo(() => {
    if (!result) {
      return [];
    }
    const eventSchoolDisplayNames = presentation
      ? {
          [presentation.homeTeam.schoolId]: presentation.homeTeam.displayName,
          [presentation.awayTeam.schoolId]: presentation.awayTeam.displayName,
        }
      : schoolDisplayNames;
    return result.match.eventLog.slice(0, revealedEventIndex + 1).map((event) =>
      presentMatchEvent(event, {
        state,
        match: result.match,
        schoolDisplayNames: eventSchoolDisplayNames,
      }),
    );
  }, [presentation, result, revealedEventIndex, schoolDisplayNames, state]);

  const visibleEventSequence =
    result?.match.eventLog[revealedEventIndex]?.sequence ?? 0;
  const liveMatchIntelligence = useMemo(() => {
    if (
      !result ||
      !decisionReady ||
      result.match.runtime?.pendingDecisionReason === "set-break"
    ) {
      return null;
    }

    return buildLiveMatchIntelligence({
      state,
      match: result.match,
      userSchoolId: state.userSchoolId,
      visibleEventSequence,
    });
  }, [decisionReady, result, state, visibleEventSequence]);

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
          <p className="section-kicker">対戦準備</p>
          <h2 id="match-heading">練習試合</h2>
          <p>編成と戦力を確認して、試合を開始します。</p>
        </section>

        <section className="match-versus-card" aria-label="対戦カード">
          <article className="match-team-card match-team-card--home">
            <span>自校</span>
            <strong>{homeSchool.name}</strong>
            <b>戦力 {homeStrength}</b>
          </article>
          <div className="match-versus-mark">
            <strong>対戦</strong>
            <span>{comparisonLabel}</span>
          </div>
          <article className="match-team-card match-team-card--away">
            <span>相手</span>
            <strong>{opponent.name}</strong>
            <b>戦力 {awayStrength}</b>
          </article>
        </section>

        <PreMatchComparison
          state={state}
          homeSelection={homeSelection}
          awaySelection={awaySelection}
          homeStrength={homeStrength}
          awayStrength={awayStrength}
        />

        <section
          className="match-prep-panel"
          aria-labelledby="match-ready-heading"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">編成確認</p>
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
    revealedEventIndex + 1,
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
  const currentRawEvent = result.match.eventLog[revealedEventIndex] ?? null;
  const winnerDisplayName = result.analysis
    ? presentation?.homeTeam.schoolId === result.analysis.winnerSchoolId
      ? presentation.homeTeam.displayName
      : presentation?.awayTeam.schoolId === result.analysis.winnerSchoolId
        ? presentation.awayTeam.displayName
        : state.schools[result.analysis.winnerSchoolId]?.name
    : null;
  const homeShortName =
    presentation?.homeTeam.shortName ?? homeSchool.shortName;
  const awayShortName = presentation?.awayTeam.shortName ?? opponent.shortName;
  const userIsHome = result.match.homeSchoolId === state.userSchoolId;
  const currentTactics = result.match.runtime
    ? userIsHome
      ? result.match.runtime.homeTactics
      : result.match.runtime.awayTactics
    : null;
  const liveCoachEffects = matchComplete
    ? []
    : buildLiveCoachEffectRows(
        state,
        result.match,
        state.userSchoolId,
        visibleEventSequence,
      );
  const userWon = result.analysis?.winnerSchoolId === state.userSchoolId;
  const userShortName = userIsHome ? homeShortName : awayShortName;
  const opponentShortName = userIsHome ? awayShortName : homeShortName;
  const userSetsWon = userIsHome
    ? result.match.homeSetsWon
    : result.match.awaySetsWon;
  const opponentSetsWon = userIsHome
    ? result.match.awaySetsWon
    : result.match.homeSetsWon;
  const recentEvents =
    playbackMode === "points"
      ? presentedEvents
          .filter((_event, index) => visibleRawEvents[index]?.type === "point")
          .slice(-6)
          .reverse()
      : presentedEvents.slice(-4).reverse();
  const decisionReason = result.match.runtime?.pendingDecisionReason ?? null;
  const decisionHeadline =
    decisionReason === "opponent-run"
      ? "4連続失点。ここで流れを切る"
      : decisionReason === "mid-set"
        ? "セット中盤。次の狙いを決める"
        : decisionReason === "critical-score"
          ? "終盤接戦。ここからが勝負"
          : decisionReason === "set-break"
            ? "セット間。次セットを組み立てる"
            : "監督判断のタイミング";
  const decisionDetail =
    decisionReason === "set-break"
      ? "戦術変更・選手交代で次セットを整えられます"
      : "戦術変更・交代・選手指示・相手ターゲットを選べます";

  const submitCoachCommand = async (command: MatchCommand) => {
    if (!onCommand) return;
    setPlaying(false);
    await onCommand(command);
    if (command.type !== "skip-to-result" && !reducedMotion) {
      setPlaying(true);
    }
  };

  if (!currentEvent) {
    throw new Error("match is missing presentation data");
  }
  if (matchComplete && !winnerDisplayName) {
    throw new Error("completed match is missing winner presentation data");
  }

  return (
    <main
      className={`app-content match-screen${
        matchComplete ? " match-screen--result" : " match-screen--live"
      }${decisionReady ? " match-screen--decision" : ""}`}
    >
      {!matchComplete ? (
        <>
          <section className="match-live-hero" aria-labelledby="live-heading">
            <div>
              <p className="section-kicker">試合速報</p>
              <h2 id="live-heading">試合ダイジェスト</h2>
            </div>
            <span data-testid="event-sequence">
              {revealedEventIndex + 1} / {eventCount}
            </span>
          </section>

          <section className="match-scoreboard" aria-label="現在のスコア">
            <article>
              <span>{homeShortName}</span>
              <strong>{currentEvent.score.split(" - ")[0]}</strong>
              <small>
                セット {revealedHomeSets} ・ 戦力 {homeStrength}
              </small>
            </article>
            <div>
              <span>
                第{result.match.eventLog[revealedEventIndex]!.setNumber}セット
              </span>
              <strong>—</strong>
            </div>
            <article>
              <span>{awayShortName}</span>
              <strong>{currentEvent.score.split(" - ")[1]}</strong>
              <small>
                セット {revealedAwaySets} ・ 戦力 {awayStrength}
              </small>
            </article>
          </section>

          <section
            className={`match-interaction-status${
              decisionReady ? " match-interaction-status--decision" : ""
            }`}
            aria-label="試合進行状態"
          >
            <span>{decisionReady ? "DECISION" : "LIVE"}</span>
            <div>
              <strong>
                {decisionReady
                  ? decisionHeadline
                  : "試合結果はまだ確定していません"}
              </strong>
              <small>
                {decisionReady
                  ? decisionDetail
                  : "判断ポイントでは自動で止まり、監督指示を出せます"}
              </small>
            </div>
          </section>

          {currentTactics ? (
            <section className="match-tactic-summary" aria-label="現在戦術">
              <span>
                サーブ {tacticOptionLabel("serve", currentTactics.serve)}
              </span>
              <span>
                攻撃 {tacticOptionLabel("attack", currentTactics.attack)}
              </span>
              <span>
                ブロック {tacticOptionLabel("block", currentTactics.block)}
              </span>
            </section>
          ) : null}

          {liveCoachEffects.length > 0 ? (
            <section
              className="match-live-coach-effects"
              aria-label="発動中の監督指示"
            >
              {liveCoachEffects.map((effect) => (
                <span key={`${effect.kind}-${effect.sequence}`}>
                  <strong>{effect.label}</strong>
                  <small>残り{effect.ralliesRemaining}ラリー</small>
                </span>
              ))}
            </section>
          ) : null}

          <section
            className={`match-current-event match-current-event--${currentEvent.tone}${
              playbackMode === "points"
                ? " match-current-event--point-flow"
                : ""
            }`}
            aria-live="polite"
          >
            <span className="match-current-event__number">
              {playbackMode === "points" ? "P" : currentEvent.sequence}
            </span>
            <div>
              <strong>
                {playbackMode === "points" && currentRawEvent?.type !== "point"
                  ? "得点推移モード"
                  : currentEvent.title}
              </strong>
              <p>
                {playbackMode === "points" && currentRawEvent?.type !== "point"
                  ? "ラリー演出を省略し、次に点が入る場面まで進みます。"
                  : currentEvent.detail}
              </p>
            </div>
          </section>

          {decisionReady && onCommand ? (
            <MatchCommandPanel
              benchInsights={liveMatchIntelligence?.insights}
              match={result.match}
              onCommand={submitCoachCommand}
              opponentTargets={opponentTargets}
              pending={commandPending}
              state={state}
            />
          ) : (
            <section className="match-controls" aria-label="再生操作">
              <div className="match-playback-mode" aria-label="再生モード">
                <strong>得点推移・4倍速</strong>
                <small>試合開始後は自動再生します</small>
              </div>
              <div className="match-playback-row">
                <button
                  className="match-playback-row__play"
                  disabled={reducedMotion}
                  onClick={() => setPlaying((current) => !current)}
                  type="button"
                >
                  {playing ? "一時停止" : "再生"}
                </button>
                <button
                  className="match-playback-row__step"
                  disabled={revealedEventIndex >= lastEventIndex}
                  onClick={() => {
                    setPlaying(false);
                    setVisibleEventIndex((current) =>
                      nextPlaybackEventIndex(
                        result.match.eventLog,
                        current,
                        lastEventIndex,
                        playbackMode,
                      ),
                    );
                  }}
                  type="button"
                >
                  {playbackMode === "points" ? "次のポイント" : "次のプレー"}
                </button>
                <button
                  className="match-playback-row__advance"
                  onClick={() => {
                    setPlaying(false);
                    setVisibleEventIndex(lastEventIndex);
                  }}
                  type="button"
                >
                  {result.analysis ? "結果まで進む" : "次の判断まで進む"}
                </button>
                {allowResultSkip ? (
                  <button
                    className="match-playback-row__skip"
                    disabled={
                      commandPending || (!result.analysis && !onCommand)
                    }
                    onClick={() => {
                      setPlaying(false);
                      if (result.analysis) {
                        setVisibleEventIndex(lastEventIndex);
                        return;
                      }
                      if (!onCommand) return;
                      setSkipTargetMatchId(String(result.match.id));
                      void Promise.resolve(
                        onCommand({ type: "skip-to-result" }),
                      ).catch(() => setSkipTargetMatchId(null));
                    }}
                    type="button"
                  >
                    結果までスキップ
                  </button>
                ) : null}
              </div>
              {reducedMotion ? (
                <p className="match-reduced-motion-note">
                  動きを減らす設定中のため、自動再生は無効です。
                </p>
              ) : null}
            </section>
          )}

          <section
            className="match-timeline"
            aria-labelledby="timeline-heading"
          >
            <div className="section-heading">
              <div>
                <p className="section-kicker">
                  {playbackMode === "points" ? "SCORE FLOW" : "プレー履歴"}
                </p>
                <h2 id="timeline-heading">
                  {playbackMode === "points" ? "直近の得点" : "直近のプレー"}
                </h2>
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
            className={`match-result-hero match-result-hero--${userWon ? "win" : "loss"}`}
            aria-labelledby="result-heading"
          >
            <p className="section-kicker">試合終了</p>
            <h2 id="result-heading">試合結果</h2>
            <strong
              className="match-result-verdict"
              data-testid="match-result-verdict"
            >
              {userWon ? "勝利" : "敗北"}
            </strong>
            <p className="match-result-winner">{winnerDisplayName}が勝利</p>
            <div className="match-result-score">
              <span>
                <small>あなた</small>
                <strong>{userShortName}</strong>
              </span>
              <b>
                {userSetsWon} - {opponentSetsWon}
              </b>
              <span>
                <small>相手</small>
                <strong>{opponentShortName}</strong>
              </span>
            </div>
            <p>{summarizeSetScore(result.match).split("｜")[1]}</p>
          </section>

          <MatchResultStats
            state={state}
            match={result.match}
            userSchoolId={state.userSchoolId}
            homeName={homeShortName}
            awayName={awayShortName}
            homeStrength={homeStrength}
            awayStrength={awayStrength}
          />

          {presentation?.kind === "practice" ? (
            <PracticeMatchReviewPanel
              awayStrength={awayStrength}
              homeStrength={homeStrength}
              match={result.match}
              onApplyTrainingRecommendation={
                onApplyPracticeTrainingRecommendation
              }
              pending={trainingPlanPending}
              state={state}
            />
          ) : null}

          <MatchResultStoryPanel state={state} match={result.match} />

          <BottomSheet
            description="試合経験で変化した能力を確認できます。"
            onClose={() => setMatchGrowthOpen(false)}
            open={
              matchComplete && matchGrowthOpen && Boolean(presentation?.growth)
            }
            title="試合後の成長"
          >
            <div className="match-growth-sheet">
              {presentation?.growth?.players.length ? (
                <div className="match-growth-sheet__players">
                  {presentation.growth.players.map((player) => (
                    <article key={player.playerId}>
                      <header>
                        <strong>{player.displayName}</strong>
                        <span>{player.position}</span>
                      </header>
                      <div className="match-growth-sheet__abilities">
                        {player.abilities.map((ability) => (
                          <div key={ability.ability}>
                            <span>{ability.label}</span>
                            <b>
                              {ability.before} {ability.fromGrade}
                              <i aria-hidden="true">→</i>
                              {ability.after} {ability.toGrade}
                            </b>
                            <strong>
                              {ability.change > 0
                                ? `+${ability.change}`
                                : ability.change}
                            </strong>
                            {ability.fromGrade !== ability.toGrade ? (
                              <em>RANK UP</em>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="match-growth-sheet__empty">
                  この試合では能力の数値変化はありませんでした。
                </p>
              )}
              <button
                className="match-growth-sheet__continue"
                onClick={() => {
                  setMatchGrowthOpen(false);
                  onReturnHome();
                }}
                type="button"
              >
                {presentation ? "結果を確認して次へ" : "ホームへ戻る"}
              </button>
            </div>
          </BottomSheet>

          <section
            className="match-result-actions match-result-actions--fixed"
            data-testid="match-result-actions"
          >
            <button
              onClick={() => {
                setVisibleEventIndex(0);
                setPlaying(false);
              }}
              type="button"
            >
              ダイジェストを最初から
            </button>
            <button
              aria-hidden={
                matchGrowthOpen && Boolean(presentation?.growth)
                  ? "true"
                  : undefined
              }
              disabled={matchGrowthOpen && Boolean(presentation?.growth)}
              onClick={onReturnHome}
              tabIndex={
                matchGrowthOpen && Boolean(presentation?.growth)
                  ? -1
                  : undefined
              }
              type="button"
            >
              {presentation ? "結果を確認して次へ" : "ホームへ戻る"}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
