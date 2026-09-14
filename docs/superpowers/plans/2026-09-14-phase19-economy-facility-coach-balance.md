# Phase19 Economy / Facility / Coach Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make school money meaningful over long saves while making Lv.50 facilities and annual assistant coaches practical, explicit choices rather than hidden or repetitive friction.

**Architecture:** Keep all economy calculations authoritative in the domain/worker path. Extend facility upgrades with a bounded `1 | 5 | 10` level count, price the entire range before mutating state, and send a single atomic server action. Keep coach contracts annual and authoritative, wire the existing School staff UI to the action path, and reject a second contract in the same academic year.

**Tech Stack:** TypeScript, React, Zod, Vitest, Cloudflare Worker action boundary.

**Spec:** `docs/superpowers/specs/2026-09-14-phase19-economy-facility-coach-balance-design.md`

## Global Constraints

- Preserve existing saves and the existing single-level facility action when `levels` is omitted.
- Facility maximum remains exactly Lv.50.
- Bulk facility choices are exactly +1, +5, and +10.
- Bulk upgrades are all-or-nothing: no partial level purchase when funds are insufficient or the target exceeds Lv.50.
- Assistant coach contracts last one academic year and only one contract may be purchased per academic year.
- PvP authority/privacy/idempotency behavior is out of scope and must not change.
- Keep normal CI quiet on feature pushes; only official PR/main CI should be treated as release evidence.

---

### Task 1: Lock economy and domain contracts

**Files:**
- Create: `tests/unit/domain/school/phase19EconomyFacilityCoachBalance.test.ts`
- Modify: `src/domain/school/schoolEconomy.ts`
- Modify: `src/domain/school/facilityUpgrade.ts`
- Modify: `src/domain/school/assistantCoach.ts`

**Interfaces:**
- Produces: `calculateFacilityUpgradeTotalCost(key, currentLevel, levels)`.
- Produces: `evaluateFacilityUpgrade(state, schoolId, key, levels = 1)`.
- Produces: `upgradeFacility(state, schoolId, key, levels = 1)`.
- Produces: `AssistantCoachContractReason` including `already-contracted-this-year`.

- [x] **Step 1: Verify the focused contract test is RED.**

Run: `npx vitest run tests/unit/domain/school/phase19EconomyFacilityCoachBalance.test.ts`
Expected: FAIL on annual budgets, missing bulk-cost function, bulk evaluation/application, Lv.50 bounds, and second coach contract.

- [x] **Step 2: Raise annual school budgets without flattening reputation tiers.**

Set `ANNUAL_BUDGETS` to `450 / 560 / 730 / 950 / 1230 / 1570` from unknown through elite.

- [x] **Step 3: Implement atomic bulk facility evaluation.**

Validate `levels` as `1 | 5 | 10`, reject targets above Lv.50, calculate each intermediate upgrade cost with `calculateFacilityUpgradeCost`, and deduct the aggregate once through `applySchoolFundsChange`.

- [x] **Step 4: Enforce one assistant coach contract per academic year.**

If `state.schoolManagement.assistantCoach?.contractYearIndex === state.yearIndex`, return `{ allowed: false, reason: "already-contracted-this-year" }` before any debit.

- [x] **Step 5: Run the focused contract test GREEN.**

Run: `npx vitest run tests/unit/domain/school/phase19EconomyFacilityCoachBalance.test.ts`
Expected: 7/7 PASS.

### Task 2: Extend the authoritative action contract

**Files:**
- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify: `tests/unit/worker/applyGameAction.test.ts`
- Modify: `tests/unit/worker/assistantCoachAction.test.ts`

**Interfaces:**
- Consumes: facility domain functions from Task 1.
- Produces: `facility-upgrade` action with optional `levels: 1 | 5 | 10`; omitted means `1`.

- [x] **Step 1: Add action-schema coverage for +5/+10 and invalid counts.**

Expect +5/+10 to parse and values such as `2`, `0`, or `11` to fail.

- [x] **Step 2: Pass `action.levels ?? 1` into facility evaluation and mutation.**

Keep existing callers without `levels` fully compatible.

- [x] **Step 3: Map same-year coach rejection to a stable worker conflict.**

Use code `assistant_coach_already_contracted_this_year` with a Japanese user-facing message.

- [x] **Step 4: Run worker action tests GREEN.**

Run: `npx vitest run tests/unit/worker/applyGameAction.test.ts tests/unit/worker/assistantCoachAction.test.ts`
Expected: PASS.

### Task 3: Wire mobile-first School UI

**Files:**
- Modify: `src/features/school/SchoolScreen.tsx`
- Modify: `src/features/school/school-screen.css`
- Modify: `src/app/GameApp.tsx`
- Modify: `tests/unit/features/school/SchoolScreen.test.tsx`
- Modify: `tests/unit/features/school/AssistantCoachStaffScreen.test.tsx`

