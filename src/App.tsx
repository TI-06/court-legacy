import { useMemo, useState } from "react";
import "./app/app-shell.css";
import { createDemoGame, gameData } from "./app/createDemoGame";
import {
  simulateMatch,
  type SimulateMatchResult,
} from "./domain/match/simulateMatch";
import { matchId } from "./domain/model/identifiers";
import { SeededRandom } from "./domain/random/SeededRandom";
import {
  calculateSelectionStrength,
  selectPracticeOpponent,
} from "./domain/selectors/matchSelectors";
import { autoSelectTeam } from "./domain/team/autoSelectTeam";
import {
  resolveWeeklyTraining,
  type TrainingResult,
  type WeeklyPlan,
} from "./domain/training/resolveWeeklyTraining";
import { HomeScreen } from "./features/home/HomeScreen";
import { MatchScreen } from "./features/match/MatchScreen";
import { TeamScreen } from "./features/team/TeamScreen";
import { TrainingScreen } from "./features/training/TrainingScreen";

type AppTab = "home" | "team" | "training" | "match" | "school";
type IconName = "home" | "team" | "training" | "match" | "school" | "calendar";

interface IconProps {
  name: IconName;
}

function Icon({ name }: IconProps) {
  const paths: Record<IconName, string> = {
    home: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z",
    team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    training: "M6.5 6.5h11v11h-11zM3 9v6M21 9v6M9 3h6M9 21h6",
    match:
      "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Zm10 2h3v2a4 4 0 0 1-4 4M7 6H4v2a4 4 0 0 0 4 4",
    school: "m3 10 9-6 9 6-9 6-9-6Zm3 4v5h12v-5M9 19v-4h6v4",
    calendar: "M6 2v4M18 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v15H3V6a2 2 0 0 1 2-2Z",
  };

  return (
    <svg aria-hidden="true" className="icon" fill="none" viewBox="0 0 24 24">
      <path
        d={paths[name]}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

const navigationItems: Array<{
  id: AppTab;
  label: string;
  icon: IconName;
}> = [
  { id: "home", label: "ホーム", icon: "home" },
  { id: "team", label: "チーム", icon: "team" },
  { id: "training", label: "育成", icon: "training" },
  { id: "match", label: "試合", icon: "match" },
  { id: "school", label: "学校", icon: "school" },
];

function createInitialAppState() {
  const gameState = createDemoGame();
  const teamSelection = autoSelectTeam({
    state: gameState,
    schoolId: gameState.userSchoolId,
  });

  return { gameState, teamSelection };
}

function SchoolPlaceholder() {
  return (
    <main className="app-content">
      <section className="placeholder-card">
        <p className="section-kicker">COMING NEXT</p>
        <h2>学校運営</h2>
        <p>設備、評判、スカウト、OB記録を順次追加します。</p>
      </section>
    </main>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [appState, setAppState] = useState(createInitialAppState);
  const [latestTrainingResult, setLatestTrainingResult] =
    useState<TrainingResult | null>(null);
  const [latestMatchResult, setLatestMatchResult] =
    useState<SimulateMatchResult | null>(null);
  const [activeMatchResult, setActiveMatchResult] =
    useState<SimulateMatchResult | null>(null);
  const { gameState, teamSelection } = appState;
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

  const executeTraining = (plan: WeeklyPlan) => {
    const random = new SeededRandom(gameState.seed, gameState.randomCursor);
    const resolution = resolveWeeklyTraining({
      state: gameState,
      schoolId: gameState.userSchoolId,
      plan,
      data: gameData,
      random,
    });

    setAppState((current) => ({
      ...current,
      gameState: resolution.state,
    }));
    setLatestTrainingResult(resolution.result);
  };

  const openFreshPracticeMatch = () => {
    setActiveMatchResult(null);
    setActiveTab("match");
  };

  const startPracticeMatch = () => {
    const id = matchId(
      `practice-${gameState.date}-${gameState.randomCursor}`,
    );
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
    setAppState((current) => ({
      ...current,
      gameState: {
        ...current.gameState,
        randomCursor: simulation.match.randomCursor,
        activeMatch: simulation.match,
        history: {
          ...current.gameState.history,
          matches: [
            ...current.gameState.history.matches,
            {
              matchId: simulation.match.id,
              date: current.gameState.date,
              homeSchoolId: simulation.match.homeSchoolId,
              awaySchoolId: simulation.match.awaySchoolId,
              winnerSchoolId: simulation.analysis.winnerSchoolId,
              homeSetsWon: simulation.match.homeSetsWon,
              awaySetsWon: simulation.match.awaySetsWon,
              tournamentId: null,
            },
          ],
        },
      },
    }));
  };

  const content =
    activeTab === "home" ? (
      <HomeScreen
        homeStrength={homeStrength}
        latestMatch={latestMatchResult}
        onOpenMatch={openFreshPracticeMatch}
        onOpenTeam={() => setActiveTab("team")}
        onOpenTraining={() => setActiveTab("training")}
        opponent={opponent}
        state={gameState}
      />
    ) : activeTab === "team" ? (
      <TeamScreen
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
      <SchoolPlaceholder />
    );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">COURT LEGACY</p>
          <h1>継承のコート</h1>
        </div>
        <button aria-label="予定を確認" className="header-action" type="button">
          <Icon name="calendar" />
        </button>
      </header>

      {content}

      <nav aria-label="主要メニュー" className="bottom-navigation">
        {navigationItems.map((item) => {
          const active = activeTab === item.id;

          return (
            <button
              aria-current={active ? "page" : undefined}
              className={active ? "nav-item nav-item--active" : "nav-item"}
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              type="button"
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
