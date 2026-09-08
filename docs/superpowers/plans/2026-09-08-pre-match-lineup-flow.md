# Pre-Match Lineup Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-first pre-match preparation step for practice, official and PvP matches with temporary lineup editing and presets, without overwriting the saved team selection.

**Architecture:** Keep saved `teamSelection` authoritative for long-term roster configuration and introduce match-scoped selection values at action/request boundaries. Generalize the existing `MatchScreen` pre-match branch, add a focused domain helper for presets/replacements, and pass the temporary selection into `advance-week` / PvP simulation only. The Worker validates every supplied selection and persists only the original saved selection.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4, Testing Library, Zod 4, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-09-08-pre-match-lineup-flow.md`

## Global Constraints

- RED -> GREEN -> REFACTOR for each behavior change.
- Never persist a match-only lineup as the saved `teamSelection`.
- Server validation remains authoritative.
- Keep existing PvP response sanitization and rating atomicity.
- Japanese-first mobile UI; 320/360/390/480 px compatibility.
- Do not merge to `main` without explicit user authorization.

---

### Task 1: Match-scoped lineup helpers

**Files:**
- Create: `src/domain/match/preMatchLineup.ts`
- Create: `tests/unit/domain/match/preMatchLineup.test.ts`

**Interfaces:**
- Produces `PreMatchLineupPreset = "best" | "grade-1" | "grade-2" | "grade-3" | "condition"`.
- Produces `buildPreMatchLineupPreset({ state, schoolId, baseSelection, preset }): TeamSelection`.
- Produces `replacePreMatchPlayer({ selection, outgoingPlayerId, incomingPlayerId }): TeamSelection`.

- [ ] **Step 1: Write failing preset tests.** Assert best returns a valid auto-selected lineup; each grade preset maximizes healthy target-grade active players while retaining seven active players; condition preset never selects an injured player when enough healthy players exist; input selection is immutable.
- [ ] **Step 2: Write failing replacement tests.** Assert rotation replacement updates serving order and bench, libero replacement updates bench, duplicate active players are prevented by swapping through the outgoing slot.
- [ ] **Step 3: Run `npx vitest run tests/unit/domain/match/preMatchLineup.test.ts` and confirm RED.**
- [ ] **Step 4: Implement minimal helper functions using `autoSelectTeam`, `calculatePlayerDisplayPower`, position aptitude, grade preference and condition preference; validate final output with `validateTeamSelection` before returning.**
- [ ] **Step 5: Run focused tests and confirm GREEN.**

### Task 2: Weekly match action accepts temporary selection

**Files:**
- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify: `tests/unit/worker/applyGameAction.test.ts`
- Modify: `tests/unit/worker/gameAction.test.ts`

**Interfaces:**
- `GameAction` advance-week variant becomes `{ type: "advance-week"; matchSelection?: TeamSelection }`.
- `applyAdvanceWeek` uses supplied match selection only for due official/practice simulation and returns the original saved selection.

- [ ] **Step 1: Add failing schema test for `advance-week` with `matchSelection`.**
- [ ] **Step 2: Add failing action test using a valid alternate lineup and assert the match uses that lineup while `AppliedGameAction.teamSelection` remains byte-equivalent to the saved selection.**
- [ ] **Step 3: Run focused Worker tests and confirm RED.**
- [ ] **Step 4: Extend Zod schema/type and route match simulation through `action.matchSelection ?? teamSelection`; validate supplied match selection before simulation.**
- [ ] **Step 5: Ensure practice/official action return paths explicitly preserve the saved `teamSelection`.**
- [ ] **Step 6: Run focused tests and confirm GREEN.**

### Task 3: Pre-match mobile editor and presets

**Files:**
- Create: `src/features/match/PreMatchLineupEditor.tsx`
- Modify: `src/features/match/MatchScreen.tsx`
- Modify: `src/features/match/match.css`
- Modify: `tests/unit/features/match/MatchFlow.test.tsx`

**Interfaces:**
- `MatchScreen.onStart(selection: TeamSelection): void`.
- `MatchScreen` owns a local draft initialized from `homeSelection` while `result === null`.
- `PreMatchLineupEditor` receives `state`, `selection`, `baselineSelection`, `onChange`.

- [ ] **Step 1: Add failing UI test for preset buttons `ベスト / 1年中心 / 2年中心 / 3年中心 / 調子優先 / 元に戻す`.**
- [ ] **Step 2: Add failing UI test that tapping an active player opens a bottom sheet and replacing the player changes the displayed starter without mutating the fixture baseline.**
- [ ] **Step 3: Add failing test that `試合開始` passes the current draft to `onStart`.**
- [ ] **Step 4: Run match feature tests and confirm RED.**
- [ ] **Step 5: Implement compact seven-player editor using `BottomSheet` and the Task 1 helpers.**
- [ ] **Step 6: Recalculate home strength/comparison from the draft and show `この試合のみ` copy.**
- [ ] **Step 7: Make the primary start CTA sticky above bottom navigation and add mobile wrapping/scroll rules.**
- [ ] **Step 8: Start digest autoplay after a newly started match unless reduced-motion is enabled.**
- [ ] **Step 9: Run match tests and confirm GREEN.**

### Task 4: GameApp defers weekly simulation until start

**Files:**
- Modify: `src/app/GameApp.tsx`
- Modify: `tests/unit/app/GameApp.practiceScheduling.test.tsx`
- Modify: `tests/unit/app/GameApp.officialTournament.test.tsx`

**Interfaces:**
- `advanceWeek()` checks for a due official or scheduled practice match before sending the action.
- When a match is pending, it opens pre-match mode with `result=null`.
- `startPreparedWeeklyMatch(selection)` sends `{ type: "advance-week", matchSelection: selection }`.

- [ ] **Step 1: Add failing practice integration test: `次の週へ` with a scheduled match opens `試合準備` and does not call `advance-week` yet.**
- [ ] **Step 2: Add failing test: pressing start calls `advance-week` with the draft `matchSelection`, then displays digest/result.**
- [ ] **Step 3: Add equivalent due-official test using the next official opponent summary.**
- [ ] **Step 4: Run app tests and confirm RED.**
- [ ] **Step 5: Add pre-match state/context to `GameApp`; render existing `MatchScreen` pre-match branch when preparing.**
- [ ] **Step 6: For official guest opponents, provide public opponent name/short name and omit unavailable radar details instead of fabricating a roster.**
- [ ] **Step 7: Keep result continuation behavior: after digest confirmation, a second plain `advance-week` advances to the next week.**
- [ ] **Step 8: Run app tests and confirm GREEN.**

### Task 5: PvP pre-match selection and server override

**Files:**
- Modify: `src/domain/pvp/pvpContracts.ts`
- Modify: `src/services/api/GameApiClient.ts`
- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/pvp/PvpScreen.tsx`
- Modify: `worker/routes/pvpChallenge.ts`
- Modify: `tests/unit/app/GameApp.pvp.test.tsx`
- Modify: `tests/unit/worker/pvpChallenge.test.ts`

