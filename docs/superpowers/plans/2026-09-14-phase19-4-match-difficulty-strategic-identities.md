# Phase19-4 Match Difficulty & Strategic Identities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make solo/PVE matches strategically distinct by school archetype and CPU coaching quality, add a bounded defense-direction matchup, and expose readable counterplay without changing PvP authority/privacy semantics.

**Architecture:** Keep the existing three-axis `MatchTacticPlan` unchanged for PvP compatibility. Add two pure PVE-facing domain modules: one for school strategic identity and one for CPU coaching decisions. Defense bias remains stored in `School.tactics` and is exposed as a separate team setting/action. Interactive PVE matches pass a narrowed CPU coach policy into the existing resumable match engine, and automatic tactical changes are recorded in existing command history/event presentation without duplicating human-command mutation logic.

**Tech Stack:** TypeScript, React, Vitest, Zod, Cloudflare Worker action boundary, existing deterministic `SeededRandom` match engine.

**Spec:** `docs/superpowers/specs/2026-09-14-phase19-match-difficulty-strategic-identities-design.md`

## Global Constraints

- No hidden flat CPU stat bonus.
- No save schema bump unless separately reviewed.
- Keep `MatchTacticPlan` as exactly `serve / attack / block`; defense bias is separate.
- CPU decisions may use only own school data plus public/current match information.
- PvP authority, privacy, idempotency, reconnect, and same-command retry semantics remain unchanged.
- PVE CPU policy is deterministic for identical authoritative state.
- Automatic CPU decisions execute at most once per decision boundary.
- User-facing tactical changes remain mobile-first and do not add extra match interruption cadence.
- Phase19-4 does not add selectable difficulty levels or automatic substitution AI.

---

### Task 1: Canonical school match identities

**Files:**

- Create: `src/domain/match/schoolMatchIdentity.ts`
- Modify: `src/domain/generation/generateSchool.ts`
- Test: `tests/unit/domain/match/phase19StrategicIdentity.test.ts`

**Interfaces:**

- Consumes: `SchoolArchetypeDefinition`, `MatchTacticPlan`, `TeamTactics["defenseBias"]`, `Position`.
- Produces:
  - `SchoolMatchIdentityProfile`
  - `schoolMatchIdentity(archetypeId: string): SchoolMatchIdentityProfile`
  - `applySchoolMatchIdentityDefaults(tactics: TeamTactics, archetypeId: string): TeamTactics`

- [ ] **Step 1: Write failing identity tests**

```ts
it("gives all eight archetypes recognizable identities", () => {
  expect(schoolMatchIdentity("school.speed").preferredPlan.attack).toBe(
    "quick",
  );
  expect(schoolMatchIdentity("school.height").preferredPlan.block).toBe(
    "commit",
  );
  expect(schoolMatchIdentity("school.serve").preferredPlan.serve).toBe(
    "aggressive",
  );
  expect(
    schoolMatchIdentity("school.rotation").attackDistributionBias,
  ).toBeDefined();
});

it("does not allow a generated serve school to become low-risk by default", () => {
  const generated = generateSchool(/* deterministic serve archetype fixture */);
  expect(generated.archetypeId).toBe("school.serve");
  expect(generated.tactics.serveRisk).toBeGreaterThanOrEqual(65);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run tests/unit/domain/match/phase19StrategicIdentity.test.ts
```

Expected: FAIL because `schoolMatchIdentity` does not exist and generated serve risk is not identity-bound.

- [ ] **Step 3: Implement identity profile**

Use one explicit record keyed by the eight current archetype IDs. Example public shape:

```ts
export interface SchoolMatchIdentityProfile {
  preferredPlan: MatchTacticPlan;
  defensePreference: TeamTactics["defenseBias"];
  attackDistributionBias: Partial<Record<Position, number>>;
  adaptationBias: "hold-style" | "balanced" | "counter-heavy";
}
```

Do not add raw ability modifiers.

- [ ] **Step 4: Apply identity defaults during school generation**

After choosing the archetype, derive the school tactics from the identity profile. Preserve only small bounded variation where it does not erase identity. Required invariants:

```ts
school.serve    => serveRisk >= 65
school.speed    => attackTempo === "fast"
school.height   => blockSystem === "commit"
school.defense  => defenseBias !== random unrelated value
school.rotation => attack distribution remains broad rather than ace-concentrated
```

- [ ] **Step 5: Run focused tests and existing generation tests**

