import { useEffect, useMemo, useState } from "react";
import "./app/app-shell.css";
import { createDemoGame, gameData } from "./app/createDemoGame";
import {
  advanceGameWeek,
  type AcademicYearTransitionSummary,
} from "./domain/calendar/academicYearProgression";
import {
  isWeeklyActionCompleted,
  markWeeklyActionCompleted,
} from "./domain/calendar/weekProgression";
import { surfaceWeeklyEvent } from "./domain/events/eventPipeline";
import { resolveEventChoice } from "./domain/events/resolveEventChoice";
import {
  simulateMatch,
  type SimulateMatchResult,
} from "./domain/match/simulateMatch";
import type { GameState } from "./domain/model/GameState";
import { matchId } from "./domain/model/identifiers";
import { SeededRandom } from "./domain/random/SeededRandom";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "./domain/selectors/matchSelectors";
import {
  upgradeFacility,
  type FacilityKey,
} from "./domain/school/facilityUpgrade";
import { autoSelectTeam } from "./domain/team/autoSelectTeam";
import {
  resolveWeeklyTraining,
  type TrainingResult,
  type WeeklyPlan,
} from "./domain/training/resolveWeeklyTraining";
import { recordMatchOutcome } from "./domain/world/rivalWorldProgression";
import { CalendarSheet } from "./features/calendar/CalendarSheet";
import { EventDialog } from "./features/home/EventDialog";
import { HomeScreen } from "./features/home/HomeScreen";
import { YearTransitionDialog } from "./features/home/YearTransitionDialog";
import { MatchScreen } from "./features/match/MatchScreen";
import { SaveSheet } from "./features/save/SaveSheet";
import { SchoolScreen } from "./features/school/SchoolScreen";
import { PlayerHubScreen } from "./features/team/PlayerHubScreen";
import { TrainingScreen } from "./features/training/TrainingScreen";
import type { SaveSlotId } from "./persistence/GameRepository";
import { browserGameRepository } from "./persistence/IndexedDbGameRepository";
import { GamePageFrame } from "./ui/shell/GamePageFrame";
import type { AppTab } from "./ui/shell/appNavigation";

function createAppState(gameState: GameState) {
  const teamSelection = autoSelectTeam({
    state: gameState,
    schoolId: gameState.userSchoolId,
  });
  return { gameState, teamSelection };
}

