import { useMemo, useState } from "react";
import type { CloudGameSnapshot } from "../../worker/data/GameStore";
import "./app-shell.css";
import { gameData } from "./createDemoGame";
import { useGameSession } from "./useGameSession";
import type { AcademicYearTransitionSummary } from "../domain/calendar/academicYearProgression";
import { isWeeklyActionCompleted } from "../domain/calendar/weekProgression";
import { resolveEventChoice } from "../domain/events/resolveEventChoice";
import type { SimulateMatchResult } from "../domain/match/simulateMatch";
import type { SchoolReputation } from "../domain/model/School";
import { SeededRandom } from "../domain/random/SeededRandom";
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
import { MatchScreen } from "../features/match/MatchScreen";
import { MoreScreen } from "../features/more/MoreScreen";
import { SchoolScreen } from "../features/school/SchoolScreen";
import { PlayerHubScreen } from "../features/team/PlayerHubScreen";
import { TrainingScreen } from "../features/training/TrainingScreen";
import type { GameApiClient } from "../services/api/GameApiClient";
import type { AuthClient, AuthSession } from "../services/auth/AuthClient";
import { GamePageFrame } from "../ui/shell/GamePageFrame";
import type { AppTab } from "../ui/shell/appNavigation";

interface GameAppProps {
  snapshot: CloudGameSnapshot;
  session: AuthSession;
  auth: AuthClient;
  api: GameApiClient;
}

type MoreView = "menu" | "school";

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

export function GameApp({ snapshot, session, auth, api }: GameAppProps) {
  const cloudSession = useGameSession({
    accessToken: session.accessToken,
    initialSnapshot: snapshot,
    api,
  });
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [moreView, setMoreView] = useState<MoreView>("menu");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [appState, setAppState] = useState(() => ({
    gameState: snapshot.state,
    teamSelection: snapshot.teamSelection,
  }));
  const [latestTrainingResult, setLatestTrainingResult] =
    useState<TrainingResult | null>(null);
  const [latestMatchResult, setLatestMatchResult] =
    useState<SimulateMatchResult | null>(null);
  const [activeMatchResult, setActiveMatchResult] =
    useState<SimulateMatchResult | null>(null);
  const [latestYearTransition, setLatestYearTransition] =
    useState<AcademicYearTransitionSummary | null>(null);
  const { gameState, teamSelection } = appState;
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
    setActiveTab(tab);
  };

  const executeTraining = async (plan: WeeklyPlan) => {
    if (trainingCompleted) return;
    const response = await cloudSession.runAction(
      { type: "training", plan },
      "練習結果を保存しています…",
    );
    if (!response) return;

    setAppState({
      gameState: response.game.state,
      teamSelection: response.game.teamSelection,
    });
    if (response.outcome !== undefined) {
      setLatestTrainingResult(response.outcome as TrainingResult);
    }
  };

  const openFreshPracticeMatch = () => {
    if (!practiceMatchCompleted) {
      setActiveMatchResult(null);
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

    setAppState({
      gameState: response.game.state,
      teamSelection: response.game.teamSelection,
    });
    if (response.outcome !== undefined) {
      const simulation = response.outcome as SimulateMatchResult;
      setLatestMatchResult(simulation);
      setActiveMatchResult(simulation);
    }
  };

  const upgradeSchoolFacility = async (key: FacilityKey) => {
    const response = await cloudSession.runAction(
      { type: "facility-upgrade", facility: key },
      "施設を更新しています…",
    );
    if (!response) return;

    setAppState({
      gameState: response.game.state,
      teamSelection: response.game.teamSelection,
    });
  };

  const advanceWeek = async () => {
    if (!trainingCompleted) return;
    const response = await cloudSession.runAction(
      { type: "advance-week" },
      "次の週へ進めています…",
    );
    if (!response) return;

    setAppState({
      gameState: response.game.state,
      teamSelection: response.game.teamSelection,
    });
    const outcome = response.outcome as AdvanceWeekOutcome | undefined;
    setLatestYearTransition(outcome?.academicYearTransition ?? null);
    setLatestTrainingResult(null);
    setActiveMatchResult(null);
    setCalendarOpen(false);
    setActiveTab("home");
  };

  const chooseEvent = (choiceId: string) => {
    const random = new SeededRandom(gameState.seed, gameState.randomCursor);
    const nextState = resolveEventChoice(
      gameState,
      choiceId,
      gameData,
      random,
    ).state;
    setAppState((current) => ({ ...current, gameState: nextState }));
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
        onChange={(selection) =>
          setAppState((current) => ({ ...current, teamSelection: selection }))
        }
        selection={teamSelection}
        state={gameState}
      />
    ) : activeTab === "training" ? (
      <TrainingScreen
        completed={trainingCompleted}
        data={gameData}
        latestResult={latestTrainingResult}
        onExecute={executeTraining}
        state={gameState}
      />
    ) : activeTab === "match" ? (
      <MatchScreen
        awaySelection={opponentSelection}
        awayStrength={awayStrength}
        homeSelection={teamSelection}
        homeStrength={homeStrength}
        onReturnHome={() => setActiveTab("home")}
        onStart={startPracticeMatch}
        opponent={opponent}
        reducedMotion={gameState.settings.reducedMotion}
        result={activeMatchResult}
        state={gameState}
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
