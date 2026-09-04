from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:80]!r}")
    target.write_text(text.replace(old, new, 1))


def append_once(path: str, marker: str, block: str) -> None:
    target = Path(path)
    text = target.read_text()
    if marker in text:
        return
    target.write_text(text.rstrip() + "\n\n" + block.strip() + "\n")


# 1. Practice matches are single-use. Clear the reservation immediately after
# recording the result and add the opponent to recent history so planning can
# avoid repeating the same school too aggressively.
replace_once(
    "worker/game/applyGameAction.ts",
    '''    return {
      state: markWeeklyActionCompleted(recorded, "practice-match"),
      teamSelection,
      outcome: simulation,
    };''',
    '''    const completedState = markWeeklyActionCompleted(
      recorded,
      "practice-match",
    );
    return {
      state: {
        ...completedState,
        weeklySchedule: {
          ...completedState.weeklySchedule,
          practiceMatch: {
            ...completedState.weeklySchedule.practiceMatch,
            scheduledOpponentId: null,
            scheduledBy: null,
          },
          recentPracticeMatches: [
            ...completedState.weeklySchedule.recentPracticeMatches,
            {
              opponentSchoolId: scheduledOpponentId,
              date: state.date,
            },
          ].slice(-8),
        },
      },
      teamSelection,
      outcome: simulation,
    };''',
)

# Rebuild the invitation/candidate board against the new game date every time
# a week is advanced. This prevents accepted/rejected/scheduled state from the
# previous week from leaking forward.
replace_once(
    "src/domain/calendar/academicYearProgression.ts",
    'import { advanceOneWeek, type WeekProgressionResult } from "./weekProgression";',
    '''import { buildPracticePlanning } from "../weekly/practiceMatchPlanning";
import { advanceOneWeek, type WeekProgressionResult } from "./weekProgression";''',
)
replace_once(
    "src/domain/calendar/academicYearProgression.ts",
    '''export function advanceGameWeek(
  state: GameState,
  data: GameDataRegistry,
  options: AcademicYearProgressionOptions = {},
): AdvanceGameWeekResult {
  const weeklyBase = advanceOneWeek(state, {
    restingPlayerIds: options.restingPlayerIds,
  });
  const weekly = {
    ...weeklyBase,
    state: advanceOfficialTournamentsThroughWeek(weeklyBase.state),
  };
  if (!crossesAcademicYear(state.date, weekly.state.date)) {
    return { ...weekly, academicYearTransition: null };
  }

  const random = new SeededRandom(weekly.state.seed, weekly.state.randomCursor);
  const transition = advanceAcademicYear(weekly.state, data, random, options);
  return {
    ...weekly,
    state: transition.state,
    academicYearTransition: transition.summary,
  };
}''',
    '''function refreshPracticePlanning(state: GameState): GameState {
  const planning = buildPracticePlanning(state);
  return {
    ...state,
    weeklySchedule: {
      ...state.weeklySchedule,
      practiceMatch: {
        ...planning,
        scheduledOpponentId: null,
        scheduledBy: null,
      },
    },
  };
}

export function advanceGameWeek(
  state: GameState,
  data: GameDataRegistry,
  options: AcademicYearProgressionOptions = {},
): AdvanceGameWeekResult {
  const weeklyBase = advanceOneWeek(state, {
    restingPlayerIds: options.restingPlayerIds,
  });
  const weeklyState = advanceOfficialTournamentsThroughWeek(weeklyBase.state);
  if (!crossesAcademicYear(state.date, weeklyState.date)) {
    return {
      ...weeklyBase,
      state: refreshPracticePlanning(weeklyState),
      academicYearTransition: null,
    };
  }

  const random = new SeededRandom(weeklyState.seed, weeklyState.randomCursor);
  const transition = advanceAcademicYear(weeklyState, data, random, options);
  return {
    ...weeklyBase,
    state: refreshPracticePlanning(transition.state),
    academicYearTransition: transition.summary,
  };
}''',
)

