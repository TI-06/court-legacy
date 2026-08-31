from pathlib import Path
import subprocess


def run(*args: str, check: bool = True):
    return subprocess.run(args, check=check)


def write_red_test() -> None:
    Path("tests/unit/features/match/Phase11PvePlanning.test.tsx").write_text(r'''import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { advanceOfficialTournamentsThroughWeek } from "../../../../src/domain/tournament/progressOfficialTournaments";
import { TournamentScreen } from "../../../../src/features/tournament/TournamentScreen";

it("keeps a due official match reference-only and directs execution to Home", () => {
  const initial = createDemoGame();
  const state = advanceOfficialTournamentsThroughWeek({
    ...initial,
    calendar: { ...initial.calendar, weekOfYear: 9 },
  });

  render(
    <TournamentScreen
      circuit="interhigh"
      level="prefectural"
      onBack={vi.fn()}
      onStartOfficialMatch={vi.fn()}
      pending={false}
      state={state}
      trainingCompleted
    />,
  );

  expect(screen.queryByRole("button", { name: "公式戦を開始" })).toBeNull();
  expect(screen.getByText(/ホームの「次の週へ進む」で試合を実施/)).toBeVisible();
});
''')


def implement_tournament() -> None:
    p = Path("src/features/tournament/TournamentScreen.tsx")
    text = p.read_text()
    text = text.replace('import { useState } from "react";', 'import { useState } from "react";')
    text = text.replace('import { BottomSheet } from "../../ui/BottomSheet";\nimport "../../ui/ui.css";\n', '')
    old = '''interface TournamentScreenProps {
  state: GameState;
  circuit: TournamentCircuit;
  level: TournamentLevel;
  trainingCompleted: boolean;
  pending: boolean;
  onStartOfficialMatch: () => void;
  onBack: () => void;
}'''
    new = '''interface TournamentScreenProps {
  state: GameState;
  circuit: TournamentCircuit;
  level: TournamentLevel;
  onBack: () => void;
}'''
    if old not in text:
        raise RuntimeError("tournament props anchor missing")
    text = text.replace(old, new)
    old = '''export function TournamentScreen({
  state,
  circuit,
  level,
  trainingCompleted,
  pending,
  onStartOfficialMatch,
  onBack,
}: TournamentScreenProps) {'''
    new = '''export function TournamentScreen({
  state,
  circuit,
  level,
  onBack,
}: TournamentScreenProps) {'''
    if old not in text:
        raise RuntimeError("tournament function anchor missing")
    text = text.replace(old, new)
    text = text.replace('  const [confirmationOpen, setConfirmationOpen] = useState(false);\n', '')
    can_start = '''  const canStart =
    due &&
    trainingCompleted &&
    !pending &&
    stage.status !== "eliminated" &&
    stage.status !== "champion";
'''
    text = text.replace(can_start, '')
    start = text.find('  const requestStart = () => {')
    if start >= 0:
        end = text.index('  const timingLabel =', start)
        text = text[:start] + text[end:]
    old = '''            const inlineAction =
              isCurrentUserMatch && due ? (
                <>
                  {!trainingCompleted ? (
                    <p className="tournament-training-note">
                      今週の練習を完了すると開始できます
                    </p>
                  ) : null}
                  {pending ? (
                    <p className="tournament-pending" role="status">
                      <strong>公式戦を開始しています…</strong>
                      <span>試合結果を確定しています…</span>
                      <span>大会結果を保存しています…</span>
                    </p>
                  ) : null}
                  <button
                    className="tournament-start-button"
                    disabled={!canStart}
                    onClick={requestStart}
                    type="button"
                  >
                    {pending ? "公式戦を開始しています…" : "公式戦を開始"}
                  </button>
                </>
              ) : null;'''
    new = '''            const inlineAction =
              isCurrentUserMatch && due ? (
                <p className="tournament-training-note">
                  ホームの「次の週へ進む」で試合を実施します
                </p>
              ) : null;'''
    if old not in text:
        raise RuntimeError("tournament inline action anchor missing")
    text = text.replace(old, new)
    sheet_start = text.find('      <BottomSheet')
    if sheet_start >= 0:
        sheet_end = text.index('      </BottomSheet>', sheet_start) + len('      </BottomSheet>\n')
        text = text[:sheet_start] + text[sheet_end:]
    p.write_text(text)


