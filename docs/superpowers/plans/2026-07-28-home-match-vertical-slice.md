# Home and Match Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing deterministic match engine to a smartphone-first home → match preparation → event playback → result analysis flow.

**Architecture:** Keep match outcome calculation entirely inside `simulateMatch`. React receives the completed `MatchState` and `MatchAnalysis`, then reveals the immutable event log as a playback timeline. The home screen only routes to existing actions and derives summaries from real `GameState` data.

**Tech Stack:** React 19, TypeScript 5.9, existing pure TypeScript domain, Vitest, Testing Library, Playwright, GitHub Actions.

## Global Constraints

- Smartphone portrait first; verify 360×800 and 390×844 without horizontal overflow.
- No match outcome logic inside React components.
- Playback speed, pause, step, and instant result must never change the simulated result.
- Match arithmetic displayed to users uses integers.
- No timing-action gameplay.
- Existing team selection and seeded match simulation APIs remain compatible.
- Every change must pass format, lint, type-check, unit tests, production build, and mobile E2E.

---

## File Map

- Create `src/domain/selectors/matchSelectors.ts`: deterministic rival selection and team-strength summary.
- Create `src/features/match/matchPresentation.ts`: pure Japanese presentation mapping for immutable `MatchEvent` values.
- Create `src/features/match/MatchScreen.tsx`: preparation, playback, and result UI.
- Create `src/features/match/match.css`: phone-first match layout.
- Modify `src/features/home/HomeScreen.tsx`: real date, action cards, next opponent, latest-result summary.
- Create `src/features/home/home.css`: direct-action home layout.
- Modify `src/App.tsx`: orchestrate simulation and route actions.
- Create/modify unit and E2E tests listed below.

---

### Task 1: Deterministic Opponent and Strength Selectors

**Files:**

- Create: `src/domain/selectors/matchSelectors.ts`
- Test: `tests/unit/domain/selectors/matchSelectors.test.ts`

**Interfaces:**

- Produces: `selectPracticeOpponent(state: GameState): School`
- Produces: `calculateSelectionStrength(state: GameState, selection: TeamSelection): number`

- [ ] Write a failing test proving the user school is never selected as its own opponent and the same state returns the same rival.
- [ ] Write a failing test proving selection strength is an integer and decreases when active-player fatigue is raised.
- [ ] Run the focused test and confirm failure because the selector module does not exist.
- [ ] Implement deterministic selection using sorted non-user schools and a stable index derived from `yearIndex` and date text.
- [ ] Implement strength using the six rotation players plus libero, ability averages, condition, fatigue, and injury penalty.
- [ ] Run the focused tests and full domain suite.
- [ ] Commit: `feat: add deterministic match selectors`.

### Task 2: Match Event Presentation Mapper

**Files:**

- Create: `src/features/match/matchPresentation.ts`
- Test: `tests/unit/features/match/matchPresentation.test.ts`

**Interfaces:**

- Produces: `presentMatchEvent(event, context): PresentedMatchEvent`
- Produces: `summarizeSetScore(match): string`

```ts
export interface MatchPresentationContext {
  state: GameState;
  match: MatchState;
}

export interface PresentedMatchEvent {
  sequence: number;
  title: string;
  detail: string;
  tone: "neutral" | "home" | "away" | "important";
  score: string;
}
```

- [ ] Write failing tests for serve, attack point, rotation, set end, and match end Japanese copy.
- [ ] Write a failing test proving missing player references fall back safely instead of throwing.
- [ ] Run the focused test and confirm the mapper is missing.
- [ ] Implement a pure mapping keyed by event type and `detailCode`; do not calculate match outcomes.
- [ ] Run focused and full unit tests.
- [ ] Commit: `feat: add match event presentation mapper`.

### Task 3: Home Action Dashboard

**Files:**

- Modify: `src/features/home/HomeScreen.tsx`
- Create: `src/features/home/home.css`
- Test: `tests/unit/features/home/HomeScreen.test.tsx`

**Interfaces:**

- `HomeScreen` receives `opponent`, optional `latestMatch`, `onOpenTraining`, `onOpenTeam`, and `onOpenMatch`.

- [ ] Write failing tests for real date rendering, three direct action buttons, rival school display, and latest-match summary.
- [ ] Run the focused test and confirm old fixed copy fails.
- [ ] Replace the single form-like focus card with training, lineup, and practice-match action cards.
- [ ] Derive fatigue, injuries, roster, reputation, and recent result from props/state only.
- [ ] Keep cards usable at 360px with no nested dropdowns.
- [ ] Run focused tests.
- [ ] Commit: `feat: turn home into action dashboard`.

### Task 4: Match Preparation, Playback, and Result Screen

**Files:**

- Create: `src/features/match/MatchScreen.tsx`
- Create: `src/features/match/match.css`
- Test: `tests/unit/features/match/MatchFlow.test.tsx`

**Interfaces:**

- Preparation props include both schools, both selections, integer strength values, and `onStart`.
- Playback consumes a completed immutable `SimulateMatchResult`.
- Result view exposes principal factors, recommendations, replay, and return-home actions.

- [ ] Write a failing test for preparation strength comparison and start action.
- [ ] Write a failing test proving the initial playback reveals only the opening event.
- [ ] Write failing tests for next-event, play/pause, 1×/2×/4×, instant result, set score, and result analysis.
- [ ] Write a failing test proving changing playback speed does not alter the final score or event log.
- [ ] Implement preparation cards and legal-lineup warning.
- [ ] Implement event-index playback over the already completed event log; timers only advance the visible index.
- [ ] Implement text-first court visualization using the current score, server, latest event, and team names.
- [ ] Implement result cards for winner, set scores, three factors, and three recommendations.
- [ ] Respect reduced-motion by disabling automatic animation transitions while preserving controls.
- [ ] Run focused tests.
- [ ] Commit: `feat: add playable match screen`.

### Task 5: App Integration and Mobile E2E

**Files:**

- Modify: `src/App.tsx`
- Modify: `tests/e2e/app-shell.spec.ts`
- Create: `tests/e2e/home-match-flow.spec.ts`

**Interfaces:**

- `App` owns `latestMatchResult` and creates a fresh deterministic random source from current state cursor.
- `simulateMatch` receives the user selection and an automatically selected legal rival lineup.

- [ ] Write failing integration tests opening match from home and bottom navigation.
- [ ] Write failing E2E covering start, event playback, instant result, analysis, return home, and no horizontal overflow at 360px/390px.
- [ ] Remove the match placeholder and connect `MatchScreen`.
- [ ] Generate a deterministic match id and rival selection without mutating game state.
- [ ] Preserve the completed result when switching tabs so the user can reopen it.
- [ ] Run format, lint, type-check, all unit tests, production build, and mobile E2E.
- [ ] Perform code review for domain/UI separation, timer cleanup, focus behavior, and accessible names.
- [ ] Commit: `feat: connect home and match vertical slice`.

## Acceptance

- From Home, a user can open team preparation, training, or a practice match in one tap.
- The match tab shows the selected rival and both integer strength estimates.
- Starting a match uses the existing seeded engine exactly once.
- The user can pause, step, change speed, or skip to result without changing the final match.
- The result shows set scores, main causes, and concrete recommendations.
- Returning to Home shows the latest match result.
- All required CI and mobile E2E checks pass.
