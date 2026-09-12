# Phase 17 Season Goals & Ranking UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the authoritative Phase 17 season goals and derived school rankings in Home and School > 記録 without adding new navigation tabs or persisted ranking state.

**Architecture:** Add a shared presentation selector that derives current goal progress, current regional/national ranking, season-start movement, and a deterministic nearby-school window from the PR17-1 domain APIs. Home consumes a compact subset through `HomeCommandCenterModel`; School > 記録 consumes the full ranking presentation. Home links to the existing School records view.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing CSS design tokens.

**Spec:** `docs/superpowers/plans/2026-09-12-phase17-season-goals-rankings.md`

## Global Constraints

- Keep save schema at version 8; PR17-2 adds no persisted fields.
- Rankings remain derived from `buildSchoolRankings` / `schoolRankingSnapshot`.
- Movement is current rank versus persisted season-start rank; positive means rank improved.
- Do not add a sixth School tab or a new bottom-navigation tab.
- Keep School > 記録 as the detailed ranking surface.
- Verify 320, 360, 390, 414, and 480 pixel widths through the existing mobile E2E gate.
- Season-end result presentation remains PR17-3 and is out of scope here.

---

### Task 1: Shared season progress presentation

**Files:**
- Create: `src/features/season/seasonProgressPresentation.ts`
- Create: `tests/unit/features/season/seasonProgressPresentation.test.ts`

**Interfaces:**
- Consumes: `GameState`, `evaluateSeasonGoals`, `buildSchoolRankings`.
- Produces: `buildSeasonProgressPresentation(state: GameState): SeasonProgressPresentation | null`.
- `SeasonProgressPresentation` exposes `academicYear`, `achievedCount`, `goalCount`, `goals`, `regional`, and `national`.
- Ranking presentations expose current `rank`, `total`, `startingRank`, signed `movement`, and five-or-fewer deterministic nearby rows with `isUserSchool`.

- [ ] **Step 1: Write the failing presentation test**

Create a test from `createDemoGame()` that asserts all three goal labels/progress values, current regional/national ranks, movement from `seasonGoals.startingRanks`, and nearby rows containing the user school.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/features/season/seasonProgressPresentation.test.ts`
Expected: FAIL because `seasonProgressPresentation` does not exist.

- [ ] **Step 3: Implement the minimal selector**

Use `evaluateSeasonGoals(state, state.seasonGoals)` for current progress and `buildSchoolRankings` for nearby regional/national rows. Return `null` for legacy/current states without `seasonGoals`; do not create or persist fallback goals in the selector.

Goal labels:
- `regional-rank`: `県内{target}位以内`
- `official-wins`: `公式戦{target}勝`
- `tournament-achievement/prefectural-title`: `県大会優勝`
- `tournament-achievement/national-appearance`: `全国大会出場`
- `tournament-achievement/national-title`: `全国大会優勝`

Progress labels:
- regional rank: `現在 {progress}位`
- official wins: `{progress}/{target}勝`
- tournament achievement: `達成` / `未達成`

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `npm test -- --run tests/unit/features/season/seasonProgressPresentation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add season progress presentation`

---

### Task 2: Home compact season-goal card

**Files:**
- Modify: `src/features/home/homeCommandCenter.ts`
- Modify: `src/features/home/HomeCommandCenter.tsx`
- Modify: `src/features/home/home-command-center.css`
- Modify: `src/app/GameApp.tsx`
- Test: `tests/unit/features/home/homeCommandCenter.test.ts`
- Test: `tests/unit/features/home/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `buildSeasonProgressPresentation` from Task 1.
- Produces: `HomeSummary.season`, a compact view containing primary goal, achieved/total goal count, regional/national ranks, and movement.
- Extends `HomeCommandAction` school view to `"facilities" | "staff" | "records"`.

- [ ] **Step 1: Write failing selector/UI tests**

Assert Home summary exposes current Phase17 season data and the rendered card contains `今季目標`, the primary goal, `県内`, `全国`, and a `記録を見る` action that dispatches `{ target: "school", view: "records" }`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run tests/unit/features/home/homeCommandCenter.test.ts tests/unit/features/home/HomeScreen.test.tsx`
Expected: FAIL because `HomeSummary.season` and the card do not exist.

- [ ] **Step 3: Implement compact Home presentation**

Add the compact season data in `buildSummary`, render it immediately after the official competition card, and route the action through the existing `requestSchoolView` handling in `GameApp`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- --run tests/unit/features/home/homeCommandCenter.test.ts tests/unit/features/home/HomeScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: show season goals on home`

---

### Task 3: School records ranking dashboard

**Files:**
- Modify: `src/features/school/SchoolScreen.tsx`
- Modify: `src/features/school/school-screen.css`
- Test: `tests/unit/features/school/SchoolScreen.test.tsx`

**Interfaces:**
- Consumes: full `SeasonProgressPresentation` from Task 1.
- Produces: a game-style `今季ランキング` section inside the existing `records` view, before career record totals.

- [ ] **Step 1: Write the failing School records test**

Switch to `記録` and assert the screen shows all three season goals, regional and national current/start/movement values, nearby school rows for both scopes, and a visual/test marker on the user-school row.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/features/school/SchoolScreen.test.tsx`
Expected: FAIL because the ranking dashboard is absent.

- [ ] **Step 3: Implement ranking dashboard**

Build the presentation once with `useMemo`, render goal progress and two compact ranking cards, and use dedicated CSS classes with no table layout. The nearby list is limited by the selector to keep 320px layouts compact.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `npm test -- --run tests/unit/features/school/SchoolScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add school ranking dashboard`

---

### Task 4: Verification and integration review

**Files:**
- Modify only files required by findings from verification/review.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: PR17-2 ready for merge with no Phase16/PR17-1 regression.

- [ ] **Step 1: Run Phase17/UI focused tests**

Run all new/changed unit tests.
Expected: PASS.

- [ ] **Step 2: Run full verification**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 3: Run relevant mobile E2E**

Run the repository mobile E2E workflow and confirm 320, 360, 390, 414, and 480 widths have no horizontal overflow and the Home/School ranking surfaces remain usable.
Expected: PASS.

- [ ] **Step 4: Review final diff**

Confirm no persistence changes, no new nav tab, deterministic ranking derivation, and no year-transition presentation leaked in from PR17-3.

- [ ] **Step 5: Commit any review fixes**

Use a focused `fix:` commit only if verification or review identifies an issue.