**Interfaces:**
- `SchoolScreen.onUpgradeFacility(key, levels)` sends one authoritative action.
- `SchoolScreen.onContractAssistantCoach(rank, specialty)` sends one authoritative action.

- [x] **Step 1: Add UI tests for +1/+5/+10 facility buttons and the coach callback.**

The facility sheet must expose available choices, show target level/cost, and disable impossible choices. The staff tab must enable a legal contract when a handler is present and show same-year contracts as unavailable.

- [x] **Step 2: Replace the single facility confirmation action with three bounded choices.**

Each button derives its own `evaluateFacilityUpgrade(..., levels)` result. +5/+10 that exceed Lv.50 or available funds are disabled; +1 stays backward-compatible.

- [x] **Step 3: Connect GameApp to both authoritative actions.**

`upgradeSchoolFacility(key, levels)` sends `{ type: "facility-upgrade", facility: key, levels }`; `contractSchoolAssistantCoach(rank, specialty)` sends `{ type: "assistant-coach-contract", rank, specialty }`.

- [x] **Step 4: Keep the sheet usable on mobile.**

Use a compact grid/stack with clear level delta, aggregate cost, and post-purchase funds; avoid horizontal overflow.

- [x] **Step 5: Run focused School UI tests GREEN.**

Run: `npx vitest run tests/unit/features/school/SchoolScreen.test.tsx tests/unit/features/school/AssistantCoachStaffScreen.test.tsx`
Expected: PASS.

### Task 4: Balance evidence and regression gate

**Files:**
- Modify only if evidence requires: economy constants/tests above.
- Record evidence in this plan or PR description.

**Interfaces:**
- Consumes the final economy/facility/coach behavior from Tasks 1-3.

- [x] **Step 1: Run focused domain/worker/UI tests plus typecheck/format.**

Run: `npx vitest run tests/unit/domain/school/phase19EconomyFacilityCoachBalance.test.ts tests/unit/worker/applyGameAction.test.ts tests/unit/worker/assistantCoachAction.test.ts tests/unit/features/school/SchoolScreen.test.tsx tests/unit/features/school/AssistantCoachStaffScreen.test.tsx && npm run typecheck && npm run format:check`
Expected: PASS.

- [x] **Step 2: Run deterministic 10-year and 30-year balance evidence.**

Confirm funds do not trend negative from ordinary play, a concentrated facility can reach Lv.50, assistant coach remains a meaningful annual spend, and Lv.50 does not become automatic across all facilities.

- [x] **Step 3: Run full repository verification once.**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 4: Open one PR and use official PR CI as the final pre-merge gate.**

Do not repeatedly rerun CI without inspecting exact failing logs.

- [ ] **Step 5: Squash merge after all PR checks are GREEN, then confirm post-merge main CI is GREEN.**

## Verification Evidence

### Focused/full regression

Safe verification run `34807523943`:
- Focused Phase19-3 regression: 13 files / 70 tests PASS.
- Typecheck PASS.
- `npm run verify` PASS: formatting, lint, typecheck, V2 structure, unit tests, production build.
- `npm run release:check` PASS: release metadata v0.1.0 / save schema v8.

### 10-season normal-management soak

Two deterministic release seeds completed 10/10 seasons through the production action driver.
- `phase18-release-a`: final funds 976, final-year minimum 384; facilities around Lv17-18.
- `phase18-release-b`: final funds 942, final-year minimum 942; facilities around Lv20-25.
- Early zero-fund pressure occurs in one seed, but does not persist across later seasons.

### 30-season normal-management soak

Safe run `34807832559` completed 30/30 seasons for both release seeds.
- `phase18-release-a`: final funds 281; facility milestone maximum Lv46; 0 persistent-zero-fund years (>=10 zero-fund weeks); no facility reached Lv50.
- `phase18-release-b`: final funds 333; facility milestone maximum Lv45; 0 persistent-zero-fund years; no facility reached Lv50.
- Therefore normal balanced investment does not automatically max every facility.

### Focused Lv50 reachability

Safe run `34808265320` executed `tests/soak/phase19FacilityFocusSoak.test.ts` with `vitest.soak.config.ts`.
- Training facility reached Lv50 through authoritative actions only.
- Reached in year 2 after 76 weeks.
- 30 upgrade actions: 25 x +1 and 5 x +5; no partial upgrades and no direct state mutation.
- Final funds 1015 and no negative balance.
- This proves Lv50 is practically reachable when the player deliberately concentrates investment, while the normal 30-year soak proves Lv50 is not automatic.