**Interfaces:**
- `PvpChallengeRequest.selection?: TeamSelection`.
- UI always supplies the draft; optional contract preserves compatibility with older clients.
- Worker validates selection against authoritative challenger state and uses a temporary snapshot override for simulation only.

- [ ] **Step 1: Add failing app test: clicking a PvP opponent opens pre-match instead of immediately calling challenge API.**
- [ ] **Step 2: Add failing app test: start sends `selection` in challenge request.**
- [ ] **Step 3: Add failing Worker test: valid alternate selection is accepted and used without changing the loaded snapshot object.**
- [ ] **Step 4: Add failing Worker test: invalid/foreign-player selection is rejected and no rating commit occurs.**
- [ ] **Step 5: Run focused app/Worker PvP tests and confirm RED.**
- [ ] **Step 6: Extend contracts/client, add selected PvP opponent pre-match state, and defer API call until start.**
- [ ] **Step 7: Extend Worker request schema and validate with `validateTeamSelection`; simulate with `{ ...challenger, teamSelection: suppliedSelection }`.**
- [ ] **Step 8: Preserve existing sanitized response schema and operation replay semantics.**
- [ ] **Step 9: Run focused PvP tests and confirm GREEN.**

### Task 6: Regression and mobile verification

**Files:**
- Modify/add E2E test under `tests/e2e` only if existing mobile match coverage has a suitable fixture.

- [ ] **Step 1: Run `npm run typecheck`.**
- [ ] **Step 2: Run `npm run lint`.**
- [ ] **Step 3: Run `npm run format:check`.**
- [ ] **Step 4: Run focused suites: `npx vitest run tests/unit/domain/match tests/unit/features/match tests/unit/app/GameApp.practiceScheduling.test.tsx tests/unit/app/GameApp.officialTournament.test.tsx tests/unit/app/GameApp.pvp.test.tsx tests/unit/worker/applyGameAction.test.ts tests/unit/worker/gameAction.test.ts tests/unit/worker/pvpChallenge.test.ts`.**
- [ ] **Step 5: Run `npm run verify`.**
- [ ] **Step 6: Verify no horizontal overflow at 320/360/390/480 px in existing Playwright mobile coverage; add explicit assertions if absent.**
- [ ] **Step 7: Review diff for accidental persistence of temporary lineup or leakage of PvP private data.**

## Self-review

- Spec coverage: all practice/official/PvP pre-match, temporary persistence boundary, presets, individual editing, server validation, autoplay and mobile CTA requirements are mapped to tasks.
- Placeholder scan: no implementation placeholders; each task identifies exact files/interfaces and verification.
- Type consistency: both weekly action and PvP request use existing `TeamSelection`; `MatchScreen.onStart` carries the same draft type end-to-end.