```bash
npx vitest run \
  tests/unit/domain/match/phase19StrategicIdentity.test.ts \
  tests/unit/domain/generation/generateWorld.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/match/schoolMatchIdentity.ts src/domain/generation/generateSchool.ts tests/unit/domain/match/phase19StrategicIdentity.test.ts
git commit -m "feat: add school match identities"
```

---

### Task 2: Bounded defense-direction matchup

**Files:**

- Modify: `src/domain/match/simulateMatch.ts`
- Modify: `tests/unit/domain/match/phase15TacticalTradeoffs.test.ts`
- Test: `tests/unit/domain/match/phase19DefenseBias.test.ts`

**Interfaces:**

- Consumes: `TeamTactics["defenseBias"]`, attacker position/decision, deterministic match random source.
- Produces internal pure helpers with exported test surface only if necessary:
  - `AttackDirection = "line" | "cross" | "neutral"`
  - direction-specific bounded dig adjustment.

- [ ] **Step 1: Write RED tests for correct/wrong reads**

```ts
it("rewards the correct line read without becoming a flat defense bonus", () => {
  expect(lineDefenseVsLineAttack).toBeGreaterThan(crossDefenseVsLineAttack);
  expect(
    Math.abs(lineDefenseVsLineAttack - crossDefenseVsLineAttack),
  ).toBeLessThanOrEqual(8);
});

it("keeps balanced defense stable but not strictly best", () => {
  expect(lineVsRepresentativeMix).not.toEqual(crossVsRepresentativeMix);
  expect(balancedVsRepresentativeMix).toBeGreaterThan(
    Math.min(lineVsRepresentativeMix, crossVsRepresentativeMix),
  );
  expect(balancedVsRepresentativeMix).toBeLessThan(
    Math.max(lineVsRepresentativeMix, crossVsRepresentativeMix),
  );
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/domain/match/phase19DefenseBias.test.ts tests/unit/domain/match/phase15TacticalTradeoffs.test.ts
```

Expected: new Phase19 tests fail because `defenseBias` is currently simulation-inert. The existing Phase15 inertness test must be deliberately replaced, not silently deleted.

- [ ] **Step 3: Implement attack direction and bounded defense adjustment**

Requirements:

```ts
// Direction uses attacker role + decision + attack plan + seeded randomness.
// defenseBias effect is matchup-only:
correct read => +3 effective defense points (tunable after matrix)
wrong read   => -3 effective defense points
balanced     => 0 stable modifier
```

Do not directly modify persisted abilities. Add public-safe detail codes such as `attack.line`, `attack.cross`, `attack.neutral` to attack events.

- [ ] **Step 4: Update the Phase15 contract intentionally**

Replace only the old test that asserted defense bias was inert. Keep quick-vs-block and serve risk/reward regression tests unchanged.

- [ ] **Step 5: Run match regression**

```bash
npx vitest run \
  tests/unit/domain/match/phase19DefenseBias.test.ts \
  tests/unit/domain/match/phase15TacticalTradeoffs.test.ts \
  tests/unit/domain/match/simulateMatch.test.ts \
  tests/unit/domain/match/phase16RandomCompatibility.test.ts
```

Expected: PASS with deterministic results.

- [ ] **Step 6: Commit**

```bash
git add src/domain/match/simulateMatch.ts tests/unit/domain/match/phase15TacticalTradeoffs.test.ts tests/unit/domain/match/phase19DefenseBias.test.ts
git commit -m "feat: add directional defensive matchups"
```

---

### Task 3: CPU coach decision model

**Files:**

- Create: `src/domain/match/cpuCoachPolicy.ts`
- Test: `tests/unit/domain/match/phase19CpuCoachPolicy.test.ts`

**Interfaces:**

- Produces:

```ts
export type CpuCoachTier = 0 | 1 | 2 | 3;

export interface CpuCoachPublicView {
  schoolId: SchoolId;
  opponentSchoolId: SchoolId;
  archetypeId: string;
  reputation: SchoolReputation;
  coachTactics: number;
  ownPlan: MatchTacticPlan;
  opponentPlan: MatchTacticPlan;
  score: { own: number; opponent: number };
  setNumber: number;
  ownSetsWon: number;
  opponentSetsWon: number;
  runLength: number;
  runWinnerSchoolId: SchoolId | null;
  timeoutAvailable: boolean;
  publicStats: {
    ownAces: number;
    ownServeErrors: number;
    opponentAces: number;
    ownAttackPoints: number;
    opponentAttackPoints: number;
    ownBlockPoints: number;
    opponentBlockPoints: number;
  };
}

export function cpuCoachTier(
  reputation: SchoolReputation,
  coachTactics: number,
): CpuCoachTier;
export function decideCpuCoachCommand(
  view: CpuCoachPublicView,
  reason: CoachDecisionReason,
): Extract<
  MatchCommand,
  { type: "timeout" } | { type: "set-match-tactics" } | { type: "continue" }
>;
```