def implement_practice_planning() -> None:
    p = Path("src/features/match/PracticeMatchPlanning.tsx")
    text = p.read_text()
    if '<b>試合準備へ</b>' not in text:
        raise RuntimeError("practice scheduled copy anchor missing")
    text = text.replace('<b>試合準備へ</b>', '<b>ホームの「次の週へ進む」で実施</b>')
    p.write_text(text)


def implement_game_app() -> None:
    p = Path("src/app/GameApp.tsx")
    text = p.read_text()
    start = text.find('  const startOfficialMatch = async () => {')
    if start < 0:
        raise RuntimeError("startOfficialMatch anchor missing")
    end = text.index('  const loadPvpData = async () => {', start)
    text = text[:start] + text[end:]
    old = '''      <TournamentScreen
        circuit={officialTournamentView.circuit}
        level={officialTournamentView.level}
        onBack={() => {
          setOfficialTournamentView(null);
          setMatchView("practice");
        }}
        onStartOfficialMatch={() => {
          void startOfficialMatch();
        }}
        pending={cloudSession.operation.status === "submitting"}
        state={gameState}
        trainingCompleted={trainingCompleted}
      />'''
    new = '''      <TournamentScreen
        circuit={officialTournamentView.circuit}
        level={officialTournamentView.level}
        onBack={() => {
          setOfficialTournamentView(null);
          setMatchView("practice");
        }}
        state={gameState}
      />'''
    if old not in text:
        raise RuntimeError("GameApp TournamentScreen anchor missing")
    text = text.replace(old, new)
    old = '''        <MatchScreen
          awaySelection={opponentSelection}
          awayStrength={awayStrength}
          homeSelection={teamSelection}
          homeStrength={homeStrength}
          onReturnHome={() => {
            if (activeMatchPresentation) void advanceWeek();
            else changeTab("home");
          }}
          onStart={startPracticeMatch}
          opponent={opponent}
          presentation={activeMatchPresentation}
          reducedMotion={gameState.settings.reducedMotion}
          result={activeMatchPresentation?.simulation ?? activeMatchResult}
          state={gameState}
        />'''
    new = '''        {activeMatchResult ? (
          <MatchScreen
            awaySelection={opponentSelection}
            awayStrength={awayStrength}
            homeSelection={teamSelection}
            homeStrength={homeStrength}
            onReturnHome={() => {
              if (activeMatchPresentation) void advanceWeek();
              else changeTab("home");
            }}
            onStart={() => undefined}
            opponent={opponent}
            presentation={activeMatchPresentation}
            reducedMotion={gameState.settings.reducedMotion}
            result={activeMatchPresentation?.simulation ?? activeMatchResult}
            state={gameState}
          />
        ) : null}'''
    if old not in text:
        raise RuntimeError("GameApp MatchScreen anchor missing")
    text = text.replace(old, new)
    p.write_text(text)


