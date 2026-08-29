# Phase 7 Team Dynamics & Leadership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect existing morale, trust, leadership, relationships, and player-career usage to an explainable team-dynamics system that mildly affects PvE training and official matches while remaining isolated from ranked PvP.

**Architecture:** Add a focused `src/domain/dynamics` module containing pure deterministic calculations, then persist a user-school `teamDynamics` object in schema v4. Feed dynamics into the existing training and official-match pipelines instead of creating parallel engines, and expose one server-authoritative leadership assignment action through the existing game-action operation ledger.

**Tech Stack:** TypeScript, React, Zod, Vitest, Playwright, Cloudflare Worker, existing Supabase-backed game operation persistence.

**Spec:** `docs/superpowers/specs/2026-08-29-phase7-team-dynamics-design.md`

## Global Constraints

- Do not merge Phase 4/5/6/7 branches without explicit user authorization.
- All Phase 7 calculations are deterministic and bounded; initial implementation introduces no new RNG consumption.
- Browser may select captain/vice-captain IDs only; cohesion, roles, concerns, morale/trust effects, and suitability are server-authoritative.
- Ranked PvP must not apply or expose Phase 7 transient dynamics state.
- Dynamics training modifiers are each bounded to 95..105%.
- PvE official-match dynamics readiness effect is bounded to approximately -5%..+5%.
- Cohesion, morale, trust, relationships, lineup continuity, and suitability remain within 0..100.
- Use RED -> GREEN -> REFACTOR for every production behavior change.

---

### Task 1: Dynamics Types, Leadership Suitability, and Cohesion Calculator

**Files:**
- Create: `src/domain/dynamics/teamDynamicsTypes.ts`
- Create: `src/domain/dynamics/calculateTeamDynamics.ts`
- Test: `tests/unit/domain/dynamics/calculateTeamDynamics.test.ts`

**Interfaces:**
- Consumes: existing `GameState`, `Player`, `PlayerId`, user-school roster, and `playerRelationships`.
- Produces: `PlayerRole`, `CohesionTrend`, `PlayerConcernCode`, `PlayerConcern`, `TeamDynamicsState`, `calculateLeadershipSuitability(player)`, `calculateRelationshipSignal(state, rosterIds)`, `calculateCohesionTarget(state, dynamics)`, and `deriveCohesionTrend(previous, current)`.

- [ ] **Step 1: Write the failing unit tests**

```ts
import { describe, expect, test } from "vitest";
import {
  calculateLeadershipSuitability,
  calculateRelationshipSignal,
  deriveCohesionTrend,
} from "../../../../src/domain/dynamics/calculateTeamDynamics";

// Use the existing world/test fixture helper used by neighboring domain tests.

describe("team dynamics calculations", () => {
  test("leadership suitability is deterministic and bounded", () => {
    const first = calculateLeadershipSuitability(player);
    const second = calculateLeadershipSuitability(player);
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(100);
  });

  test("missing relationship entries are neutral", () => {
    expect(calculateRelationshipSignal(stateWithNoRelationships, rosterIds)).toBe(50);
  });

  test.each([
    [50, 53, "rising"],
    [50, 47, "falling"],
    [50, 52, "stable"],
  ])("derives cohesion trend", (previous, current, expected) => {
    expect(deriveCohesionTrend(previous, current)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/unit/domain/dynamics/calculateTeamDynamics.test.ts`

Expected: FAIL because `src/domain/dynamics/calculateTeamDynamics.ts` does not exist.

- [ ] **Step 3: Implement minimal types and pure calculations**

```ts
export function calculateLeadershipSuitability(player: Player): number {
  const gradeBonus = player.grade === 3 ? 100 : player.grade === 2 ? 70 : 25;
  return clamp100(
    player.leadership * 0.4 +
      player.abilities.mental * 0.2 +
      player.trust * 0.15 +
      player.morale * 0.1 +
      player.teamAdaptation * 0.1 +
      gradeBonus * 0.05,
  );
}

export function deriveCohesionTrend(
  previous: number,
  current: number,
): CohesionTrend {
  const delta = current - previous;
  return delta >= 3 ? "rising" : delta <= -3 ? "falling" : "stable";
}
```