# 2. Give the decline action its own readable destructive/secondary treatment.
replace_once(
    "src/features/match/PracticeMatchPlanning.tsx",
    '''                  <button
                    disabled={pending}
                    onClick={onDeclineOffer}''',
    '''                  <button
                    className="practice-planning__decline"
                    disabled={pending}
                    onClick={onDeclineOffer}''',
)
append_once(
    "src/features/match/practice-match-planning.css",
    ".practice-planning__decline {",
    '''.practice-planning__decline {
  color: #8b3a2d;
  background: #fff0ec;
  border-color: #efc5ba;
}

.practice-planning__decline:not(:disabled):active {
  background: #fbe0d8;
}''',
)

# Bottom sheets must not inherit white foreground text from whichever game
# surface opened them.
replace_once(
    "src/ui/ui.css",
    '''  overflow: hidden;
  background: #f6f9fa;
  border-radius: 24px 24px 0 0;''',
    '''  overflow: hidden;
  color: #203743;
  background: #f6f9fa;
  border-radius: 24px 24px 0 0;''',
)
replace_once(
    "src/ui/ui.css",
    '''.ui-sheet-header h2 {
  margin: 0;
  font-size: 1.05rem;
}''',
    '''.ui-sheet-header h2 {
  margin: 0;
  color: #163846;
  font-size: 1.05rem;
}''',
)
replace_once(
    "src/ui/ui.css",
    '''.ui-sheet-content {
  max-height: calc(min(82dvh, 720px) - 92px);''',
    '''.ui-sheet-content {
  max-height: calc(min(82dvh, 720px) - 92px);
  color: #203743;''',
)

# 3. Compact the school hero while preserving the same information.
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '      <section className="school-hero">',
    '''      <section
        className="school-hero school-hero--compact"
        data-testid="school-hero"
      >''',
)
replace_once(
    "src/features/school/SchoolScreen.tsx",
    '''                {destinyRival.name}・因縁 {destinyRivalScore}''',
    '''                {destinyRival.shortName}・因縁 {destinyRivalScore}''',
)
append_once(
    "src/features/school/school-screen.css",
    ".school-hero--compact {",
    '''/* Phase 13 compact mobile school header */
.school-screen {
  gap: 10px;
  padding-top: 12px;
}

.school-hero--compact {
  padding: 12px 14px;
  background:
    radial-gradient(circle at 88% 12%, rgb(244 187 77 / 20%), transparent 30%),
    linear-gradient(145deg, rgb(42 103 116 / 94%), rgb(20 51 66 / 98%)),
    #163644;
  border-radius: 18px;
}

.school-hero--compact .school-hero__heading {
  margin-top: 2px;
  gap: 8px;
}

.school-hero--compact .school-hero__heading h2 {
  font-size: 1.1rem;
  line-height: 1.2;
}

.school-hero--compact .school-hero__heading p {
  margin-top: 2px;
  font-size: 0.65rem;
}

.school-hero--compact .school-hero__heading > strong {
  padding: 5px 8px;
  font-size: 0.7rem;
}

.school-summary-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 8px;
  gap: 6px;
}

.school-hero--compact .school-summary-grid span {
  padding: 7px 6px;
  gap: 2px;
  font-size: 0.58rem;
  line-height: 1.25;
  border-radius: 10px;
}

.school-hero--compact .school-summary-grid strong {
  font-size: 0.68rem;
  line-height: 1.25;
}

.school-segments button {
  min-height: 38px;
  padding: 6px;
}

.school-panel {
  padding: 13px;
  border-radius: 17px;
}

.school-section-heading h3 {
  font-size: 0.92rem;
}

.facility-grid {
  margin-top: 8px;
  gap: 6px;
}

.facility-tile {
  min-height: 62px;
  padding: 8px 9px;
}''',
)

