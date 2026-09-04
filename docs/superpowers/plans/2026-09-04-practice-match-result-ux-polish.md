# Practice Match and Result UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix recurring practice-match reservations and make practice offers, school management, and match results clearer and faster to use on mobile.

**Architecture:** Keep the existing weekly scheduling and match simulation models, but make practice reservations single-use and regenerate practice planning when a week advances. UI changes stay within the current Match, School, PracticeMatchPlanning, and BottomSheet surfaces so navigation and persistence contracts remain unchanged.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, CSS, Cloudflare Worker game actions

**Spec:** User feedback in the active PVP development conversation on 2026-09-04.

## Global Constraints

- Keep the existing bottom navigation and Phase 12 player/training behavior unchanged.
- Practice-match reservations must never survive a completed practice match or roll into the next week.
- Match results must state the user perspective explicitly as 勝利 or 敗北.
- The result continuation control must remain reachable without scrolling to the end of the analysis.
- Popup text and destructive/decline actions must have explicit readable foreground/background contrast.
- School management must remain functionally identical while reducing vertical space on mobile.

---

### Task 1: Practice match reservation lifecycle

**Files:**

- Modify: `worker/game/applyGameAction.ts`
- Modify: `src/domain/calendar/academicYearProgression.ts`
- Test: `tests/unit/features/phase13GameLoopPolish.test.tsx`

**Interfaces:**

- Consumes: `applyGameAction(snapshot, action)` and `buildPracticePlanning(state)`.
- Produces: a completed practice match with `scheduledOpponentId=null`, `scheduledBy=null`, plus fresh weekly practice planning after week advancement.

- [ ] **Step 1: Write the failing regression test**

Create a scheduled practice-match snapshot, play it, assert the reservation is cleared, advance the week, and assert no accepted/rejected candidate state carries over.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/unit/features/phase13GameLoopPolish.test.tsx`
Expected: FAIL because the current match action retains the scheduled opponent and weekly planning.

- [ ] **Step 3: Implement the minimal lifecycle fix**

Clear the reservation when recording the practice result. During `advanceGameWeek`, call `buildPracticePlanning` against the next-week state and replace only the practice-planning fields while preserving training/history/report data.

- [ ] **Step 4: Run the regression test and verify GREEN**

Run the same test command and confirm the lifecycle case passes.

### Task 2: Popup and practice-offer contrast

**Files:**

- Modify: `src/ui/ui.css`
- Modify: `src/features/match/PracticeMatchPlanning.tsx`
- Modify: `src/features/match/practice-match-planning.css`
- Test: `tests/unit/features/phase13GameLoopPolish.test.tsx`

**Interfaces:**

- Consumes: `BottomSheet` class names and PracticeMatchPlanning action buttons.
- Produces: explicit dark text on light sheet surfaces and an explicit decline-action visual style.

- [ ] **Step 1: Add failing contrast assertions**

Assert the decline button has a dedicated class and the relevant CSS files contain explicit readable foreground/background rules.

- [ ] **Step 2: Verify RED**

Expected: FAIL because the current BottomSheet inherits foreground color and the decline button has no dedicated class.

- [ ] **Step 3: Add explicit contrast styles**

Set sheet foreground/header colors and a light red decline style with dark red text.

- [ ] **Step 4: Verify GREEN**

Run the focused test.

### Task 3: Compact school header

**Files:**

- Modify: `src/features/school/SchoolScreen.tsx`
- Modify: `src/features/school/school-screen.css`
- Test: `tests/unit/features/phase13GameLoopPolish.test.tsx`

**Interfaces:**

- Consumes: existing school name, reputation, funds, coach, rival, and season data.
- Produces: the same information in a compact hero using a three-column quick-stat row and reduced vertical spacing.

- [ ] **Step 1: Add failing compact-layout assertions**

Assert the school hero exposes the compact class and the stylesheet uses the compact three-column summary layout.

- [ ] **Step 2: Verify RED**

Expected: FAIL because the current hero uses the larger Phase 12 layout.

- [ ] **Step 3: Implement compact hero and spacing**

Retain all data and tabs, reduce hero/panel spacing, use a three-column summary, and shorten facility tile height.

- [ ] **Step 4: Verify GREEN**

Run focused tests and mobile E2E later in the branch verification.

### Task 4: User-centric match result and persistent return action

**Files:**

- Modify: `src/features/match/MatchScreen.tsx`
- Modify: `src/features/match/match.css`
- Test: `tests/unit/features/phase13GameLoopPolish.test.tsx`

**Interfaces:**

- Consumes: `result.analysis.winnerSchoolId`, user school ID, home/away sets, and optional progression presentation names.
- Produces: explicit `勝利`/`敗北`, user-first score labels, and fixed result actions above the bottom navigation.

- [ ] **Step 1: Add failing match-result UX assertions**

Jump to the result and assert the verdict is user-relative, the score contains `あなた`, and the result action bar carries the fixed-action class.

- [ ] **Step 2: Verify RED**

Expected: FAIL because the current screen only names the winning school and places actions at the bottom of the document flow.

- [ ] **Step 3: Implement verdict, user-first score, and fixed actions**

Derive user win/loss independently of home/away side, render a prominent verdict, and fix the action bar above the bottom navigation while adding result-page bottom clearance.

- [ ] **Step 4: Verify GREEN**

Run focused tests.

### Task 5: Full verification and integration

**Files:**

- Verify all changed files and existing regression suites.

**Interfaces:**

- Produces: a branch ready for review and merge.

- [ ] **Step 1: Run formatter**

Run: `npm run format`

- [ ] **Step 2: Run full verification**

Run: `npm run verify`

- [ ] **Step 3: Run mobile E2E**

Run: `npm run test:e2e`

- [ ] **Step 4: Review branch diff**

Confirm no unrelated navigation, training, PvP, or tournament behavior changed.

- [ ] **Step 5: Open PR and require green CI before merge**

Use a dedicated PR from `fix/practice-match-and-result-ux` to `main`; merge only after quality and mobile E2E jobs are green.
