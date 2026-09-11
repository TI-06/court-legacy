import { useMemo, useState } from "react";
import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import "./app-shell.css";
import { gameData } from "./createDemoGame";
import { useGameSession } from "./useGameSession";
import type { AcademicYearTransitionSummary } from "../domain/calendar/academicYearProgression";
import type {
  AdvanceWeekOutcome,
  PendingMatchPresentation,
} from "../domain/calendar/advanceWeekOutcome";
import { isWeeklyActionCompleted } from "../domain/calendar/weekProgression";
import type { MatchStepResult } from "../domain/match/simulateMatch";
import type { GameState } from "../domain/model/GameState";
import type { MatchCommand } from "../domain/model/Match";
import type { PlayerId, SchoolId } from "../domain/model/identifiers";
import type { SchoolReputation } from "../domain/model/School";
import type { TeamSelection } from "../domain/model/TeamSelection";
import { selectNextOfficialEvent } from "../domain/tournament/tournamentSelectors";
import type {
  TournamentCircuit,
  TournamentLevel,
} from "../domain/tournament/tournamentTypes";
import type {
  PvpChallengeResponse,
  PvpHistoryEntry,
  PvpOpponentSummary,
  PvpPublishedTeamSummary,
  PvpRankingEntry,
} from "../domain/pvp/pvpContracts";
import type { ScoutReport } from "../domain/scouting/scoutReport";
import type { ShopItemId } from "../domain/shop/shopCatalog";
import type {
  ShopPurchaseRequest,
  ShopStatusResponse,
  ShopUseRequest,
  ShopUseTarget,
} from "../domain/shop/shopContracts";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "../domain/selectors/matchSelectors";
import type { FacilityKey } from "../domain/school/facilityUpgrade";
import { autoSelectTeam } from "../domain/team/autoSelectTeam";
import type {
  MatchTacticPlan,
  PublicTacticSummary,
} from "../domain/team/matchTactics";
import type { SavedLineupSlot } from "../domain/team/teamPlanningTypes";
import type { WeeklyPlan } from "../domain/training/resolveWeeklyTraining";
import { CalendarSheet } from "../features/calendar/CalendarSheet";
import { EventDialog } from "../features/home/EventDialog";
import { HomeScreen } from "../features/home/HomeScreen";
import type { HomeCommandAction } from "../features/home/homeCommandCenter";
import { YearTransitionDialog } from "../features/home/YearTransitionDialog";
import { MatchOfficialEntry } from "../features/match/MatchOfficialEntry";
import { MatchPvpEntry } from "../features/match/MatchPvpEntry";
import { MatchScreen } from "../features/match/MatchScreen";
import { PracticeMatchPlanning } from "../features/match/PracticeMatchPlanning";
import { PreMatchLineupScreen } from "../features/match/PreMatchLineupScreen";
import { selectWeekPreMatchPreparation } from "../features/match/preMatchPreparation";
import { MoreScreen } from "../features/more/MoreScreen";
import { PvpScreen } from "../features/pvp/PvpScreen";
import { requestSchoolView } from "../features/school/SchoolNavigationState";
import { SchoolScreen } from "../features/school/SchoolScreen";
import { ScoutingScreen } from "../features/scouting/ScoutingScreen";
import { ShopScreen } from "../features/shop/ShopScreen";
import type { ShopUsePresentation } from "../features/shop/shopUsePresentation";
import { PlayerHubScreen } from "../features/team/PlayerHubScreen";
import { TournamentScreen } from "../features/tournament/TournamentScreen";
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

type MoreView = "menu" | "shop" | "inventory";
type MatchView = "practice" | "pvp";
type OfficialTournamentView = {
  circuit: TournamentCircuit;
  level: TournamentLevel;
};
type PreMatchContext =
  | {
      kind: "week";
      opponentName: string;
      opponentStrength?: number;
      opponentSelection?: TeamSelection;
      opponentTactics?: PublicTacticSummary;
    }
  | {
      kind: "pvp";
      opponentSnapshotId: string;
      opponentName: string;
      opponentStrength: number;
      opponentTactics?: PublicTacticSummary;
    };