function createInitialAppState() {
  return createAppState(createDemoGame());
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [activeSaveSlotId, setActiveSaveSlotId] =
    useState<SaveSlotId>("slot-1");
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [appState, setAppState] = useState(createInitialAppState);
  const [latestTrainingResult, setLatestTrainingResult] =
    useState<TrainingResult | null>(null);
  const [latestMatchResult, setLatestMatchResult] =
    useState<SimulateMatchResult | null>(null);
  const [activeMatchResult, setActiveMatchResult] =
    useState<SimulateMatchResult | null>(null);
  const [latestYearTransition, setLatestYearTransition] =
    useState<AcademicYearTransitionSummary | null>(null);
  const { gameState, teamSelection } = appState;
  const trainingCompleted = isWeeklyActionCompleted(gameState, "training");
  const practiceMatchCompleted = isWeeklyActionCompleted(
    gameState,
    "practice-match",
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const slots = await browserGameRepository.listSlots();
        const newest = slots
          .filter((slot) => slot.exists && slot.updatedAt)
          .sort((left, right) =>
            (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""),
          )[0];
        if (!newest) {
          return;
        }

        const loaded = await browserGameRepository.load(newest.slotId);
        if (!active) {
          return;
        }
        setAppState(createAppState(loaded));
        setActiveSaveSlotId(newest.slotId);
        setSaveNotice(`${newest.slotId.replace("slot-", "スロット")}を復元`);
      } catch {
        if (active && typeof indexedDB !== "undefined") {
          setSaveNotice("ローカル保存を確認できませんでした");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

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

  const loadGameState = (loadedState: GameState) => {
    setAppState(createAppState(loadedState));
    setLatestTrainingResult(null);
    setLatestMatchResult(null);
    setActiveMatchResult(null);
    setLatestYearTransition(null);
    setActiveTab("home");
    setCalendarOpen(false);
  };

  const executeTraining = (plan: WeeklyPlan) => {
    if (trainingCompleted) {
      return;
    }

    const random = new SeededRandom(gameState.seed, gameState.randomCursor);
    const resolution = resolveWeeklyTraining({
      state: gameState,
      schoolId: gameState.userSchoolId,
      plan,
      data: gameData,
      random,
    });
    const completedState = markWeeklyActionCompleted(
      resolution.state,
      "training",
    );

    setAppState((current) => ({
      ...current,
      gameState: completedState,
    }));
    setLatestTrainingResult(resolution.result);
  };

  const openFreshPracticeMatch = () => {
    if (practiceMatchCompleted) {
      return;
    }
    setActiveMatchResult(null);
    setActiveTab("match");
  };

  const startPracticeMatch = () => {
    if (practiceMatchCompleted) {
      return;
    }

    const id = matchId(`practice-${gameState.date}-${gameState.randomCursor}`);
    const random = new SeededRandom(gameState.seed, gameState.randomCursor);
    const simulation = simulateMatch({
      state: gameState,
      id,
      homeSchoolId: gameState.userSchoolId,
      awaySchoolId: opponent.id,
      homeSelection: teamSelection,
      awaySelection: opponentSelection,
      bestOfSets: 3,
      random,
    });

    setLatestMatchResult(simulation);
    setActiveMatchResult(simulation);
    setAppState((current) => {
      const matchState = {
        ...current.gameState,
        randomCursor: simulation.match.randomCursor,
        activeMatch: simulation.match,
      };
      const updatedState = recordMatchOutcome(matchState, {
        matchId: simulation.match.id,
        date: current.gameState.date,
        homeSchoolId: simulation.match.homeSchoolId,
        awaySchoolId: simulation.match.awaySchoolId,
        winnerSchoolId: simulation.analysis.winnerSchoolId,
        homeSetsWon: simulation.match.homeSetsWon,
        awaySetsWon: simulation.match.awaySetsWon,
        tournamentId: null,
      });

      return {
        ...current,
        gameState: markWeeklyActionCompleted(updatedState, "practice-match"),
      };
    });
  };

  const upgradeSchoolFacility = (key: FacilityKey) => {
    setAppState((current) => ({
      ...current,
      gameState: upgradeFacility(
        current.gameState,
        current.gameState.userSchoolId,
        key,
      ),
    }));
  };

  const advanceWeek = () => {
    if (!trainingCompleted) {
      return;
    }

    const progression = advanceGameWeek(gameState, gameData);
    const nextState = progression.academicYearTransition
      ? progression.state
      : surfaceWeeklyEvent(progression.state, gameData);
    if (progression.academicYearTransition) {
      setAppState(createAppState(nextState));
      setLatestYearTransition(progression.academicYearTransition);
    } else {
      setAppState((current) => ({ ...current, gameState: nextState }));
    }
    if (nextState.settings.autosaveEnabled) {
      setSaveNotice("自動保存中");
      void browserGameRepository
        .save(activeSaveSlotId, nextState, "autosave")
        .then(() => setSaveNotice("自動保存済み"))
        .catch(() => setSaveNotice("自動保存に失敗"));
    }
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
    if (nextState.settings.autosaveEnabled) {
      setSaveNotice("イベント結果を保存中");
      void browserGameRepository
        .save(activeSaveSlotId, nextState, "autosave")
        .then(() => setSaveNotice("イベント結果を保存済み"))
        .catch(() => setSaveNotice("イベント結果の保存に失敗"));
    }
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
          setAppState((current) => ({
            ...current,
            teamSelection: selection,
          }))
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
    ) : (
      <SchoolScreen
        onUpgradeFacility={upgradeSchoolFacility}
        state={gameState}
      />
    );

  return (
    <>
      <GamePageFrame
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenCalendar={() => setCalendarOpen(true)}
        onOpenSave={() => setSaveOpen(true)}
        saveNotice={saveNotice}
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
      <SaveSheet
        activeSlotId={activeSaveSlotId}
        onActiveSlotChange={setActiveSaveSlotId}
        onClose={() => setSaveOpen(false)}
        onLoadState={loadGameState}
        open={saveOpen}
        repository={browserGameRepository}
        state={gameState}
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
