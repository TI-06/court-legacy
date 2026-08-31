from pathlib import Path
import subprocess


def run(*args: str, check: bool = True):
    return subprocess.run(args, check=check)


def add_red_test() -> None:
    p = Path("tests/unit/features/match/MatchFlow.test.tsx")
    text = p.read_text()
    marker = '  it("plays and pauses without changing the calculated result", () => {'
    test = '''  it("uses progression presentation names and continues weekly progression", () => {
    const fixture = createMatchFixture();
    const onContinue = vi.fn();
    render(
      <MatchScreen
        {...fixture}
        onReturnHome={onContinue}
        onStart={vi.fn()}
        presentation={{
          kind: "official",
          simulation: fixture.result,
          homeTeam: {
            schoolId: fixture.result.match.homeSchoolId,
            displayName: "青葉高校",
            shortName: "青葉",
          },
          awayTeam: {
            schoolId: fixture.result.match.awaySchoolId,
            displayName: "全国ゲスト代表",
            shortName: "ゲスト",
          },
          official: {
            tournamentId: "official:test",
            circuit: "interhigh",
            level: "national",
            round: "round-of-16",
          },
        }}
        reducedMotion={false}
        result={fixture.result}
      />,
    );
    expect(screen.getByText("ゲスト")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "結果まで進む" }));
    fireEvent.click(
      screen.getByRole("button", { name: "結果を確認して次へ" }),
    );
    expect(onContinue).toHaveBeenCalledOnce();
  });

'''
    if marker not in text:
        raise RuntimeError("match test marker missing")
    p.write_text(text.replace(marker, test + marker))


def implement_match_presentation() -> None:
    p = Path("src/features/match/matchPresentation.ts")
    text = p.read_text()
    text = text.replace(
        'export interface MatchPresentationContext {\n  state: GameState;\n  match: MatchState;\n}',
        'export interface MatchPresentationContext {\n  state: GameState;\n  match: MatchState;\n  schoolDisplayNames?: Partial<Record<SchoolId, string>>;\n}',
    )
    text = text.replace(
        'function schoolName(state: GameState, schoolId: SchoolId | null): string {\n  if (!schoolId) {\n    return "チーム";\n  }\n  return state.schools[schoolId]?.name ?? "チーム";\n}',
        'function schoolName(context: MatchPresentationContext, schoolId: SchoolId | null): string {\n  if (!schoolId) return "チーム";\n  return context.schoolDisplayNames?.[schoolId] ?? context.state.schools[schoolId]?.name ?? "チーム";\n}',
    )
    text = text.replace(
        "  const winner = schoolName(context.state, event.winnerSchoolId);",
        "  const winner = schoolName(context, event.winnerSchoolId);",
    )
    p.write_text(text)

    p = Path("src/features/match/MatchScreen.tsx")
    text = p.read_text()
    text = text.replace(
        'import type { SimulateMatchResult } from "../../domain/match/simulateMatch";',
        'import type { SimulateMatchResult } from "../../domain/match/simulateMatch";\nimport type { PendingMatchPresentation } from "../../domain/calendar/advanceWeekOutcome";',
    )
    text = text.replace(
        "  result: SimulateMatchResult | null;\n  reducedMotion: boolean;",
        "  result: SimulateMatchResult | null;\n  presentation?: PendingMatchPresentation | null;\n  reducedMotion: boolean;",
    )
    text = text.replace(
        '  const playbackKey = props.result?.match.id ?? "pre-match";',
        '  const playbackKey = props.presentation?.simulation.match.id ?? props.result?.match.id ?? "pre-match";',
    )
    text = text.replace(
        "  result,\n  reducedMotion,",
        "  result: legacyResult,\n  presentation,\n  reducedMotion,",
    )
    anchor = '  const [speed, setSpeed] = useState<PlaybackSpeed>(1);\n  const homeSchool = state.schools[state.userSchoolId];'
    if anchor not in text:
        raise RuntimeError("match speed anchor missing")
    text = text.replace(
        anchor,
        '  const [speed, setSpeed] = useState<PlaybackSpeed>(1);\n  const result = presentation?.simulation ?? legacyResult;\n  const homeSchool = state.schools[state.userSchoolId];',
    )
    old = '''  const homeIssues = validateTeamSelection({
    state,
    schoolId: state.userSchoolId,
    selection: homeSelection,
  });
  const awayIssues = validateTeamSelection({
    state,
    schoolId: opponent.id,
    selection: awaySelection,
  });'''
    new = '''  const homeIssues = result
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
      });'''
    if old not in text:
        raise RuntimeError("validation anchor missing")
    text = text.replace(old, new)
    old = '''    return result.match.eventLog
      .slice(0, visibleEventIndex + 1)
      .map((event) => presentMatchEvent(event, { state, match: result.match }));'''
    new = '''    const schoolDisplayNames = presentation
      ? {
          [presentation.homeTeam.schoolId]: presentation.homeTeam.displayName,
          [presentation.awayTeam.schoolId]: presentation.awayTeam.displayName,
        }
      : undefined;
    return result.match.eventLog
      .slice(0, visibleEventIndex + 1)
      .map((event) =>
        presentMatchEvent(event, {
          state,
          match: result.match,
          schoolDisplayNames,
        }),
      );'''
    if old not in text:
        raise RuntimeError("event presentation anchor missing")
    text = text.replace(old, new)
    text = text.replace(
        "  }, [result, state, visibleEventIndex]);",
        "  }, [presentation, result, state, visibleEventIndex]);",
    )
    old = '''  const winner = state.schools[result.analysis.winnerSchoolId];
  const recentEvents = presentedEvents.slice(-4).reverse();

  if (!currentEvent || !winner) {
    throw new Error("completed match is missing presentation data");
  }'''
    new = '''  const winnerDisplayName =
    presentation?.homeTeam.schoolId === result.analysis.winnerSchoolId
      ? presentation.homeTeam.displayName
      : presentation?.awayTeam.schoolId === result.analysis.winnerSchoolId
        ? presentation.awayTeam.displayName
        : state.schools[result.analysis.winnerSchoolId]?.name;
  const homeShortName = presentation?.homeTeam.shortName ?? homeSchool.shortName;
  const awayShortName = presentation?.awayTeam.shortName ?? opponent.shortName;
  const recentEvents = presentedEvents.slice(-4).reverse();

  if (!currentEvent || !winnerDisplayName) {
    throw new Error("completed match is missing presentation data");
  }'''
    if old not in text:
        raise RuntimeError("winner anchor missing")
    text = text.replace(old, new)
    text = text.replace("{homeSchool.shortName}", "{homeShortName}")
    text = text.replace("{opponent.shortName}", "{awayShortName}")
    text = text.replace("{winner.name} 勝利", "{winnerDisplayName} 勝利")
    text = text.replace(
        '            <button onClick={onReturnHome} type="button">\n              ホームへ戻る\n            </button>',
        '            <button onClick={onReturnHome} type="button">\n              {presentation ? "結果を確認して次へ" : "ホームへ戻る"}\n            </button>',
    )
    p.write_text(text)