`calculateRelationshipSignal` must average all roster pairs, treating absent keys as 50. `calculateCohesionTarget` must implement the exact weighted composition from the spec and clamp to 0..100.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npx vitest run tests/unit/domain/dynamics/calculateTeamDynamics.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/dynamics tests/unit/domain/dynamics
git commit -m "feat: add team dynamics calculations"
```

---

### Task 2: Role, Concern, and Usage Derivation

**Files:**
- Create: `src/domain/dynamics/derivePlayerDynamics.ts`
- Test: `tests/unit/domain/dynamics/derivePlayerDynamics.test.ts`

**Interfaces:**
- Consumes: `GameState`, current `TeamSelection`, `TeamDynamicsState`, recent official usage counters.
- Produces: `derivePlayerRoles(...)`, `derivePlayerConcerns(...)`, `updateRecentOfficialUsage(...)`, `calculateLineupContinuity(...)`.

- [ ] **Step 1: Write failing tests for deterministic tie ordering, ace/starter/rotation/development/reserve classification, 8-match usage bounding, playing-time concern, injury-overuse concern, and three-loss team-slump concern.**

```ts
test("equal-power players use player id as the stable tie breaker", () => {
  const roles = derivePlayerRoles(inputWithEqualPowerPlayers);
  expect(roles[playerId("player-a")]).toBe("ace");
});

 test("recent official usage never grows beyond eight tracked matches", () => {
  const next = updateRecentOfficialUsage(dynamics, nineMatchSelections);
  expect(next.recentOfficialMatchesTracked).toBe(8);
});
```

- [ ] **Step 2: Run focused tests and verify RED because the module is missing.**

Run: `npx vitest run tests/unit/domain/dynamics/derivePlayerDynamics.test.ts`

- [ ] **Step 3: Implement minimal deterministic derivation with no randomness and all per-player maps restricted to current user-school roster IDs.**

- [ ] **Step 4: Run focused tests and typecheck.**

Run: `npx vitest run tests/unit/domain/dynamics/derivePlayerDynamics.test.ts && npm run typecheck`

- [ ] **Step 5: Commit.**

```bash
git add src/domain/dynamics/derivePlayerDynamics.ts tests/unit/domain/dynamics/derivePlayerDynamics.test.ts
git commit -m "feat: derive player roles and concerns"
```

---

### Task 3: Persist Team Dynamics and Migrate Schema v3 to v4

**Files:**
- Modify: `src/domain/model/GameState.ts`
- Modify: `src/persistence/gameStateCodec.ts`
- Modify: initial-state creation paths under `src/domain/generation/generateWorld.ts` and/or `src/app/createInitialGame.ts` only where the canonical state is created.
- Create: `src/domain/dynamics/createInitialTeamDynamics.ts`
- Test: `tests/unit/persistence/phase7GameStateMigration.test.ts`
- Test: `tests/unit/domain/generation/phase7InitialWorld.test.ts`

**Interfaces:**
- Produces `GameState.teamDynamics: TeamDynamicsState` and `CURRENT_GAME_SCHEMA_VERSION = 4`.
- Produces `createInitialTeamDynamics(stateWithoutDynamics): TeamDynamicsState` without changing `randomCursor`.

- [ ] **Step 1: Write migration RED tests proving v3 tournament state, tournament history, randomCursor, players, schools, recruiting, and shopEffects are byte/value-equivalent after decode except for schemaVersion/teamDynamics.**

```ts
expect(decoded.schemaVersion).toBe(4);
expect(decoded.randomCursor).toBe(v3.randomCursor);
expect(decoded.officialSeason).toEqual(v3.officialSeason);
expect(decoded.history.officialTournaments).toEqual(v3.history.officialTournaments);
expect(decoded.teamDynamics.cohesion).toBeGreaterThanOrEqual(0);
```

- [ ] **Step 2: Verify RED with `npx vitest run tests/unit/persistence/phase7GameStateMigration.test.ts tests/unit/domain/generation/phase7InitialWorld.test.ts`.**

- [ ] **Step 3: Implement v3->v4 migration, schema validation, and new-game initialization using pure deterministic calculations only.**

- [ ] **Step 4: Verify focused tests plus `npm run typecheck`.**

- [ ] **Step 5: Commit `feat: persist team dynamics in schema v4`.**

---

### Task 4: Server-Authoritative Leadership Assignment Action

**Files:**
- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify: browser API action typing only as required by the existing client path.
- Create: `src/domain/dynamics/setTeamLeadership.ts`
- Test: `tests/unit/worker/teamLeadershipAction.test.ts`
- Test: `tests/unit/app/teamLeadershipBrowserAuthority.test.ts`

**Interfaces:**
- Adds `{ type: "set-team-leadership"; captainPlayerId: PlayerId; viceCaptainPlayerId: PlayerId }`.
- Produces `setTeamLeadership(state, captainId, viceCaptainId)` with validated user-school roster membership and distinct IDs.

- [ ] **Step 1: Write RED tests for valid assignment, foreign/stale captain rejection, foreign/stale vice-captain rejection, same-player rejection, stale revision no mutation, and browser payload rejection of cohesion/suitability/effect fields.**

- [ ] **Step 2: Verify RED with focused worker/app tests.**

- [ ] **Step 3: Implement validation and reuse the existing operation ledger/revision flow; recalculate cohesion after assignment.**

- [ ] **Step 4: Verify focused tests and typecheck.**

- [ ] **Step 5: Commit `feat: add team leadership action`.**

---

### Task 5: Weekly Morale/Trust Progression and Training Modifiers

**Files:**
- Create: `src/domain/dynamics/progressWeeklyDynamics.ts`
- Modify: `src/domain/training/calculateGrowth.ts`
- Modify: `src/domain/training/resolveWeeklyTraining.ts`
- Test: `tests/unit/domain/dynamics/progressWeeklyDynamics.test.ts`
- Modify/Test: `tests/unit/domain/training/calculateGrowth.test.ts`
- Modify/Test: `tests/unit/domain/training/resolveWeeklyTraining.test.ts`

**Interfaces:**
- Produces `progressWeeklyDynamics(state): GameState`.
- Extends `GrowthModifierCode` with `morale` and `trust` and adds 95..105% modifiers.

- [ ] **Step 1: Write RED tests proving concern penalties are bounded to 4 points/week, neutral recovery is mild, values clamp 0..100, and morale/trust training modifiers each stay 95..105.**

- [ ] **Step 2: Verify RED.**

- [ ] **Step 3: Implement weekly dynamics after successful weekly training without bypassing academic restrictions or consuming RNG.**

- [ ] **Step 4: Verify focused tests, full training suite, and typecheck.**

- [ ] **Step 5: Commit `feat: connect dynamics to weekly training`.**

---

### Task 6: Official Match Feedback and Bounded PvE Readiness

**Files:**
- Create: `src/domain/dynamics/officialMatchDynamics.ts`
- Modify: `src/domain/match/simulateMatch.ts`
- Modify: Phase 6 official-match recording path in `src/domain/tournament/recordOfficialMatch.ts` and/or worker official-match application at the smallest atomic boundary.
- Test: `tests/unit/domain/dynamics/officialMatchDynamics.test.ts`
- Modify/Test: `tests/unit/domain/match/simulateMatch.test.ts`
- Modify/Test: `tests/unit/worker/officialMatchAction.test.ts`

**Interfaces:**
- Produces `calculatePveDynamicsReadiness(state, schoolId, playerId): number` bounded to `0.95..1.05` for the user school and `1` for non-user/ranked contexts.
- Produces exact-once post-match updates to recent starter counts, morale/trust result feedback, concerns, and cohesion.

- [ ] **Step 1: Write RED tests for readiness bounds, user-only PvE application, win/loss feedback, starter usage recording, duplicate operation idempotence, and injury-overuse concern.**

- [ ] **Step 2: Verify RED.**

- [ ] **Step 3: Apply the dynamics factor only through the official PvE simulation path; preserve the base match engine behavior for callers that do not opt into dynamics.**

- [ ] **Step 4: Verify focused tests, existing tournament tests, and typecheck.**

- [ ] **Step 5: Commit `feat: apply dynamics to official matches`.**

---

### Task 7: Annual Leadership Lifecycle and Data Cleanup

**Files:**
- Modify: `src/domain/calendar/academicYearProgression.ts`
- Create or modify focused cleanup helper under `src/domain/dynamics/`.
- Test: `tests/unit/domain/calendar/phase7DynamicsYearProgression.test.ts`
- Modify/Test: `tests/unit/domain/calendar/academicYearProgression.test.ts`

**Interfaces:**
- Clears graduated leadership IDs, increments completed captain season exactly once, resets recent usage window, removes graduated player keys from roles/concerns/relationship data, and recalculates cohesion.

- [ ] **Step 1: Write RED tests for captain season exact-once, graduated captain/vice cleanup, relationship key cleanup, and valid new-roster dynamics.**

- [ ] **Step 2: Verify RED.**

- [ ] **Step 3: Implement lifecycle in the existing academic rollover transaction after roster graduation/intake changes.**

- [ ] **Step 4: Verify focused tests and existing academic-year/tournament long-run tests.**

- [ ] **Step 5: Commit `feat: progress team dynamics across seasons`.**

---

### Task 8: Ranked PvP Isolation Tests and Guardrails

**Files:**
- Modify only if required: `src/domain/pvp/pvpContracts.ts`
- Modify only if required: `worker/pvp/buildPvpSimulationState.ts`
- Create: `tests/unit/worker/pvpDynamicsLeakage.test.ts`
- Modify/Test: `tests/unit/worker/buildPvpSimulationState.test.ts`

**Interfaces:**
- Ranked PvP snapshot/query/simulation remains independent of `teamDynamics` and cohesion readiness.

- [ ] **Step 1: Write a regression test that fails if serialized PvP public/frozen DTOs contain `teamDynamics`, `cohesion`, `playerConcerns`, or relationship-state payloads, and compare ranked simulation results for otherwise identical states with cohesion 0 vs 100.**

- [ ] **Step 2: Verify the test state. If already GREEN because Phase 4 contracts isolate these values, keep the regression test and add the smallest production guard needed to make the test capable of failing on leakage (for example an explicit DTO projection assertion rather than changing runtime behavior).**

- [ ] **Step 3: Add only necessary DTO projection/guard changes; do not add dynamics to ranked simulation.**

- [ ] **Step 4: Run PvP unit/worker suites and typecheck.**

- [ ] **Step 5: Commit `test: guard ranked pvp from team dynamics leakage`.**

---

### Task 9: Team Dynamics UI

**Files:**
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/TeamScreen.tsx`
- Create: `src/features/team/TeamDynamicsPanel.tsx`
- Modify: relevant team/home CSS only.
- Test: `tests/unit/features/team/TeamDynamicsPanel.test.tsx`
- Modify/Test: `tests/unit/features/team/PlayerHubScreen.test.tsx`
- Modify/Test: `tests/unit/features/home/HomeScreen.test.tsx`