- [ ] **Step 1: Write RED policy tests**

Cover:

```ts
weak/low-reputation => Tier 0
elite/high-tactics => Tier 3
Tier 0 holds identity in a non-emergency
Tier 3 counters quick attack with commit block when public evidence supports it
Tier 3 can reduce aggressive serve after excessive serve errors
opponent-run + timeout available can choose timeout
same view => same command
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/domain/match/phase19CpuCoachPolicy.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement deterministic tiering and scoring**

Use fixed thresholds based on `coachTactics` plus reputation ordinal. Do not read player abilities or hidden traits. Candidate plans are limited to current plan, identity-preferred plan, and one-axis public counters. Tie-break deterministically by stable axis/value order.

- [ ] **Step 4: Run focused tests**

```bash
npx vitest run tests/unit/domain/match/phase19CpuCoachPolicy.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/match/cpuCoachPolicy.ts tests/unit/domain/match/phase19CpuCoachPolicy.test.ts
git commit -m "feat: add deterministic cpu coach policy"
```

---

### Task 4: Reuse authoritative command mutation for automatic CPU tactics

**Files:**

- Modify: `src/domain/match/simulateMatch.ts`
- Modify: `src/domain/match/applyMatchCommand.ts` only if a shared internal helper is required
- Test: `tests/unit/domain/match/phase19AutomaticCpuCoach.test.ts`
- Regression: `tests/unit/domain/match/phase16ResumableMatch.test.ts`
- Regression: `tests/unit/domain/match/phase16MatchCommands.test.ts`

**Interfaces:**

- Extend `AutomaticCoachPolicy` return union to `timeout | set-match-tactics | continue`.
- Automatic tactic changes must update the same runtime tactic state as human `set-match-tactics`.
- Record exactly one command-history entry per automatic decision boundary.

- [ ] **Step 1: Write RED automatic-coach tests**

```ts
it("applies one automatic tactic change at a set break", () => {
  expect(match.runtime!.commandHistory.filter(isAutomaticCpuChange)).toHaveLength(1);
  expect(match.runtime!.awayTactics.block).toBe("commit");
});

