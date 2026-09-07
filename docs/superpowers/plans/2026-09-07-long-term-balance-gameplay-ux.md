# Long-term Balance and Gameplay UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix repetitive practice-match offers, runaway player growth, lagging CPU-school progression, facility-upgrade interaction blocking, and scouting candidate exclusion UX.

**Architecture:** Keep all gameplay changes deterministic from saved state. Practice-offer variety stays seeded by game date and history; long-term growth uses player potential and a high-ability soft cap; rival schools use bounded Lv.50-aware annual progression; facility upgrades keep the server authoritative but use a non-blocking inline pending presentation; scouting exclusions are local per recruiting cycle because they are presentation state rather than authoritative recruitment state.

**Tech Stack:** TypeScript, React, Vitest, Cloudflare Worker authoritative game actions.

**Spec:** User-approved behavior in the 2026-09-07 PVP gameplay review.

## Global Constraints

- Preserve deterministic replay and `randomCursor` semantics.
- Do not remove server-authoritative facility writes.
- Do not allow ordinary players to trivially reach all-100 abilities within two seasons.
- CPU schools must progress without instantly matching the user's facility investments.
- Scouting exclusions must be reversible and reset for a new recruiting cycle.

---

### Task 1: Practice-match variety

**Files:**
- Modify: `src/domain/weekly/practiceMatchPlanning.ts`
- Test: `tests/unit/domain/weekly/practiceMatchPlanning.test.ts`

- [ ] Add a failing test proving incoming offers rotate among similarly suitable schools and avoid the most recent opponent when alternatives exist.
- [ ] Update seeded incoming selection to choose from a small closest-fit pool with recent-opponent penalties.
- [ ] Run focused tests and commit.

### Task 2: Long-term user-player growth cap

**Files:**
- Modify: `src/domain/training/resolveWeeklyTraining.ts`
- Test: `tests/unit/domain/training/resolveWeeklyTraining.test.ts` or closest existing focused training test.

- [ ] Add a failing test proving high abilities grow progressively slower and growth respects `potential`.
- [ ] Apply a per-ability soft cap after normal growth calculation: normal growth below 80, reduced growth in the 80s, very small growth in the 90s, and potential-based ceiling pressure.
- [ ] Keep elite/generational talent capable of reaching the high 90s.
- [ ] Run focused tests and commit.

### Task 3: Rival-world progression for Lv.50 era

**Files:**
- Modify: `src/domain/world/rivalWorldProgression.ts`
- Test: `tests/unit/domain/world/rivalWorldProgression.test.ts`

- [ ] Add failing coverage for annual CPU facility progression above Lv.5 while remaining bounded at Lv.50.
- [ ] Rebalance rival development formulas so facility levels no longer explode player growth when levels exceed 5.
- [ ] Scale strong-school facility growth gradually based on performance/reputation and cap at Lv.50.
- [ ] Run focused tests and commit.

### Task 4: Non-blocking facility upgrades

**Files:**
- Modify: `src/app/useGameSession.ts`
- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/school/SchoolScreen.tsx`
- Modify: `src/ui/shell/GamePageFrame.tsx` and/or operation overlay presentation
- Test: relevant app/school UI tests

- [ ] Add failing UI coverage that facility actions do not display the full-screen blocking overlay.
- [ ] Keep the global operation status visible but suppress the blocking overlay for facility-upgrade submissions.
- [ ] Keep the facility detail sheet open after a successful upgrade and show inline pending/success state.
- [ ] Prevent duplicate facility requests while one facility upgrade is pending.
- [ ] Run focused UI tests and commit.

### Task 5: Scouting exclusions

**Files:**
- Modify: `src/features/scouting/ScoutingScreen.tsx`
- Modify: `src/features/scouting/scouting.css`
- Test: `tests/unit/features/scouting/ScoutingScreen.test.tsx`

- [ ] Add failing UI coverage for `対象外`, hidden candidates, count display, and `候補に戻す`.
- [ ] Store excluded candidate IDs under a localStorage key scoped to recruiting cycle.
- [ ] Render active candidates normally and excluded candidates inside a collapsible section.
- [ ] Reset automatically when the cycle key changes.
- [ ] Run focused UI tests and commit.

### Task 6: Verification and integration

- [ ] Run format, lint, typecheck, focused tests, full unit/integration suite, production build, and mobile E2E.
- [ ] Review PR diff for accidental balance regressions and stale loading text.
- [ ] Mark PR ready only after CI is green.
- [ ] Merge with the exact verified head SHA.
- [ ] Verify the resulting `main` commit and its CI run are green.
