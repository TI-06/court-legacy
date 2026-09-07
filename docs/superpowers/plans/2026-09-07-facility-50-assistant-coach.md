# Facility Lv.50 + Assistant Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the approved school-management slice by raising all facilities to Lv.50 and adding one school-year assistant-coach contract that affects training.

**Architecture:** Keep facility spending inside the existing authoritative `facility-upgrade` game action. Add a focused assistant-coach domain module for catalog/evaluation/contract mutation and expose it through a new authoritative `assistant-coach-contract` action. Training consumes facility and assistant-coach modifiers from state; school UI only presents/evaluates and submits actions.

**Tech Stack:** Node 22.16.0, TypeScript 5.9, React 19, Vite 7, Vitest 4, Testing Library, Playwright, Zod 4.4.3, Cloudflare Worker.

**Spec:** Approved school-economy design from PR #55 (`docs/superpowers/specs/2026-09-06-school-economy-design.md` on `docs/economy-system-design`).

## Global Constraints

- Facilities use `FACILITY_MAX_LEVEL = 50`.
- Upgrade cost is `Math.round(baseCost * (1 + currentLevel * 0.06))`.
- Existing saves keep facility levels unchanged.
- UI displays `Lv.X / 50`, next cost, progress, and milestone context.
- Assistant coach ranks/costs: beginner 80, intermediate 200, advanced 450, master 900.
- Beginner specialty is null. Intermediate/advanced/master require attack/defense/physical.
- General training modifiers: +5%, +8%, +12%, +18%.
- Specialty modifiers: +14%, +22%, +30% for intermediate/advanced/master.
- Only one active assistant coach. A replacement within the same year is allowed with no refund.
- A contract only applies when `contractYearIndex === state.yearIndex`; year transition clears the contract.
- Every coach payment appends an `assistant-coach` funds-ledger entry atomically.
- Funds may never become negative.
- Game actions remain server-authoritative and revision/idempotency semantics are unchanged.

---

### Task 1: Facility progression to Lv.50

**Files:**
- Modify: `tests/unit/domain/school/facilityUpgrade.test.ts`
- Modify: `src/domain/school/facilityUpgrade.ts`
- Modify: `src/domain/training/calculateGrowth.ts`
- Modify: `tests/unit/domain/training/calculateGrowth.test.ts`
- Modify: `src/features/school/SchoolScreen.tsx`

**Interfaces:**
- Produces `FACILITY_MAX_LEVEL = 50`.
- Produces `facilityMilestone(level)` presentation helper.
- Keeps `evaluateFacilityUpgrade` / `upgradeFacility` public API stable.

- [ ] Write RED tests for Lv.49 -> 50, Lv.50 max, Lv.51 invalid, and approved cost formula.
- [ ] Write RED growth test proving training-room Lv.50 remains capped/sane and no old `level * 8` explosion exists.
- [ ] Run focused tests and confirm expected RED failures.
- [ ] Implement max level/cost formula and facility progression helpers.
- [ ] Update SchoolScreen facility copy to `最大 Lv.50`, `Lv.X / 50`, progress and next milestone.
- [ ] Run focused tests GREEN.

### Task 2: Assistant coach domain and annual expiry

**Files:**
- Create: `tests/unit/domain/school/assistantCoach.test.ts`
- Create: `src/domain/school/assistantCoach.ts`
- Modify: `tests/unit/domain/calendar/academicYearProgression.test.ts`
- Modify: `src/domain/calendar/academicYearProgression.ts`

**Interfaces:**
- Produces `ASSISTANT_COACH_OPTIONS`.
- Produces `evaluateAssistantCoachContract(state, rank, specialty)`.
- Produces `contractAssistantCoach(state, rank, specialty)`.
- Produces `assistantCoachTrainingModifiers(state, player, targetAbilities)`.

- [ ] Write RED tests for catalog prices/modifiers, specialty validation, insufficient funds, replacement with no refund, ledger entry, and expired contract.
- [ ] Write RED academic-year test proving transition clears the contract.
- [ ] Run focused tests RED.
- [ ] Implement domain mutation through `applySchoolFundsChange` and expiry handling.
- [ ] Run focused tests GREEN.

### Task 3: Apply coach modifiers to weekly training

**Files:**
- Modify: `src/domain/training/calculateGrowth.ts`
- Modify: `src/domain/training/resolveWeeklyTraining.ts`
- Modify: `tests/unit/domain/training/resolveWeeklyTraining.test.ts`

**Interfaces:**
- Adds assistant-coach modifiers as ordinary logged growth modifiers without replacing head-coach development.

- [ ] Write RED tests for general modifier and matching specialty modifier.
- [ ] Include advanced/master low-condition modifier and master grade-1 modifier.
- [ ] Run focused tests RED.
- [ ] Add modifiers before each player activity resolution.
- [ ] Run focused tests GREEN.

### Task 4: Authoritative coach contract game action

**Files:**
- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify: `tests/unit/worker/game/actionSchema.test.ts` if present, otherwise create focused schema test.
- Modify: `tests/unit/worker/game/applyGameAction.test.ts` or nearest existing action test.

**Interfaces:**
- Adds action `{ type: "assistant-coach-contract"; rank; specialty }`.

- [ ] Write RED schema/application tests.
- [ ] Run focused tests RED.
- [ ] Implement schema/action dispatch and convert domain validation into rule conflicts.
- [ ] Run focused tests GREEN.

### Task 5: Staff UI and integration

**Files:**
- Modify: `src/features/school/SchoolNavigationTabs.tsx`
- Modify: `src/features/school/SchoolNavigationState.ts`
- Modify: `src/features/school/SchoolScreen.tsx`
- Modify: `src/features/school/school-screen.css`
- Modify: `src/app/GameApp.tsx`
- Modify/Create: `tests/unit/features/school/SchoolScreen.test.tsx`

**Interfaces:**
- Adds `staff` school view.
- Adds SchoolScreen callback `onContractAssistantCoach(rank, specialty)`.

- [ ] Write RED UI test for staff tab, four ranks, specialty selection and current-contract display.
- [ ] Run focused test RED.
- [ ] Implement compact mobile-first staff screen and GameApp action call.
- [ ] Run focused test GREEN.

### Task 6: Verification and integration

- [ ] Run `npm run verify`.
- [ ] Run mobile E2E through CI.
- [ ] Review diff against approved spec; no placeholder effects or false UI claims.
- [ ] Push PR to `main`, require GREEN CI, merge, then require GREEN main CI.