def implement_game_app() -> None:
    p = Path("src/app/GameApp.tsx")
    text = p.read_text()
    text = text.replace(
        'import type { AcademicYearTransitionSummary } from "../domain/calendar/academicYearProgression";\n',
        'import type { AcademicYearTransitionSummary } from "../domain/calendar/academicYearProgression";\nimport type { AdvanceWeekOutcome, PendingMatchPresentation } from "../domain/calendar/advanceWeekOutcome";\n',
    )
    start = text.index("interface AdvanceWeekOutcome {")
    end = text.index("\n}\n", start) + 3
    text = text[:start] + text[end:]
    anchor = '  const [activeMatchResult, setActiveMatchResult] =\n    useState<SimulateMatchResult | null>(null);'
    if anchor not in text:
        raise RuntimeError("active match state anchor missing")
    text = text.replace(
        anchor,
        anchor
        + '\n  const [activeMatchPresentation, setActiveMatchPresentation] =\n    useState<PendingMatchPresentation | null>(null);',
    )
    text = text.replace(
        "setActiveMatchResult(null);\n      setOfficialTournamentView(null);",
        "setActiveMatchResult(null);\n      setActiveMatchPresentation(null);\n      setOfficialTournamentView(null);",
    )
    text = text.replace(
        "setActiveMatchResult(null);\n    setOfficialTournamentView({",
        "setActiveMatchResult(null);\n    setActiveMatchPresentation(null);\n    setOfficialTournamentView({",
    )
    old = '''    const outcome = response.outcome as AdvanceWeekOutcome | undefined;
    setLatestYearTransition(outcome?.academicYearTransition ?? null);
    setActiveMatchResult(null);
    setMatchView("practice");
    setPvpResult(null);
    setCalendarOpen(false);

    if (outcome?.officialMatchRequired) {
      const nextOfficial = selectNextOfficialEvent(response.game.state);
      if (nextOfficial) {
        setOfficialTournamentView({
          circuit: nextOfficial.circuit,
          level: nextOfficial.level,
        });
        setActiveTab("match");
        return;
      }
    }

    setOfficialTournamentView(null);
    setActiveTab("home");'''
    new = '''    const outcome = response.outcome as AdvanceWeekOutcome | undefined;
    setLatestYearTransition(outcome?.academicYearTransition ?? null);
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
    setActiveTab("home");'''
    if old not in text:
        raise RuntimeError("advance week anchor missing")
    text = text.replace(old, new)
    text = text.replace(
        "!activeMatchResult ? (",
        "!activeMatchResult && !activeMatchPresentation ? (",
    )
    text = text.replace(
        '!activeMatchResult ? <MatchPvpEntry onOpen={openPvp} /> : null',
        '!activeMatchResult && !activeMatchPresentation ? (\n          <MatchPvpEntry onOpen={openPvp} />\n        ) : null',
    )
    old = '''          onReturnHome={() => changeTab("home")}
          onStart={startPracticeMatch}
          opponent={opponent}
          reducedMotion={gameState.settings.reducedMotion}
          result={activeMatchResult}'''
    new = '''          onReturnHome={() => {
            if (activeMatchPresentation) void advanceWeek();
            else changeTab("home");
          }}
          onStart={startPracticeMatch}
          opponent={opponent}
          presentation={activeMatchPresentation}
          reducedMotion={gameState.settings.reducedMotion}
          result={activeMatchPresentation?.simulation ?? activeMatchResult}'''
    if old not in text:
        raise RuntimeError("match render anchor missing")
    text = text.replace(old, new)
    p.write_text(text)


add_red_test()
run("npx", "prettier", "--write", "tests/unit/features/match/MatchFlow.test.tsx")
red = run("npm", "test", "--", "tests/unit/features/match/MatchFlow.test.tsx", check=False)
if red.returncode == 0:
    raise SystemExit("Task2 RED unexpectedly passed")
print("Task2 RED confirmed")
implement_match_presentation()
implement_game_app()
run(
    "npx",
    "prettier",
    "--write",
    "src/features/match/matchPresentation.ts",
    "src/features/match/MatchScreen.tsx",
    "src/app/GameApp.tsx",
    "tests/unit/features/match/MatchFlow.test.tsx",
)
run(
    "npm",
    "test",
    "--",
    "tests/unit/features/match/MatchFlow.test.tsx",
    "tests/unit/features/match/AppMatchFlow.test.tsx",
)
run("npm", "run", "typecheck")