# 4/5. Express the result from the user's perspective and keep the primary
# continuation action visible above the fixed bottom navigation.
replace_once(
    "src/features/match/MatchScreen.tsx",
    '''  const homeShortName =
    presentation?.homeTeam.shortName ?? homeSchool.shortName;
  const awayShortName = presentation?.awayTeam.shortName ?? opponent.shortName;
  const recentEvents = presentedEvents.slice(-4).reverse();''',
    '''  const homeShortName =
    presentation?.homeTeam.shortName ?? homeSchool.shortName;
  const awayShortName = presentation?.awayTeam.shortName ?? opponent.shortName;
  const userIsHome = result.match.homeSchoolId === state.userSchoolId;
  const userWon = result.analysis.winnerSchoolId === state.userSchoolId;
  const userShortName = userIsHome ? homeShortName : awayShortName;
  const opponentShortName = userIsHome ? awayShortName : homeShortName;
  const userSetsWon = userIsHome
    ? result.match.homeSetsWon
    : result.match.awaySetsWon;
  const opponentSetsWon = userIsHome
    ? result.match.awaySetsWon
    : result.match.homeSetsWon;
  const recentEvents = presentedEvents.slice(-4).reverse();''',
)
replace_once(
    "src/features/match/MatchScreen.tsx",
    '''  return (
    <main className="app-content match-screen">
      {!matchComplete ? (''',
    '''  return (
    <main
      className={`app-content match-screen${matchComplete ? " match-screen--result" : ""}`}
    >
      {!matchComplete ? (''',
)
replace_once(
    "src/features/match/MatchScreen.tsx",
    '''          <section
            className="match-result-hero"
            aria-labelledby="result-heading"
          >
            <p className="section-kicker">試合終了</p>
            <h2 id="result-heading">試合結果</h2>
            <strong>{winnerDisplayName} 勝利</strong>
            <div className="match-result-score">
              <span>{homeShortName}</span>
              <b>
                {result.match.homeSetsWon} - {result.match.awaySetsWon}
              </b>
              <span>{awayShortName}</span>
            </div>
            <p>{summarizeSetScore(result.match).split("｜")[1]}</p>
          </section>''',
    '''          <section
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
          </section>''',
)
replace_once(
    "src/features/match/MatchScreen.tsx",
    '          <section className="match-result-actions">',
    '''          <section
            className="match-result-actions match-result-actions--fixed"
            data-testid="match-result-actions"
          >''',
)
append_once(
    "src/features/match/match.css",
    ".match-result-actions--fixed {",
    '''/* Phase 13 result clarity and no-scroll continuation */
.match-screen--result {
  padding-bottom: calc(
    112px + var(--bottom-navigation-height, 70px) +
      var(--bottom-navigation-offset, 0px)
  );
}

.match-result-hero--win {
  background:
    radial-gradient(circle at 88% 18%, rgb(244 187 77 / 25%), transparent 34%),
    linear-gradient(145deg, #196347, #123c43);
}

.match-result-hero--loss {
  background:
    radial-gradient(circle at 88% 18%, rgb(255 191 145 / 18%), transparent 34%),
    linear-gradient(145deg, #783f47, #3f2836);
}

.match-result-verdict {
  display: block;
  margin: 10px 0 3px;
  color: #fff;
  font-size: clamp(2rem, 10vw, 3rem);
  font-weight: 950;
  line-height: 1;
  letter-spacing: 0.08em;
}

.match-result-winner {
  margin: 5px 0 0;
  color: rgb(255 255 255 / 78%);
  font-size: 0.7rem;
  font-weight: 800;
}

.match-result-score span {
  display: grid;
  gap: 2px;
  white-space: normal;
}

.match-result-score span small {
  color: #bcd3d8;
  font-size: 0.58rem;
  font-weight: 800;
}

.match-result-score span strong {
  overflow-wrap: anywhere;
  color: #fff;
  font-size: 0.78rem;
}

.match-result-actions--fixed {
  position: fixed;
  z-index: 29;
  left: 50%;
  bottom: calc(
    var(--bottom-navigation-height, 70px) +
      var(--bottom-navigation-offset, 0px) + 8px
  );
  width: min(calc(100% - 28px), 452px);
  margin: 0;
  padding: 10px;
  transform: translateX(-50%);
  background: rgb(255 255 255 / 97%);
  box-shadow: 0 10px 30px rgb(17 40 52 / 20%);
  backdrop-filter: blur(16px);
}''',
)

print("Phase 13 game-loop polish patch applied")
