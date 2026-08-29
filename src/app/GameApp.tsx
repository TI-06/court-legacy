import { useMemo, useState } from "react";
import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import "./app-shell.css";
import { gameData } from "./createDemoGame";
import { useGameSession } from "./useGameSession";
import type { AcademicYearTransitionSummary } from "../domain/calendar/academicYearProgression";
import { isWeeklyActionCompleted } from "../domain/calendar/weekProgression";
import type { SimulateMatchResult } from "../domain/match/simulateMatch";
import type { GameState } from "../domain/model/GameState";
import type { PlayerId } from "../domain/model/identifiers";
import type { SchoolReputation } from "../domain/model/School";
import type { TeamSelection } from "../domain/model/TeamSelection";
import type {
  PvpChallengeResponse,
  PvpHistoryEntry,
  PvpOpponentSummary,
  PvpPublishedTeamSummary,
  PvpRankingEntry,
} from "../domain/pvp/pvpContracts";
import type { ScoutReport } from "../domain/scouting/scoutReport";
import type { ShopItemId } from "../domain/shop/shopCatalog";
import type { ShopStatusResponse } from "../domain/shop/shopContracts";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "../domain/selectors/matchSelectors";
import type { FacilityKey } from "../domain/school/facilityUpgrade";
import { autoSelectTeam } from "../domain/team/autoSelectTeam";
import type {
  TrainingResult,
  WeeklyPlan,
} from "../domain/training/resolveWeeklyTraining";
import { CalendarSheet } from "../features/calendar/CalendarSheet";
import { EventDialog } from "../features/home/EventDialog";
import { HomeScreen } from "../features/home/HomeScreen";
import { YearTransitionDialog } from "../features/home/YearTransitionDialog";
import { MatchPvpEntry } from "../features/match/MatchPvpEntry";
import { MatchScreen } from "../features/match/MatchScreen";
import { MoreScreen } from "../features/more/MoreScreen";
import { PvpScreen } from "../features/pvp/PvpScreen";
import { SchoolScreen } from "../features/school/SchoolScreen";
import { ScoutingScreen } from "../features/scouting/ScoutingScreen";
import { ShopScreen } from "../features/shop/ShopScreen";
import { PlayerHubScreen } from "../features/team/PlayerHubScreen";
import { TrainingScreen } from "../features/training/TrainingScreen";
import { TrainingScoutingEntry } from "../features/training/TrainingScoutingEntry";
import { ApiError, type GameApiClient } from "../services/api/GameApiClient";
import type { AuthClient, AuthSession } from "../services/auth/AuthClient";
import { GamePageFrame } from "../ui/shell/GamePageFrame";
import type { AppTab } from "../ui/shell/appNavigation";

interface GameAppProps {
  snapshot: CloudGameSnapshot;
  session: AuthSession;
  auth: AuthClient;
  api: GameApiClient;
}

type MoreView = "menu" | "school" | "shop";
type MatchView = "practice" | "pvp";
type ShopPendingAction = "purchase" | "use";

interface AdvanceWeekOutcome {
  academicYearTransition: AcademicYearTransitionSummary | null;
}

const reputationLabels: Record<SchoolReputation, string> = {
  unknown: "E 無名",
  "district-contender": "D 地区レベル",
  "prefectural-power": "C 県大会常連",
  "national-qualifier": "B 県内強豪",
  "national-regular": "A 全国出場級",
  elite: "S 全国常連",
};

function formatGameDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return `${year}年${month}月${day}日`;
}

function recruitingCycleKey(state: GameState): string {
  return `${state.userSchoolId}:year-${state.yearIndex}`;
}

function scoutingErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function pvpErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function shopErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function GameApp({ snapshot, session, auth, api }: GameAppProps) {
  const cloudSession = useGameSession({
    accessToken: session.accessToken,
    initialSnapshot: snapshot,
    api,
  });
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [moreView, setMoreView] = useState<MoreView>("menu");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [scoutingOpen, setScoutingOpen] = useState(false);
  const [scoutingReports, setScoutingReports] = useState<ScoutReport[]>([]);
  const [scoutingCycle, setScoutingCycle] = useState<string | null>(null);
  const [scoutingLoading, setScoutingLoading] = useState(false);
  const [scoutingError, setScoutingError] = useState<string | null>(null);
  const [recruitingCandidateId, setRecruitingCandidateId] =
    useState<PlayerId | null>(null);
  const [retryRecruitCandidateId, setRetryRecruitCandidateId] =
    useState<PlayerId | null>(null);
  const [latestTrainingResult, setLatestTrainingResult] =
    useState<TrainingResult | null>(null);
  const [latestMatchResult, setLatestMatchResult] =
    useState<SimulateMatchResult | null>(null);
  const [activeMatchResult, setActiveMatchResult] =
    useState<SimulateMatchResult | null>(null);
  const [matchView, setMatchView] = useState<MatchView>("practice");
  const [pvpPublishedTeam, setPvpPublishedTeam] =
    useState<PvpPublishedTeamSummary | null>(null);
  const [pvpSeasonId, setPvpSeasonId] = useState<string | null>(null);
  const [pvpOpponents, setPvpOpponents] = useState<PvpOpponentSummary[]>([]);
  const [pvpRanking, setPvpRanking] = useState<PvpRankingEntry[]>([]);
  const [pvpHistory, setPvpHistory] = useState<PvpHistoryEntry[]>([]);
  const [pvpResult, setPvpResult] = useState<PvpChallengeResponse | null>(null);
  const [pvpLoading, setPvpLoading] = useState(false);
  const [pvpPublishing, setPvpPublishing] = useState(false);
  const [pvpChallengingSnapshotId, setPvpChallengingSnapshotId] = useState<
    string | null
  >(null);
  const [pvpError, setPvpError] = useState<string | null>(null);
  const [shopStatus, setShopStatus] = useState<ShopStatusResponse | null>(null);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);
  const [shopPendingAction, setShopPendingAction] =
    useState<ShopPendingAction | null>(null);
  const [shopPendingItemId, setShopPendingItemId] =
    useState<ShopItemId | null>(null);
  const [shopResultMessage, setShopResultMessage] = useState<string | null>(null);
  const [latestYearTransition, setLatestYearTransition] =
    useState<AcademicYearTransitionSummary | null>(null);

  const gameState = cloudSession.snapshot.state;
  const teamSelection = cloudSession.snapshot.teamSelection;
  const school = gameState.schools[gameState.userSchoolId]!;
  const trainingCompleted = isWeeklyActionCompleted(gameState, "training");
  const practiceMatchCompleted = isWeeklyActionCompleted(
    gameState,
    "practice-match",
  );
  const opponent = useMemo(
    () => selectPracticeOpponent(gameState),
    [gameState],
  );
  const opponentSelection = useMemo(
    () => autoSelectTeam({ state: gameState, schoolId: opponent.id }),
    [gameState, opponent.id],
  );
  const homeStrength = useMemo(
    () => calculateSelectionStrength(gameState, teamSelection),
    [gameState, teamSelection],
  );
  const awayStrength = useMemo(
    () => calculateSelectionStrength(gameState, opponentSelection),
    [gameState, opponentSelection],
  );

  const changeTab = (tab: AppTab) => {
    if (tab !== "more") setMoreView("menu");
    if (tab !== "training") {
      setScoutingOpen(false);
      setScoutingError(null);
      setRetryRecruitCandidateId(null);
    }
    if (tab !== "match") {
      setMatchView("practice");
      setPvpError(null);
    }
    setActiveTab(tab);
  };

  const loadScoutingBoard = async (
    revision = cloudSession.snapshot.revision,
  ) => {
    if (!api.getScoutingBoard) {
      setScoutingError("スカウト機能を利用できません");
      return;
    }

    setScoutingLoading(true);
    setScoutingError(null);
    setRetryRecruitCandidateId(null);

    try {
      const response = await api.getScoutingBoard(session.accessToken, {
        operationId: crypto.randomUUID(),
        revision,
      });
      setScoutingReports(response.reports);
      setScoutingCycle(response.cycleKey);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const latest = await api.bootstrap(session.accessToken);
          if (latest.status === "ready") {
            await cloudSession.adoptServerSnapshot(
              latest.game,
              "最新のゲーム状態を読み込みました",
            );
            setScoutingReports([]);
            setScoutingCycle(null);
            const refreshed = await api.getScoutingBoard(session.accessToken, {
              operationId: crypto.randomUUID(),
              revision: latest.game.revision,
            });
            setScoutingReports(refreshed.reports);
            setScoutingCycle(refreshed.cycleKey);
            return;
          }
        } catch (refreshError) {
          setScoutingError(
            scoutingErrorMessage(
              refreshError,
              "最新のスカウト候補を読み込めませんでした",
            ),
          );
          return;
        }
      }

      setScoutingError(
        scoutingErrorMessage(error, "候補を読み込めませんでした"),
      );
    } finally {
      setScoutingLoading(false);
    }
  };

  const openScouting = () => {
    setScoutingOpen(true);
    setScoutingError(null);
    setRetryRecruitCandidateId(null);
    const currentCycle = recruitingCycleKey(cloudSession.snapshot.state);
    if (scoutingCycle !== currentCycle) {
      setScoutingReports([]);
      setScoutingCycle(null);
      void loadScoutingBoard();
    }
  };

  const recruitCandidate = async (candidateId: PlayerId) => {
    if (!api.commitRecruit || recruitingCandidateId !== null) {
      if (!api.commitRecruit) {
        setScoutingError("スカウト獲得機能を利用できません");
      }
      return;
    }

    setRecruitingCandidateId(candidateId);
    setScoutingError(null);
    setRetryRecruitCandidateId(null);

    try {
      const response = await api.commitRecruit(session.accessToken, {
        operationId: crypto.randomUUID(),
        revision: cloudSession.snapshot.revision,
        candidateId,
      });
      await cloudSession.adoptServerSnapshot(
        response.game,
        "獲得内容を保存しました",
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const latest = await api.bootstrap(session.accessToken);
          if (latest.status === "ready") {
            await cloudSession.adoptServerSnapshot(
              latest.game,
              "最新のゲーム状態を読み込みました",
            );
            setScoutingReports([]);
            setScoutingCycle(null);
            await loadScoutingBoard(latest.game.revision);
            return;
          }
        } catch (refreshError) {
          setScoutingError(
            scoutingErrorMessage(
              refreshError,
              "最新のスカウト候補を読み込めませんでした",
            ),
          );
          return;
        }
      }

      setScoutingError(scoutingErrorMessage(error, "獲得処理に失敗しました"));
      setRetryRecruitCandidateId(candidateId);
    } finally {
      setRecruitingCandidateId(null);
    }
  };

  const retryScouting = () => {
    if (retryRecruitCandidateId) {
      void recruitCandidate(retryRecruitCandidateId);
      return;
    }
    void loadScoutingBoard();
  };

  const executeTraining = async (plan: WeeklyPlan) => {
    if (trainingCompleted) return;
    const response = await cloudSession.runAction(
      { type: "training", plan },
      "練習結果を保存しています…",
    );
    if (!response) return;

    if (response.outcome !== undefined) {
      setLatestTrainingResult(response.outcome as TrainingResult);
    }
  };

  const saveTeamSelection = async (selection: TeamSelection) => {
    await cloudSession.runAction(
      { type: "team-selection", selection },
      "スタメンを保存しています…",
    );
  };

  const openFreshPracticeMatch = () => {
    if (!practiceMatchCompleted) {
      setActiveMatchResult(null);
      setMatchView("practice");
      setActiveTab("match");
    }
  };

  const startPracticeMatch = async () => {
    if (practiceMatchCompleted) return;
    const response = await cloudSession.runAction(
      { type: "practice-match" },
      "試合を計算しています…",
    );
    if (!response) return;

    if (response.outcome !== undefined) {
      const simulation = response.outcome as SimulateMatchResult;
      setLatestMatchResult(simulation);
      setActiveMatchResult(simulation);
    }
  };

  const loadPvpData = async () => {
    if (!api.getPvpOpponents || !api.getPvpRanking || !api.getPvpHistory) {
      setPvpError("対人戦機能を利用できません");
      return;
    }

    setPvpLoading(true);
    setPvpError(null);
    try {
      const [opponentsResponse, rankingResponse, historyResponse] =
        await Promise.all([
          api.getPvpOpponents(session.accessToken, { limit: 20 }),
          api.getPvpRanking(session.accessToken, { limit: 20 }),
          api.getPvpHistory(session.accessToken, { limit: 20 }),
        ]);
      setPvpSeasonId(opponentsResponse.seasonId);
      setPvpOpponents(opponentsResponse.opponents);
      setPvpRanking(rankingResponse.ranking);
      setPvpHistory(historyResponse.history);
    } catch (error) {
      setPvpError(pvpErrorMessage(error, "対人戦データを読み込めませんでした"));
    } finally {
      setPvpLoading(false);
    }
  };

  const openPvp = () => {
    setMatchView("pvp");
    setPvpError(null);
    void loadPvpData();
  };

  const recoverPvpRevision = async (): Promise<boolean> => {
    try {
      const latest = await api.bootstrap(session.accessToken);
      if (latest.status !== "ready") return false;
      await cloudSession.adoptServerSnapshot(
        latest.game,
        "最新のゲーム状態を読み込みました",
      );
      setPvpError("最新のゲーム状態を読み込みました。もう一度お試しください");
      return true;
    } catch (error) {
      setPvpError(
        pvpErrorMessage(error, "最新のゲーム状態を読み込めませんでした"),
      );
      return false;
    }
  };

  const publishPvpTeam = async () => {
    if (
      !api.publishPvpTeam ||
      pvpPublishing ||
      pvpChallengingSnapshotId !== null
    ) {
      if (!api.publishPvpTeam) {
        setPvpError("対人戦の公開機能を利用できません");
      }
      return;
    }

    setPvpPublishing(true);
    setPvpError(null);
    try {
      const response = await api.publishPvpTeam(session.accessToken, {
        operationId: crypto.randomUUID(),
        revision: cloudSession.snapshot.revision,
      });
      setPvpPublishedTeam(response.team);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        if (await recoverPvpRevision()) return;
      }
      setPvpError(pvpErrorMessage(error, "チームを公開できませんでした"));
    } finally {
      setPvpPublishing(false);
    }
  };

  const challengePvpTeam = async (opponentSnapshotId: string) => {
    if (
      !api.challengePvpTeam ||
      pvpChallengingSnapshotId !== null ||
      pvpPublishing
    ) {
      if (!api.challengePvpTeam) {
        setPvpError("対人戦機能を利用できません");
      }
      return;
    }

    setPvpChallengingSnapshotId(opponentSnapshotId);
    setPvpError(null);
    try {
      const response = await api.challengePvpTeam(session.accessToken, {
        operationId: crypto.randomUUID(),
        revision: cloudSession.snapshot.revision,
        opponentSnapshotId,
      });
      setPvpResult(response);
      await loadPvpData();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.code === "revision_conflict"
      ) {
        if (await recoverPvpRevision()) return;
      }
      setPvpError(pvpErrorMessage(error, "対戦処理に失敗しました"));
    } finally {
      setPvpChallengingSnapshotId(null);
    }
  };

  const loadShop = async () => {
    if (!api.getShop) {
      setShopError("ショップ機能を利用できません");
      return;
    }

    setShopLoading(true);
    setShopError(null);
    try {
      const status = await api.getShop(session.accessToken);
      setShopStatus(status);
    } catch (error) {
      setShopError(
        shopErrorMessage(error, "ショップ情報を読み込めませんでした"),
      );
    } finally {
      setShopLoading(false);
    }
  };

  const refreshShopAfterMutation = async (
    minimumRevision: number,
  ): Promise<boolean> => {
    const latest = await api.bootstrap(session.accessToken);
    if (latest.status !== "ready" || latest.game.revision < minimumRevision) {
      setShopError("最新のゲーム状態を読み込めませんでした");
      return false;
    }

    await cloudSession.adoptServerSnapshot(
      latest.game,
      "最新のゲーム状態を読み込みました",
    );
    await loadShop();
    return true;
  };

  const purchaseShopItemFromUi = async (itemId: ShopItemId) => {
    if (!api.purchaseShopItem || shopPendingAction !== null) {
      if (!api.purchaseShopItem) {
        setShopError("ショップ購入機能を利用できません");
      }
      return;
    }

    setShopPendingAction("purchase");
    setShopPendingItemId(itemId);
    setShopResultMessage(null);
    setShopError(null);
    try {
      const response = await api.purchaseShopItem(session.accessToken, {
        operationId: crypto.randomUUID(),
        revision: cloudSession.snapshot.revision,
        itemId,
      });
      if (await refreshShopAfterMutation(response.revision)) {
        setShopResultMessage("購入しました ✓");
      }
    } catch (error) {
      setShopError(shopErrorMessage(error, "購入処理に失敗しました"));
    } finally {
      setShopPendingAction(null);
      setShopPendingItemId(null);
    }
  };

  const useShopItemFromUi = async (itemId: ShopItemId) => {
    if (!api.useShopItem || shopPendingAction !== null) {
      if (!api.useShopItem) {
        setShopError("ショップ使用機能を利用できません");
      }
      return;
    }

    setShopPendingAction("use");
    setShopPendingItemId(itemId);
    setShopResultMessage(null);
    setShopError(null);
    try {
      const response = await api.useShopItem(session.accessToken, {
        operationId: crypto.randomUUID(),
        revision: cloudSession.snapshot.revision,
        itemId,
      });
      if (await refreshShopAfterMutation(response.revision)) {
        setShopResultMessage("使用しました ✓");
      }
    } catch (error) {
      setShopError(shopErrorMessage(error, "使用処理に失敗しました"));
    } finally {
      setShopPendingAction(null);
      setShopPendingItemId(null);
    }
  };

  const openShop = () => {
    setMoreView("shop");
    setShopResultMessage(null);
    void loadShop();
  };

  const upgradeSchoolFacility = async (key: FacilityKey) => {
    await cloudSession.runAction(
      { type: "facility-upgrade", facility: key },
      "施設を更新しています…",
    );
  };

  const advanceWeek = async () => {
    if (!trainingCompleted) return;
    const response = await cloudSession.runAction(
      { type: "advance-week" },
      "次の週へ進めています…",
    );
    if (!response) return;

    const outcome = response.outcome as AdvanceWeekOutcome | undefined;
    setLatestYearTransition(outcome?.academicYearTransition ?? null);
    setLatestTrainingResult(null);
    setActiveMatchResult(null);
    setMatchView("practice");
    setPvpResult(null);
    setCalendarOpen(false);
    setActiveTab("home");
  };

  const chooseEvent = async (choiceId: string) => {
    await cloudSession.runAction(
      { type: "event-choice", choiceId },
      "イベント結果を保存しています…",
    );
  };

  const content =
    activeTab === "home" ? (
      <HomeScreen
        homeStrength={homeStrength}
        latestMatch={latestMatchResult}
        onAdvanceWeek={advanceWeek}
        onOpenMatch={openFreshPracticeMatch}
        onOpenTeam={() => setActiveTab("team")}
        onOpenTraining={() => setActiveTab("training")}
        opponent={opponent}
        practiceMatchCompleted={practiceMatchCompleted}
        state={gameState}
        trainingCompleted={trainingCompleted}
      />
    ) : activeTab === "team" ? (
      <PlayerHubScreen
        onChange={saveTeamSelection}
        selection={teamSelection}
        state={gameState}
      />
    ) : activeTab === "training" && scoutingOpen ? (
      <ScoutingScreen
        error={scoutingError}
        loading={scoutingLoading}
        onBack={() => {
          setScoutingOpen(false);
          setScoutingError(null);
          setRetryRecruitCandidateId(null);
        }}
        onRecruit={(candidateId) => {
          void recruitCandidate(candidateId);
        }}
        onRetry={retryScouting}
        recruitingCandidateId={recruitingCandidateId}
        reports={scoutingReports}
        state={gameState}
      />
    ) : activeTab === "training" ? (
      <div className="training-hub-screen">
        <TrainingScoutingEntry onOpen={openScouting} state={gameState} />
        <TrainingScreen
          completed={trainingCompleted}
          data={gameData}
          latestResult={latestTrainingResult}
          onExecute={executeTraining}
          state={gameState}
        />
      </div>
    ) : activeTab === "match" && matchView === "pvp" ? (
      <PvpScreen
        challengingSnapshotId={pvpChallengingSnapshotId}
        error={pvpError}
        history={pvpHistory}
        loading={pvpLoading}
        onChallenge={(snapshotId) => {
          void challengePvpTeam(snapshotId);
        }}
        onPublish={() => {
          void publishPvpTeam();
        }}
        onRefresh={() => {
          void loadPvpData();
        }}
        onReturnPractice={() => {
          setMatchView("practice");
          setPvpError(null);
        }}
        opponents={pvpOpponents}
        publishedTeam={pvpPublishedTeam}
        publishing={pvpPublishing}
        ranking={pvpRanking}
        result={pvpResult}
        seasonId={pvpSeasonId}
      />
    ) : activeTab === "match" ? (
      <div className="match-hub-screen">
        {!activeMatchResult ? <MatchPvpEntry onOpen={openPvp} /> : null}
        <MatchScreen
          awaySelection={opponentSelection}
          awayStrength={awayStrength}
          homeSelection={teamSelection}
          homeStrength={homeStrength}
          onReturnHome={() => changeTab("home")}
          onStart={startPracticeMatch}
          opponent={opponent}
          reducedMotion={gameState.settings.reducedMotion}
          result={activeMatchResult}
          state={gameState}
        />
      </div>
    ) : moreView === "shop" ? (
      <ShopScreen
        error={shopError}
        loading={shopLoading}
        onBack={() => setMoreView("menu")}
        onPurchase={(itemId) => {
          void purchaseShopItemFromUi(itemId);
        }}
        onRetry={() => void loadShop()}
        onUse={(itemId) => {
          void useShopItemFromUi(itemId);
        }}
        pendingAction={shopPendingAction}
        pendingItemId={shopPendingItemId}
        resultMessage={shopResultMessage}
        status={shopStatus}
      />
    ) : moreView === "school" ? (
      <main className="app-content more-school-view">
        <button
          className="more-school-view__back"
          onClick={() => setMoreView("menu")}
          type="button"
        >
          その他へ戻る
        </button>
        <SchoolScreen
          onUpgradeFacility={upgradeSchoolFacility}
          state={gameState}
        />
      </main>
    ) : (
      <MoreScreen
        accountLabel={session.email ?? "ログイン済みアカウント"}
        onOpenSchool={() => setMoreView("school")}
        onOpenShop={openShop}
        onSignOut={() => void auth.signOut()}
      />
    );

  return (
    <>
      <GamePageFrame
        activeTab={activeTab}
        dateLabel={formatGameDate(gameState.date)}
        onChangeTab={changeTab}
        onOpenCalendar={() => setCalendarOpen(true)}
        operation={cloudSession.operation}
        reputationLabel={reputationLabels[school.reputation]}
        schoolName={school.name}
      >
        {content}
      </GamePageFrame>
      <CalendarSheet
        onAdvanceWeek={advanceWeek}
        onClose={() => setCalendarOpen(false)}
        open={calendarOpen}
        practiceMatchCompleted={practiceMatchCompleted}
        state={gameState}
        trainingCompleted={trainingCompleted}
      />
      <EventDialog data={gameData} onChoose={chooseEvent} state={gameState} />
      {latestYearTransition ? (
        <YearTransitionDialog
          onClose={() => setLatestYearTransition(null)}
          state={gameState}
          summary={latestYearTransition}
        />
      ) : null}
    </>
  );
}