it("does not duplicate the same automatic decision after resume", () => {
  const once = resumeMatch(...);
  const twice = resumeMatch({ match: once.match, ... });
  expect(countAutomaticCommands(twice.match)).toBe(countAutomaticCommands(once.match));
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/domain/match/phase19AutomaticCpuCoach.test.ts
```

Expected: FAIL because automatic policy currently accepts only timeout/continue and does not mutate tactics.

- [ ] **Step 3: Extend automatic command handling**

Use one command application path. Automatic `set-match-tactics` must produce a command-history record with the public plan and a public-safe event/detail code. It must not call client/PvP APIs.

- [ ] **Step 4: Verify resumability and human commands**

```bash
npx vitest run \
  tests/unit/domain/match/phase19AutomaticCpuCoach.test.ts \
  tests/unit/domain/match/phase16ResumableMatch.test.ts \
  tests/unit/domain/match/phase16MatchCommands.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/match/simulateMatch.ts src/domain/match/applyMatchCommand.ts tests/unit/domain/match/phase19AutomaticCpuCoach.test.ts
git commit -m "feat: apply automatic cpu tactic changes"
```

---

### Task 5: PVE worker integration with narrowed public CPU view

**Files:**

- Modify: `worker/game/applyGameAction.ts`
- Test: `tests/unit/worker/phase19CpuCoachIntegration.test.ts`
- Regression: `tests/unit/worker/phase19MatchExperience.test.ts`

**Interfaces:**

- Add worker-local adapter that converts authoritative PVE match state into `CpuCoachPublicView`.
- Pass `automaticCoachSchoolId` and policy to `startMatch` and `resumeMatch` for practice and official PVE only.
- Do not modify PvP Worker/session paths.

- [ ] **Step 1: Write RED integration tests**

Cover:

```ts
practice PVE starts/resumes with CPU automatic coach
official PVE starts/resumes with CPU automatic coach
CPU command history contains only public tactical/timeout decisions
match experience still applies only on completed authoritative match
PvP-related action schemas and code paths are untouched
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/worker/phase19CpuCoachIntegration.test.ts
```

Expected: FAIL because worker does not pass automatic coach policy.

- [ ] **Step 3: Implement narrowed adapter and connect PVE start/resume**

The adapter must not expose opponent player abilities or hidden traits to the policy. Build public statistics from match event log only.

- [ ] **Step 4: Verify Worker regressions**

```bash
npx vitest run \
  tests/unit/worker/phase19CpuCoachIntegration.test.ts \
  tests/unit/worker/phase19MatchExperience.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/game/applyGameAction.ts tests/unit/worker/phase19CpuCoachIntegration.test.ts
git commit -m "feat: connect cpu coaching to pve matches"
```

---

### Task 6: Separate user defense-bias setting without changing PvP plan

**Files:**

- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/TeamTacticsPanel.tsx`
- Modify: `src/features/team/tacticsPresentation.ts`
- Modify: `src/features/team/team-tactics.css` if required
- Test: `tests/unit/features/team/TeamTacticsPanel.test.tsx`
- Test: `tests/unit/worker/phase19DefenseBiasAction.test.ts`

**Interfaces:**

- Add a separate GameAction:

```ts
{
  type: "set-team-defense-bias";
  defenseBias: "line" | "balanced" | "cross";
}
```

- `MatchTacticPlan` remains unchanged.
- `TeamTacticsPanel` receives `defenseBias` and `onSaveDefenseBias` separately from `currentPlan`/`onSave`.

- [ ] **Step 1: Write RED action/UI tests**

```ts
expect(gameActionRequestSchema.parse({ action: { type: "set-team-defense-bias", defenseBias: "line" }, ... })).toBeDefined();
fireEvent.click(screen.getByRole("button", { name: "ライン警戒" }));
fireEvent.click(screen.getByRole("button", { name: "守備配置を保存" }));
expect(onSaveDefenseBias).toHaveBeenCalledWith("line");
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/features/team/TeamTacticsPanel.test.tsx tests/unit/worker/phase19DefenseBiasAction.test.ts
```

Expected: FAIL because the action/UI does not exist.

- [ ] **Step 3: Implement authoritative defense setting**

Persist only `school.tactics.defenseBias`. Do not add it to PvP publish/challenge `MatchTacticPlan` unless an existing public school-tactics summary already includes it; Phase19-4 does not expand PvP transport.

- [ ] **Step 4: Verify UI/action regression**

```bash
npx vitest run \
  tests/unit/features/team/TeamTacticsPanel.test.tsx \
  tests/unit/worker/phase19DefenseBiasAction.test.ts \
  tests/unit/app/GameAppActions.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/game/actionSchema.ts worker/game/applyGameAction.ts src/app/GameApp.tsx src/features/team/PlayerHubScreen.tsx src/features/team/TeamTacticsPanel.tsx src/features/team/tacticsPresentation.ts src/features/team/team-tactics.css tests/unit/features/team/TeamTacticsPanel.test.tsx tests/unit/worker/phase19DefenseBiasAction.test.ts
git commit -m "feat: add team defensive coverage setting"
```

---

### Task 7: Opponent tactical-change presentation

**Files:**

- Modify: `src/features/match/matchPresentation.ts`
- Modify: `src/features/match/MatchScreen.tsx` and/or `MatchStatPanels.tsx` only where the existing event presentation belongs
- Test: `tests/unit/features/match/phase19CpuTacticPresentation.test.tsx`

**Interfaces:**

- Consumes automatic tactic-change event/command-history public data.
- Produces short Japanese presentation copy such as `相手が速攻重視へ変更`.

- [ ] **Step 1: Write RED presentation test**

```ts
expect(screen.getByText("相手が速攻重視へ変更")).toBeVisible();
```

The fixture must contain only public match event/plan information.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/features/match/phase19CpuTacticPresentation.test.tsx
```

Expected: FAIL because automatic tactic events are not rendered.

- [ ] **Step 3: Implement compact mobile-first feedback**

Do not add a new full-screen dashboard. Reuse current match event/notification presentation region.

- [ ] **Step 4: Verify match UI regressions**

```bash
npx vitest run tests/unit/features/match/phase19CpuTacticPresentation.test.tsx tests/unit/features/match
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/match/matchPresentation.ts src/features/match/MatchScreen.tsx src/features/match/MatchStatPanels.tsx tests/unit/features/match/phase19CpuTacticPresentation.test.tsx
git commit -m "feat: show opponent tactical adjustments"
```

---

### Task 8: Tactical matrix and CPU intelligence balance harness

**Files:**

- Create: `src/dev/soak/runTacticalMatrix.ts`
- Create: `tests/soak/phase19TacticalMatrix.test.ts`
- Modify: `vitest.soak.config.ts` only if needed to include the new soak file under the existing pattern.
- Create: `docs/superpowers/reports/2026-09-14-phase19-4-tactical-balance-results.md`

**Interfaces:**

- Produce deterministic aggregate metrics for a fixed seed list.
- Minimum metrics: win rate, set win rate, point differential, aces/errors, attack/block/defense points, CPU tactic changes, timeout usage.

- [ ] **Step 1: Write RED matrix assertions**

Required assertions:

```ts
neutral equal-strength matchup stays in a 45-55% band over the fixed seed set
favorable tactical matchup produces a measurable edge but stays below 65%
no one attack/serve plan beats every representative opponent above the acceptance band
+8 to +10 average ability remains strongly favored despite tactical disadvantage
Tier 3 CPU is >= Tier 0 against counterable opponents
Tier 3 does not gain a hidden advantage in symmetric neutral matches
```

- [ ] **Step 2: Verify RED or initial balance failure**

```bash
npx vitest run --config vitest.soak.config.ts tests/soak/phase19TacticalMatrix.test.ts
```

Expected: initially FAIL on at least one balance target until coefficients/policy scoring are tuned.

- [ ] **Step 3: Tune only approved tactical coefficients**

Allowed tuning surfaces:

- attack/block matchup points
- defense correct/wrong-read modifier
- CPU decision thresholds/scores
- archetype default plans/attack-distribution biases

Disallowed tuning surfaces:

- hidden raw CPU ability multiplier
- player growth/economy
- PvP authority behavior

- [ ] **Step 4: Run matrix repeatedly on the same fixed seeds until GREEN**

```bash
npx vitest run --config vitest.soak.config.ts tests/soak/phase19TacticalMatrix.test.ts
```

Record final metrics in the report.

- [ ] **Step 5: Commit**

```bash
git add src/dev/soak/runTacticalMatrix.ts tests/soak/phase19TacticalMatrix.test.ts docs/superpowers/reports/2026-09-14-phase19-4-tactical-balance-results.md
git commit -m "test: add phase19 tactical balance matrix"
```

---

### Task 9: Full regression, cleanup, PR gate

**Files:**

- Delete all temporary Phase19-4 verification workflows/scripts before PR.
- Update: `docs/superpowers/reports/2026-09-14-phase19-4-tactical-balance-results.md` with exact final evidence.

**Interfaces:** None; verification only.

- [ ] **Step 1: Run focused Phase19-4 + Phase15/16 regression**

```bash
npx vitest run \
  tests/unit/domain/match/phase19StrategicIdentity.test.ts \
  tests/unit/domain/match/phase19DefenseBias.test.ts \
  tests/unit/domain/match/phase19CpuCoachPolicy.test.ts \
  tests/unit/domain/match/phase19AutomaticCpuCoach.test.ts \
  tests/unit/domain/match/phase15TacticalTradeoffs.test.ts \
  tests/unit/domain/match/phase16MatchCommands.test.ts \
  tests/unit/domain/match/phase16ResumableMatch.test.ts \
  tests/unit/worker/phase19CpuCoachIntegration.test.ts \
  tests/unit/worker/phase19MatchExperience.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full quality/release checks**

```bash
npm run verify
npm run release:check
```

Expected: PASS.

- [ ] **Step 3: Run tactical matrix**

```bash
npx vitest run --config vitest.soak.config.ts tests/soak/phase19TacticalMatrix.test.ts
```

Expected: PASS.

- [ ] **Step 4: Confirm clean diff**

The branch must contain no temporary workflow/patcher files and must be based on `b09f431ef9fd3f51301d9bfb6e58678d4fa50e61` with no unrelated changes.

- [ ] **Step 5: Open PR and use official CI as the release gate**

PR title:

```text
feat: add strategic match identities and cpu coaching
```

Official PR CI must pass:

- `dependency-audit`
- `quality`
- `mobile-e2e`

- [ ] **Step 6: Squash merge only after exact-head CI GREEN**

After merge, confirm the exact merge SHA on `main` and require post-merge main CI `dependency-audit / quality / mobile-e2e` all GREEN before declaring Phase19-4 complete.