**Interfaces:**
- Shows cohesion/trend, captain/vice, suitability candidates, concern count/list, qualitative relationship highlights, player role/trust/morale, and leadership assignment controls.

- [ ] **Step 1: Write RED UI tests for labels, vacant leadership state, assignment callbacks, player badges/concerns, and qualitative relationship rendering.**

- [ ] **Step 2: Verify RED.**

- [ ] **Step 3: Implement mobile-first UI with no direct state mutation; assignment calls existing action client.**

- [ ] **Step 4: Run focused UI tests and typecheck.**

- [ ] **Step 5: Commit `feat: add team dynamics management ui`.**

---

### Task 10: Long-Run, Mobile E2E, Documentation, and Final Verification

**Files:**
- Create: `tests/unit/domain/dynamics/teamDynamicsLongRun.test.ts`
- Create: `tests/e2e/team-dynamics-flow.spec.ts`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts`
- Create: `docs/superpowers/implementation-progress/2026-08-29-phase7-team-dynamics.md`

**Interfaces:**
- No new runtime interfaces; this task validates the complete Phase 7 contract.

- [ ] **Step 1: Add 30-year equal-seed deterministic test and 100-year soak test asserting no stale leadership IDs, no out-of-range dynamics values, bounded maps, and valid current-roster role/concern keys.**

- [ ] **Step 2: Add E2E covering leadership assignment -> training -> official match -> visible dynamics update and mobile widths 320/360/390/480 with no body horizontal overflow.**

- [ ] **Step 3: Run `npm run verify`.**

Expected: format, lint, typecheck, full unit/integration tests, and production audit all pass.

- [ ] **Step 4: Run the complete Playwright mobile E2E suite in CI and record exact run/job/test counts in the implementation-progress document.**

- [ ] **Step 5: Self-review spec coverage, security boundaries, exact-once behavior, schema migration, and repository diff; remove any temporary verification workflow before finalizing.**

- [ ] **Step 6: Commit `docs: record phase 7 team dynamics verification` and open a stacked Draft PR with base `feature/court-legacy-v2-phase6-official-tournaments` and head `feature/court-legacy-v2-phase7-team-dynamics`. Do not merge.**