def rewrite_tests() -> None:
    Path("tests/unit/features/tournament/TournamentScreen.test.tsx").write_text(r'''import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import type { GameState } from "../../../../src/domain/model/GameState";
import { advanceOfficialTournamentsThroughWeek } from "../../../../src/domain/tournament/progressOfficialTournaments";
import { TournamentScreen } from "../../../../src/features/tournament/TournamentScreen";

function atWeek(weekOfYear: number): GameState {
  const state = createDemoGame();
  return { ...state, calendar: { ...state.calendar, weekOfYear } };
}

function dueState(): GameState {
  return advanceOfficialTournamentsThroughWeek(atWeek(9));
}

describe("TournamentScreen", () => {
  it("shows one round at a time without a horizontally scrolling bracket", () => {
    const state = createDemoGame();
    const { container } = render(
      <TournamentScreen
        circuit="interhigh"
        level="prefectural"
        onBack={vi.fn()}
        state={state}
      />,
    );

    expect(screen.getByRole("heading", { name: "インターハイ 県大会" })).toBeVisible();
    const firstRound = screen.getByRole("button", { name: "1回戦" });
    const quarterfinal = screen.getByRole("button", { name: "準々決勝" });
    expect(firstRound).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("tournament-bracket-match")).toHaveLength(8);
    expect(container.querySelector(".tournament-match-row--user .is-user")).toBeInTheDocument();
    fireEvent.click(quarterfinal);
    expect(quarterfinal).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("tournament-bracket-match")).toHaveLength(4);
  });

  it("keeps a due official match reference-only and points execution to Home", () => {
    render(
      <TournamentScreen
        circuit="interhigh"
        level="prefectural"
        onBack={vi.fn()}
        state={dueState()}
      />,
    );
    expect(screen.getAllByText("今週").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /公式戦を開始/ })).toBeNull();
    expect(screen.getByText(/ホームの「次の週へ進む」で試合を実施/)).toBeVisible();
  });

  it("shows eliminated and champion states without an execution action", () => {
    const eliminated = createDemoGame();
    eliminated.officialSeason.interhigh.prefectural = {
      ...eliminated.officialSeason.interhigh.prefectural,
      userEliminated: true,
      userBestRound: "round-of-16",
    };
    const champion = createDemoGame();
    const userEntrant = champion.officialSeason.interhigh.prefectural.entrants.find(
      (entrant) => entrant.source === "world-school" && entrant.schoolId === champion.userSchoolId,
    );
    if (!userEntrant) throw new Error("user tournament entrant not found");
    champion.officialSeason.interhigh.prefectural = {
      ...champion.officialSeason.interhigh.prefectural,
      championEntrantId: userEntrant.entrantId,
      userBestRound: "final",
    };

    const { rerender } = render(
      <TournamentScreen circuit="interhigh" level="prefectural" onBack={vi.fn()} state={eliminated} />,
    );
    expect(screen.getAllByText("敗退").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /公式戦を開始/ })).toBeNull();

    rerender(
      <TournamentScreen circuit="interhigh" level="prefectural" onBack={vi.fn()} state={champion} />,
    );
    expect(screen.getAllByText("優勝").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /公式戦を開始/ })).toBeNull();
  });
});
''')
    pending = Path("tests/unit/features/tournament/TournamentPendingStatus.test.tsx")
    if pending.exists():
        pending.unlink()


write_red_test()
run("npx", "prettier", "--write", "tests/unit/features/match/Phase11PvePlanning.test.tsx")
red = run("npm", "test", "--", "tests/unit/features/match/Phase11PvePlanning.test.tsx", check=False)
if red.returncode == 0:
    raise SystemExit("Task3 RED unexpectedly passed")
print("Task3 RED confirmed")
implement_tournament()
implement_practice_planning()
implement_game_app()
rewrite_tests()
run(
    "npx",
    "prettier",
    "--write",
    "src/features/tournament/TournamentScreen.tsx",
    "src/features/match/PracticeMatchPlanning.tsx",
    "src/app/GameApp.tsx",
    "tests/unit/features/tournament/TournamentScreen.test.tsx",
    "tests/unit/features/match/Phase11PvePlanning.test.tsx",
)
run(
    "npm",
    "test",
    "--",
    "tests/unit/features/match/Phase11PvePlanning.test.tsx",
    "tests/unit/features/tournament/TournamentScreen.test.tsx",
    "tests/unit/features/match/AppMatchFlow.test.tsx",
)
run("npm", "run", "typecheck")