type ShopPendingAction = "purchase" | "use";
type ShopRetryRequest =
  | { action: "purchase"; request: ShopPurchaseRequest }
  | { action: "use"; request: ShopUseRequest };

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
  const [, setLatestMatchResult] = useState<MatchStepResult | null>(null);
  const [activeMatchResult, setActiveMatchResult] =
    useState<MatchStepResult | null>(null);
  const [activeMatchPresentation, setActiveMatchPresentation] =
    useState<PendingMatchPresentation | null>(null);
  const [matchView, setMatchView] = useState<MatchView>("practice");
  const [officialTournamentView, setOfficialTournamentView] =
    useState<OfficialTournamentView | null>(null);
  const [preMatch, setPreMatch] = useState<PreMatchContext | null>(null);
  const [teamInitialPlayerId, setTeamInitialPlayerId] =
    useState<PlayerId | null>(null);
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
  const [shopPendingItemId, setShopPendingItemId] = useState<ShopItemId | null>(
    null,
  );
  const [shopResultMessage, setShopResultMessage] = useState<string | null>(
    null,
  );
  const [latestShopUseResult, setLatestShopUseResult] =
    useState<ShopUsePresentation | null>(null);
  const [shopRetryRequest, setShopRetryRequest] =
    useState<ShopRetryRequest | null>(null);
  const [shopPendingTarget, setShopPendingTarget] =
    useState<ShopUseTarget | null>(null);
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
  const opponent = useMemo(() => {
    const scheduledOpponentId =
      gameState.weeklySchedule.practiceMatch.scheduledOpponentId;
    const scheduledOpponent = scheduledOpponentId
      ? gameState.schools[scheduledOpponentId]
      : null;
    return scheduledOpponent ?? selectPracticeOpponent(gameState);
  }, [gameState]);
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
    if (tab === "team") setTeamInitialPlayerId(null);
    if (tab !== "more") setMoreView("menu");
    if (tab !== "school") {
      setScoutingOpen(false);
      setScoutingError(null);
      setRetryRecruitCandidateId(null);
    }
    if (tab !== "match") {
      setMatchView("practice");
      setOfficialTournamentView(null);
      setPreMatch(null);
      setPvpError(null);
    }
    setActiveTab(tab);
  };

  const loadScoutingBoard = async (
    revision = cloudSession.snapshot.revision,
  ): Promise<ScoutReport[] | null> => {
    if (!api.getScoutingBoard) {
      setScoutingError("スカウト機能を利用できません");
      return null;
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
      return response.reports;
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
            return refreshed.reports;
          }
        } catch (refreshError) {
          setScoutingError(
            scoutingErrorMessage(
              refreshError,
              "最新のスカウト候補を読み込めませんでした",
            ),
          );
          return null;
        }
      }

      setScoutingError(
        scoutingErrorMessage(error, "候補を読み込めませんでした"),
      );
      return null;
    } finally {
      setScoutingLoading(false);
    }
  };

  const openScouting = () => {
    setScoutingOpen(true);
    setScoutingError(null);
    setRetryRecruitCandidateId(null);
    void loadShop();
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
          return null;
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

  const saveTrainingPlan = async (plan: WeeklyPlan) => {
    if (trainingCompleted) return;
    await cloudSession.runAction(
      { type: "set-training-plan", plan },
      "練習設定を保存しています…",
    );
  };

  const changePlayerTraining = async (
    playerId: PlayerId,
    instructionId: string,
  ) => {
    const current = gameState.weeklySchedule.trainingPlan;
    await saveTrainingPlan({
      ...current,
      individualAssignments: [
        ...current.individualAssignments.filter(
          (item) => item.playerId !== playerId,
        ),
        { playerId, instructionId },
      ],
    });
  };

  const saveTeamSelection = async (selection: TeamSelection) => {
    await cloudSession.runAction(
      { type: "team-selection", selection },
      "スタメンを保存しています…",
    );
  };

  const saveTeamLeadership = async (
    captainPlayerId: PlayerId,
    viceCaptainPlayerId: PlayerId,
  ) => {
    await cloudSession.runAction(
      {
        type: "set-team-leadership",
        captainPlayerId,
        viceCaptainPlayerId,
      },
      "役職を保存しています…",
    );
  };

  const saveDevelopmentPriorities = async (playerIds: PlayerId[]) => {
    await cloudSession.runAction(
      { type: "set-development-priorities", playerIds },
      "重点育成を保存しています…",
    );
  };

  const saveTeamTactics = async (plan: MatchTacticPlan) => {
    await cloudSession.runAction(
      { type: "set-team-tactics", plan },
      "基本戦術を保存しています…",
    );
  };

  const saveLineupPreset = async (
    slot: SavedLineupSlot,
    name: string,
    selection: TeamSelection,
  ) => {
    await cloudSession.runAction(
      { type: "save-lineup-preset", slot, name, selection },
      "保存編成を保存しています…",
    );
  };

  const deleteLineupPreset = async (slot: SavedLineupSlot) => {
    await cloudSession.runAction(
      { type: "delete-lineup-preset", slot },
      "保存編成を削除しています…",
    );
  };

  const acceptPracticeOffer = async () => {
    await cloudSession.runAction(
      { type: "practice-offer-accept" },
      "練習試合を決定しています…",
    );
  };

  const declinePracticeOffer = async () => {
    await cloudSession.runAction(
      { type: "practice-offer-decline" },
      "申し込みを断っています…",
    );
  };

  const requestPracticeMatch = async (schoolId: SchoolId) => {
    await cloudSession.runAction(
      { type: "practice-request", schoolId },
      "練習試合を申し込んでいます…",
    );
  };

  const openFreshPracticeMatch = () => {
    if (!practiceMatchCompleted) {
      setActiveMatchResult(null);
      setActiveMatchPresentation(null);
      setOfficialTournamentView(null);
      setPreMatch(null);
      setMatchView("practice");
      setActiveTab("match");
    }
  };

  const openOfficialTournament = () => {
    const nextOfficial = selectNextOfficialEvent(gameState);
    if (!nextOfficial) return;
    setActiveMatchResult(null);
    setActiveMatchPresentation(null);
    setPreMatch(null);
    setOfficialTournamentView({
      circuit: nextOfficial.circuit,
      level: nextOfficial.level,
    });
    setMatchView("practice");
    setActiveTab("match");
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
    setOfficialTournamentView(null);
    setPreMatch(null);
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

  const challengePvpTeam = async (
    opponentSnapshotId: string,
    matchSelection?: TeamSelection,
    matchTactics?: MatchTacticPlan,
  ) => {
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
        ...(matchSelection ? { matchSelection } : {}),
        ...(matchTactics ? { matchTactics } : {}),
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

  const loadShop = async (): Promise<boolean> => {
    if (!api.getShop) {
      setShopError("ショップ機能を利用できません");
      return false;
    }

    setShopLoading(true);
    setShopError(null);
    try {
      const status = await api.getShop(session.accessToken);
      setShopStatus(status);
      return true;
    } catch (error) {
      setShopError(
        shopErrorMessage(error, "ショップ情報を読み込めませんでした"),
      );
      return false;
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
    if (!(await loadShop())) return false;
    setShopRetryRequest(null);
    return true;
  };

  const recoverShopRevision = async (): Promise<boolean> => {
    try {
      const latest = await api.bootstrap(session.accessToken);
      if (latest.status !== "ready") {
        setShopError("最新のゲーム状態を読み込めませんでした");
        return false;
      }
      await cloudSession.adoptServerSnapshot(
        latest.game,
        "最新のゲーム状態を読み込みました",
      );
      if (!(await loadShop())) return false;
      setShopRetryRequest(null);
      setShopError("最新のゲーム状態を読み込みました。もう一度お試しください");
      return true;
    } catch (error) {
      setShopError(
        shopErrorMessage(error, "最新のゲーム状態を読み込めませんでした"),
      );
      return false;
    }
  };

  const executeShopPurchase = async (request: ShopPurchaseRequest) => {
    if (!api.purchaseShopItem || shopPendingAction !== null) {
      if (!api.purchaseShopItem) {
        setShopError("ショップ購入機能を利用できません");
      }
      return;
    }

    setShopPendingAction("purchase");
    setShopPendingItemId(request.itemId);
    setShopResultMessage(null);
    setLatestShopUseResult(null);
    setShopRetryRequest(null);
    setShopError(null);
    try {
      const response = await api.purchaseShopItem(session.accessToken, request);
      if (await refreshShopAfterMutation(response.revision)) {
        setShopResultMessage("購入しました ✓");
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.code === "revision_conflict"
      ) {
        await recoverShopRevision();
        return;
      }
      if (error instanceof ApiError && error.status === null) {
        setShopRetryRequest({ action: "purchase", request });
      }
      setShopError(shopErrorMessage(error, "購入処理に失敗しました"));
    } finally {
      setShopPendingAction(null);
      setShopPendingItemId(null);
    }
  };

  const purchaseShopItemFromUi = async (itemId: ShopItemId) => {
    await executeShopPurchase({
      operationId: crypto.randomUUID(),
      revision: cloudSession.snapshot.revision,
      itemId,
    });
  };

  const executeShopUse = async (request: ShopUseRequest) => {
    if (!api.useShopItem || shopPendingAction !== null) {
      if (!api.useShopItem) {
        setShopError("ショップ使用機能を利用できません");
      }
      return;
    }

    const scoutingCandidateId =
      request.target?.type === "scouting-candidate"
        ? request.target.candidateId
        : null;
    const beforeScoutReport = scoutingCandidateId
      ? scoutingReports.find(
          (report) => report.candidateId === scoutingCandidateId,
        )
      : undefined;

    setShopPendingAction("use");
    setShopPendingItemId(request.itemId);
    setShopPendingTarget(request.target ?? null);
    setShopResultMessage(null);
    setLatestShopUseResult(null);
    setShopRetryRequest(null);
    setShopError(null);
    try {
      const response = await api.useShopItem(session.accessToken, request);
      if (await refreshShopAfterMutation(response.revision)) {
        let afterScoutReport: ScoutReport | undefined;
        if (
          scoutingOpen &&
          (request.itemId === "scout-research" ||
            request.itemId === "potential-appraisal" ||
            request.itemId === "extra-scout-candidate" ||
            request.itemId === "generational-scout-candidate")
        ) {
          const refreshedReports = await loadScoutingBoard(response.revision);
          if (scoutingCandidateId) {
            afterScoutReport = refreshedReports?.find(
              (report) => report.candidateId === scoutingCandidateId,
            );
          }
        }

        setLatestShopUseResult({
          itemId: request.itemId,
          result: response.result,
          ...(request.target ? { target: request.target } : {}),
          ...(beforeScoutReport ? { beforeScoutReport } : {}),
          ...(afterScoutReport ? { afterScoutReport } : {}),
        });
        setShopResultMessage("使用しました ✓");
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.code === "revision_conflict"
      ) {
        await recoverShopRevision();
        return;
      }
      if (error instanceof ApiError && error.status === null) {
        setShopRetryRequest({ action: "use", request });
      }
      setShopError(shopErrorMessage(error, "使用処理に失敗しました"));
    } finally {
      setShopPendingAction(null);
      setShopPendingItemId(null);
      setShopPendingTarget(null);
    }
  };

  const consumeShopItemFromUi = async (
    itemId: ShopItemId,
    target?: ShopUseTarget,
  ) => {
    await executeShopUse({
      operationId: crypto.randomUUID(),
      revision: cloudSession.snapshot.revision,
      itemId,
      target,
    });
  };

  const retryShopMutation = async () => {
    if (!shopRetryRequest) return;
    if (shopRetryRequest.action === "purchase") {
      await executeShopPurchase(shopRetryRequest.request);
      return;
    }
    await executeShopUse(shopRetryRequest.request);
  };

  const openShop = () => {
    setMoreView("shop");
    setShopResultMessage(null);
    setLatestShopUseResult(null);
    setShopRetryRequest(null);
    void loadShop();
  };

  const openInventory = () => {
    setMoreView("inventory");
    setShopResultMessage(null);
    setLatestShopUseResult(null);
    setShopRetryRequest(null);
    void loadShop();
  };

  const upgradeSchoolFacility = async (key: FacilityKey) => {
    await cloudSession.runAction(
      { type: "facility-upgrade", facility: key },
      "施設を更新しています…",
    );
  };

  const markNotificationRead = async (notificationId: string) => {
    await cloudSession.runAction(
      { type: "mark-notification-read", notificationId },
      "お知らせを更新しています…",
    );
  };

  const executeAdvanceWeek = async (
    matchSelection?: TeamSelection,
    matchTactics?: MatchTacticPlan,
  ) => {
    const response = await cloudSession.runAction(
      {
        type: "advance-week",
        ...(matchSelection ? { matchSelection } : {}),
        ...(matchTactics ? { matchTactics } : {}),
      },
      "練習を実施して次の週へ進めています…",
    );
    if (!response) return;

    const outcome = response.outcome as AdvanceWeekOutcome | undefined;
    setLatestYearTransition(outcome?.academicYearTransition ?? null);
    setPreMatch(null);
    setMatchView("practice");
    setPvpResult(null);
    setCalendarOpen(false);

    if (outcome?.pendingMatchPresentation) {
      setActiveMatchPresentation(outcome.pendingMatchPresentation);
      setActiveMatchResult(outcome.pendingMatchPresentation.simulation);
      setLatestMatchResult(outcome.pendingMatchPresentation.simulation);
      setOfficialTournamentView(null);
      setActiveTab("match");
      return;
    }

    setActiveMatchPresentation(null);
    setActiveMatchResult(null);
    setOfficialTournamentView(null);
    setActiveTab("home");
  };

  const issueMatchCommand = async (command: MatchCommand) => {
    const response = await cloudSession.runAction(
      { type: "match-command", command },
      "監督指示を反映しています…",
    );
    if (!response) return;

    const presentation = response.outcome as
      PendingMatchPresentation | undefined;
    if (!presentation) return;

    setActiveMatchPresentation(presentation);
    setActiveMatchResult(presentation.simulation);
    setLatestMatchResult(presentation.simulation);
  };

  const advanceWeek = async () => {
    const preparation = selectWeekPreMatchPreparation(gameState);
    if (preparation) {
      setActiveMatchResult(null);
      setActiveMatchPresentation(null);
      setOfficialTournamentView(null);
      setMatchView("practice");
      setCalendarOpen(false);
      setPreMatch({
        kind: "week",
        opponentName: preparation.opponentName,
        ...(preparation.opponentStrength !== undefined
          ? { opponentStrength: preparation.opponentStrength }
          : {}),
        ...(preparation.opponentSelection
          ? { opponentSelection: preparation.opponentSelection }
          : {}),
        ...(preparation.opponentTactics
          ? { opponentTactics: preparation.opponentTactics }
          : {}),
      });
      setActiveTab("match");
      return;
    }
    await executeAdvanceWeek();
  };

  const handleHomeCommand = (action: HomeCommandAction) => {
    switch (action.target) {
      case "team":
        setTeamInitialPlayerId(null);
        setActiveTab("team");
        return;
      case "player":
        setTeamInitialPlayerId(action.playerId);
        setActiveTab("team");
        return;
      case "school":
        requestSchoolView(action.view);
        setScoutingOpen(false);
        setActiveTab("school");
        return;
      case "scouting":
        setActiveTab("school");
        openScouting();
        return;
      case "practice":
        openFreshPracticeMatch();
        return;
      case "tournament":
        openOfficialTournament();
        return;
      case "start-week-match":
        void advanceWeek();
        return;
    }
  };

  const chooseEvent = async (choiceId: string) => {
    await cloudSession.runAction(
      { type: "event-choice", choiceId },
      "イベント結果を保存しています…",
    );
  };

  const preMatchPending =
    preMatch?.kind === "pvp"
      ? pvpChallengingSnapshotId !== null
      : cloudSession.operation.status === "submitting";

  const content =
    activeTab === "match" && preMatch ? (
      <PreMatchLineupScreen
        baseSelection={teamSelection}
        mode={preMatch.kind === "pvp" ? "pvp" : "pve"}
        onCancel={() => {
          const kind = preMatch.kind;
          setPreMatch(null);
          if (kind === "week") setActiveTab("home");
        }}
        onStart={(selection, tactics) => {
          if (preMatch.kind === "pvp") {
            const opponentSnapshotId = preMatch.opponentSnapshotId;
            void (async () => {
              await challengePvpTeam(opponentSnapshotId, selection, tactics);
              setPreMatch(null);
            })();
            return;
          }
          void executeAdvanceWeek(selection, tactics);
        }}
        opponentName={preMatch.opponentName}
        {...(preMatch.opponentStrength !== undefined
          ? { opponentStrength: preMatch.opponentStrength }
          : {})}
        {...(preMatch.kind === "week" && preMatch.opponentSelection
          ? { opponentSelection: preMatch.opponentSelection }
          : {})}
        {...(preMatch.opponentTactics
          ? { opponentTactics: preMatch.opponentTactics }
          : {})}
        pending={preMatchPending}
        state={gameState}
      />
    ) : activeTab === "home" ? (
      <HomeScreen
        data={gameData}
        homeStrength={homeStrength}
        onAcceptPracticeOffer={() => void acceptPracticeOffer()}
        onAdvanceWeek={advanceWeek}
        onCommand={handleHomeCommand}
        onDeclinePracticeOffer={() => void declinePracticeOffer()}
        onMarkNotificationRead={markNotificationRead}
        operationPending={cloudSession.operation.status === "submitting"}
        state={gameState}
      />
    ) : activeTab === "team" ? (
      <PlayerHubScreen
        initialPlayerId={teamInitialPlayerId}
        leadershipPending={cloudSession.operation.status === "submitting"}
        onAssignLeadership={saveTeamLeadership}
        onChange={saveTeamSelection}
        onChangeTraining={changePlayerTraining}
        onDeleteLineupPreset={deleteLineupPreset}
        onSaveLineupPreset={saveLineupPreset}
        onSetDevelopmentPriorities={saveDevelopmentPriorities}
        onSetTeamTactics={saveTeamTactics}
        planningPending={cloudSession.operation.status === "submitting"}
        tacticsPending={cloudSession.operation.status === "submitting"}
        trainingPending={cloudSession.operation.status === "submitting"}
        selection={teamSelection}
        state={gameState}
      />
    ) : activeTab === "school" && scoutingOpen ? (
      <ScoutingScreen
        error={scoutingError}
        latestShopUseResult={latestShopUseResult}
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
        onUseShopItem={(itemId, target) => {
          void consumeShopItemFromUi(itemId, target);
        }}
        recruitingCandidateId={recruitingCandidateId}
        reports={scoutingReports}
        shopPendingCandidateId={
          shopPendingTarget?.type === "scouting-candidate"
            ? shopPendingTarget.candidateId
            : null
        }
        shopPendingItemId={shopPendingItemId}
        shopStatus={shopStatus}
        state={gameState}
      />
    ) : activeTab === "school" ? (
      <SchoolScreen
        onOpenScouting={openScouting}
        onUpgradeFacility={upgradeSchoolFacility}
        state={gameState}
      />
    ) : activeTab === "match" && officialTournamentView ? (
      <TournamentScreen
        circuit={officialTournamentView.circuit}
        level={officialTournamentView.level}
        onBack={() => {
          setOfficialTournamentView(null);
          setMatchView("practice");
        }}
        state={gameState}
      />
    ) : activeTab === "match" && matchView === "pvp" ? (
      <PvpScreen
        challengingSnapshotId={pvpChallengingSnapshotId}
        error={pvpError}
        history={pvpHistory}
        loading={pvpLoading}
        onChallenge={(snapshotId) => {
          const selectedOpponent = pvpOpponents.find(
            (item) => item.snapshotId === snapshotId,
          );
          if (!selectedOpponent) return;
          setPvpResult(null);
          setPvpError(null);
          setPreMatch({
            kind: "pvp",
            opponentSnapshotId: selectedOpponent.snapshotId,
            opponentName: selectedOpponent.schoolName,
            opponentStrength: selectedOpponent.teamPower,
            ...(selectedOpponent.tactics
              ? { opponentTactics: selectedOpponent.tactics }
              : {}),
          });
        }}
        onPublish={() => {
          void publishPvpTeam();
        }}
        onRefresh={() => {
          void loadPvpData();
        }}
        onReturnPractice={() => {
          setMatchView("practice");
          setPreMatch(null);
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
        {!activeMatchResult && !activeMatchPresentation ? (
          <MatchOfficialEntry
            onOpen={openOfficialTournament}
            state={gameState}
          />
        ) : null}
        {!activeMatchResult && !activeMatchPresentation ? (
          <MatchPvpEntry onOpen={openPvp} />
        ) : null}
        {!activeMatchResult && !activeMatchPresentation ? (
          <PracticeMatchPlanning
            onAcceptOffer={() => {
              void acceptPracticeOffer();
            }}
            onDeclineOffer={() => {
              void declinePracticeOffer();
            }}
            onRequest={(schoolId) => {
              void requestPracticeMatch(schoolId);
            }}
            pending={cloudSession.operation.status === "submitting"}
            state={gameState}
          />
        ) : null}
        {activeMatchResult ? (
          <MatchScreen
            awaySelection={opponentSelection}
            awayStrength={awayStrength}
            homeSelection={teamSelection}
            homeStrength={homeStrength}
            commandPending={cloudSession.operation.status === "submitting"}
            onCommand={issueMatchCommand}
            onReturnHome={() => {
              if (activeMatchPresentation) void executeAdvanceWeek();
              else changeTab("home");
            }}
            onStart={() => undefined}
            opponent={opponent}
            presentation={activeMatchPresentation}
            reducedMotion={gameState.settings.reducedMotion}
            result={activeMatchPresentation?.simulation ?? activeMatchResult}
            state={gameState}
          />
        ) : null}
      </div>
    ) : moreView === "shop" || moreView === "inventory" ? (
      <ShopScreen
        error={shopError}
        latestUseResult={latestShopUseResult}
        loading={shopLoading}
        onBack={() => setMoreView("menu")}
        onPurchase={(itemId) => {
          void purchaseShopItemFromUi(itemId);
        }}
        onRetry={() => void loadShop()}
        onRetryMutation={() => {
          void retryShopMutation();
        }}
        onUse={(itemId, target) => {
          void consumeShopItemFromUi(itemId, target);
        }}
        pendingAction={shopPendingAction}
        pendingItemId={shopPendingItemId}
        resultMessage={shopResultMessage}
        retryAction={shopRetryRequest?.action ?? null}
        state={gameState}
        status={shopStatus}
        view={moreView === "shop" ? "products" : "inventory"}
      />
    ) : (
      <MoreScreen
        accountLabel={session.email ?? "ログイン済みアカウント"}
        onOpenInventory={openInventory}
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
