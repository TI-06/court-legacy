# Court Legacy V2 Phase 8 Mobile Game Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Normative clarification:** Before implementation, also read `docs/superpowers/plans/2026-08-30-phase8-mobile-game-loop-clarifications.md`. It resolves the plan self-review items for persisted weekly-report detail, exact practice planning percentages/formulas, position-specific practice-growth ability pools, official-week availability, and abbreviated code snippets. Where that clarification file is more specific, it takes precedence.

**Goal:** Replace the current manual training/practice-match loop with a persistent weekly schedule and one-tap weekly resolution, add automatic rest and bounded practice-match growth, and rebuild the primary screens into a compact Japanese-first mobile game UI without regressing Phase 4-7 authority, PvP isolation, tournaments, shop effects, or long-run determinism.

**Architecture:** Add a focused `src/domain/weekly` module that owns persistent weekly schedule state, deterministic practice-match planning, automatic rest, practice-match growth, and the atomic weekly-cycle resolver. Persist that state in `GameState` schema v5, route both Cloud Worker and local-browser play through the same domain resolver, then replace the React UI incrementally: training becomes a plan editor, practice matches become invitation/application planning, Home becomes the weekly command center, official matches are confirmed through the weekly action, and player/tournament screens become compact Japanese-first layouts. Existing match simulation, academic-year progression, tournament recording, team dynamics, shop training boost, and operation-ledger persistence are reused rather than duplicated.

**Tech Stack:** TypeScript 5.9, React 19, Vite 7, Zod 4, Vitest 4, Testing Library, Playwright, Cloudflare Workers, existing Supabase-backed `GameStore` operation persistence.

**Spec:** `docs/superpowers/specs/2026-08-30-phase8-mobile-game-loop-redesign.md`

## Global Constraints

- Use RED -> GREEN -> REFACTOR for every production behavior change.
- Do not merge PR #39 or any Phase 8 implementation PR without explicit user authorization.
- Do not reintroduce character portraits, generated faces, body parts, hair parts, or large pseudo-character/initial hero areas.
- User-visible UI is Japanese-first. English technical identifiers may remain in TypeScript, tests, logs, URLs, and persisted discriminators.
- A normal week has at most one practice match. A due official match takes priority and suppresses practice-match scheduling for that week.
- Automatic rest thresholds are fixed for this phase: injury = forced rest, fatigue >= 65 = automatic rest, condition <= 35 = automatic rest.
- Automatic rest affects normal training and practice matches only. Official matches still use existing injury/safety-lineup rules; fatigue/condition should influence lineup safety without becoming an absolute official-match ban.
- Weekly progression must be atomic at the `GameStore` operation boundary. No persisted intermediate state may expose “training done, match not done”.
- The local-browser adapter must call the same `applyGameAction` and weekly domain resolver used by the Worker.
- Existing shop `nextTrainingGrowthBoost` must be consumed exactly once by the next successfully resolved weekly training.
- Existing pending-event semantics remain choice-based: the weekly cycle may surface the next event after progression, but it must not auto-select a player choice.
- Persistent practice-match history is bounded to 12 entries and repeat-opponent calculations only consider entries within the previous 12 game weeks.
- Ranked PvP must not publish or apply weekly schedule, weekly report, automatic-rest metadata, practice-offer/candidate metadata, or team-dynamics readiness.
- Permanent player ability/morale/trust changes already committed by PvE naturally remain part of the player state and may affect later PvP snapshots under existing rules.
- Maintain deterministic results for identical state/seed/action inputs.
- Supported mobile widths remain 320, 360, 390, and 480 px with zero body/document horizontal overflow.
- Keep touch targets at approximately 44 px minimum for primary buttons/tabs.
- Do not silently change the approved practice-growth constants below during implementation. If they produce a material balance problem, stop and return to design review.

## Approved Initial Practice-Match Balance Constants

```ts
export const PRACTICE_REPEAT_MULTIPLIERS = [1, 0.7, 0.4, 0.2] as const;
export const PRACTICE_HISTORY_LIMIT = 12;
export const PRACTICE_HISTORY_WINDOW_WEEKS = 12;

// Relative-strength growth signal.
strengthFactor = clamp(opponentStrength / Math.max(1, homeStrength), 0.75, 1.35);

// One roll per participating user player.
growthChancePercent = Math.min(
  65,
  Math.round(28 * strengthFactor * repeatMultiplier),
);
```

On a successful growth roll, add `+1` to one deterministic position-relevant ability. Participating user players receive trust `+1`; morale is `+2` on a win and `+1` on a loss. User-school cohesion is `+2` on a win and `+1` on a loss. Reputation-point gain is bounded to `0..5`:

```ts
const reputationDelta = won
  ? Math.min(5, 1 + Math.max(0, Math.round((opponentStrength - homeStrength) / 12)))
  : Math.min(5, Math.max(0, Math.round((opponentStrength - homeStrength) / 20)));
```

Resting players receive the existing standard weekly recovery plus an extra fatigue reduction of `8` and an extra condition increase of `5`, clamped to `0..100`.

---

### Task 1: Persist Weekly Schedule State and Migrate Schema v4 -> v5

**Files:**

- Create: `src/domain/weekly/weeklyScheduleTypes.ts`
- Create: `src/domain/weekly/createWeeklySchedule.ts`
- Modify: `src/domain/model/GameState.ts`
- Modify: `src/domain/generation/generateWorld.ts`
- Modify: `src/persistence/gameStateCodec.ts`
- Create: `tests/unit/persistence/phase8GameStateMigration.test.ts`
- Create: `tests/unit/domain/generation/phase8InitialWorld.test.ts`

**Interfaces:**

```ts
export type PracticeMatchCandidateTier = "same" | "stronger" | "challenge";
export type PracticeMatchCandidateStatus = "available" | "rejected" | "accepted";

export interface PracticeMatchOffer {
  schoolId: SchoolId;
  growthRating: 1 | 2 | 3 | 4 | 5;
  loadRating: 1 | 2 | 3 | 4 | 5;
}

export interface PracticeMatchCandidate {
  schoolId: SchoolId;
  tier: PracticeMatchCandidateTier;
  acceptancePercent: number;
  growthRating: 1 | 2 | 3 | 4 | 5;
  status: PracticeMatchCandidateStatus;
}

export interface PracticeMatchHistoryEntry {
  opponentSchoolId: SchoolId;
  date: GameDate;
}

export interface WeeklyReportMatchSummary {
  opponentSchoolId: SchoolId;
  opponentDisplayName: string;
  homeSetsWon: number;
  awaySetsWon: number;
  won: boolean;
}

export interface WeeklyReport {
  weekStartDate: GameDate;
  weekEndDate: GameDate;
  trainingMenuId: string;
  restingPlayerIds: PlayerId[];
  grownPlayerIds: PlayerId[];
  injuredPlayerIds: PlayerId[];
  healedPlayerIds: PlayerId[];
  practiceMatch: WeeklyReportMatchSummary | null;
  practiceMatchSkippedReason: "insufficient-players" | null;
  cohesionDelta: number;
  reputationDelta: number;
  nextIncomingOfferSchoolId: SchoolId | null;
}

export interface WeeklyScheduleState {
  trainingPlan: WeeklyPlan;
  practiceMatch: {
    incomingOffer: PracticeMatchOffer | null;
    outgoingCandidates: PracticeMatchCandidate[];
    scheduledOpponentId: SchoolId | null;
    scheduledBy: "incoming" | "outgoing" | null;
  };
  recentPracticeMatches: PracticeMatchHistoryEntry[];
  latestReport: WeeklyReport | null;
}
```

`createDefaultWeeklyPlan(state)` must use canonical IDs already present in the current game data (`training.spike`, `instruction.serve`, `instruction.receive`) and the first two user-school roster IDs in stable roster order. Runtime sanitization in later tasks protects against stale/removed IDs.

- [ ] **Step 1: Write migration RED tests.**

Create `phase8GameStateMigration.test.ts` from the Phase 7 migration fixture and prove:

```ts
expect(migrated.schemaVersion).toBe(5);
expect(migrated.randomCursor).toBe(legacy.randomCursor);
expect(migrated.players).toEqual(originalPlayers);
expect(migrated.schools).toEqual(originalSchools);
expect(migrated.world).toEqual(originalWorld);
expect(migrated.officialSeason).toEqual(originalOfficialSeason);
expect(migrated.teamDynamics).toEqual(originalTeamDynamics);
expect(migrated.weeklySchedule.trainingPlan.individualAssignments).toHaveLength(2);
expect(migrated.weeklySchedule.practiceMatch.scheduledOpponentId).toBeNull();
expect(migrated.weeklySchedule.recentPracticeMatches).toEqual([]);
expect(migrated.weeklySchedule.latestReport).toBeNull();
```

Also decode the same serialized v4 payload twice and assert identical `weeklySchedule` values.

- [ ] **Step 2: Write initial-world RED tests.**

`phase8InitialWorld.test.ts` must prove a newly generated game has schema 5, two valid focus-player IDs from the user roster, no scheduled practice match, bounded empty recent history, and no extra RNG consumed after world creation solely to initialize the schedule.

- [ ] **Step 3: Run focused tests and verify RED.**

Run:

```bash
npx vitest run tests/unit/persistence/phase8GameStateMigration.test.ts tests/unit/domain/generation/phase8InitialWorld.test.ts
```

Expected: FAIL because `weeklySchedule` and schema v5 do not exist.

- [ ] **Step 4: Implement the v5 types, deterministic initializer, GameState field, world initialization, Zod schema, and v4 -> v5 migration.**

Migration chaining must become `v0/v1 -> v2 -> v3 -> v4 -> v5`, not rewrite older migration logic. `migrateVersionThree()` should still create Team Dynamics, then call `migrateVersionFour()` to add the weekly schedule.

- [ ] **Step 5: Run focused tests, existing migration tests, and typecheck.**

```bash
npx vitest run tests/unit/persistence/gameStateCodec.test.ts tests/unit/persistence/phase6GameStateMigration.test.ts tests/unit/persistence/phase7GameStateMigration.test.ts tests/unit/persistence/phase8GameStateMigration.test.ts tests/unit/domain/generation/phase8InitialWorld.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/domain/weekly src/domain/model/GameState.ts src/domain/generation/generateWorld.ts src/persistence/gameStateCodec.ts tests/unit/persistence tests/unit/domain/generation/phase8InitialWorld.test.ts
git commit -m "feat: persist weekly schedule in schema v5"
```

---

### Task 2: Automatic Rest and Rest-Aware Weekly Training

**Files:**

- Create: `src/domain/weekly/autoRest.ts`
- Modify: `src/domain/training/resolveWeeklyTraining.ts`
- Modify: `src/domain/calendar/weekProgression.ts`
- Modify: `src/domain/calendar/academicYearProgression.ts`
- Create: `tests/unit/domain/weekly/autoRest.test.ts`
- Modify: `tests/unit/domain/training/resolveWeeklyTraining.test.ts`
- Modify: `tests/unit/domain/calendar/weekProgression.test.ts`
- Modify: `tests/unit/domain/calendar/academicYearProgression.test.ts`

**Interfaces:**

```ts
export type AutoRestReason = "injury" | "fatigue" | "condition";

export interface AutoRestDecision {
  playerId: PlayerId;
  reason: AutoRestReason;
}

export function selectAutomaticRest(
  state: GameState,
  schoolId: SchoolId,
): AutoRestDecision[];
```

Extend training and week progression without breaking existing callers:

```ts
export interface ResolveWeeklyTrainingInput {
  // existing fields...
  restingPlayerIds?: ReadonlySet<PlayerId>;
}

export type ActivitySkipReason = "injured" | "auto-rest" | null;

export interface AdvanceOneWeekOptions {
  restingPlayerIds?: ReadonlySet<PlayerId>;
}

export interface AcademicYearProgressionOptions {
  userIntake?: readonly Player[];
  restingPlayerIds?: ReadonlySet<PlayerId>;
}
```

- [ ] **Step 1: Write threshold RED tests.**

Cover exact boundaries:

```ts
// participates
fatigue = 64; condition = 36; injury = null;

// rests
fatigue = 65;
condition = 35;
injury = { ... };
```

If multiple rest reasons apply, precedence is `injury`, then `fatigue`, then `condition`, so the report is stable.

- [ ] **Step 2: Write training RED tests proving resting players receive zero training activity and zero individual-assignment execution.**

A focus player who is in `restingPlayerIds` must have `skippedReason === "auto-rest"`, no ability growth, no training fatigue increase, and no activity-specific RNG consumption. Run the same fixture with/without that resting player and assert later non-resting players still produce deterministic results for their own consumed stream ordering as defined by the implementation.

- [ ] **Step 3: Write recovery RED tests.**

Prove a rested player receives standard recovery plus `fatigue -8` and `condition +5`, while a normal player preserves current recovery behavior. Clamp at 0/100 and keep injury-week progression unchanged.

- [ ] **Step 4: Run focused tests and verify RED.**

```bash
npx vitest run tests/unit/domain/weekly/autoRest.test.ts tests/unit/domain/training/resolveWeeklyTraining.test.ts tests/unit/domain/calendar/weekProgression.test.ts tests/unit/domain/calendar/academicYearProgression.test.ts
```

- [ ] **Step 5: Implement minimal rest selection, training skip support, and optional rest-aware recovery propagation through `advanceGameWeek`.**

Do not change official-match eligibility here.

- [ ] **Step 6: Run focused tests and typecheck.**

```bash
npx vitest run tests/unit/domain/weekly/autoRest.test.ts tests/unit/domain/training/resolveWeeklyTraining.test.ts tests/unit/domain/calendar/weekProgression.test.ts tests/unit/domain/calendar/academicYearProgression.test.ts
npm run typecheck
```

- [ ] **Step 7: Commit.**

```bash
git add src/domain/weekly/autoRest.ts src/domain/training/resolveWeeklyTraining.ts src/domain/calendar tests/unit/domain/weekly tests/unit/domain/training/resolveWeeklyTraining.test.ts tests/unit/domain/calendar
git commit -m "feat: add automatic weekly rest"
```

---

### Task 3: Deterministic Practice-Match Offers, Candidates, and Scheduling Rules

**Files:**

- Create: `src/domain/weekly/practiceMatchPlanning.ts`
- Modify: `src/domain/weekly/createWeeklySchedule.ts`
- Create: `tests/unit/domain/weekly/practiceMatchPlanning.test.ts`

**Interfaces:**

```ts
export interface PracticePlanningResult {
  incomingOffer: PracticeMatchOffer | null;
  outgoingCandidates: PracticeMatchCandidate[];
}

export function buildPracticePlanning(
  state: GameState,
): PracticePlanningResult;

export function acceptIncomingPracticeOffer(state: GameState): GameState;
export function declineIncomingPracticeOffer(state: GameState): GameState;
export function requestPracticeMatch(
  state: GameState,
  opponentSchoolId: SchoolId,
): { state: GameState; accepted: boolean };
```

Planning randomness must be derived from a forked deterministic seed label such as:

```ts
new SeededRandom(state.seed).fork(
  `practice-planning:${state.date}:${state.userSchoolId}`,
);
```

It must not advance `state.randomCursor` just to render or rebuild the same week’s offer list.

Candidate generation rules:

- Exclude user school.
- Exclude schools already duplicated in the three slots.
- Prefer one same/slightly weaker, one stronger, one challenge target using calculated team strength.
- If world distribution cannot fill a tier, deterministically fall back to the nearest unused school by strength, then school ID.
- `acceptancePercent` is clamped to `5..95` and derived from reputation-point gap, relative strength, and recent meeting count.
- A due official match yields `incomingOffer: null` and `outgoingCandidates: []`.
- Once a practice match is scheduled, another accept/request attempt must be rejected by the domain helper.

- [ ] **Step 1: Write RED tests for deterministic generation and uniqueness.**

Assert identical state gives byte-equal planning, randomCursor remains unchanged, exactly three candidates are returned when at least three opponents exist, and candidates are unique.

- [ ] **Step 2: Write RED tests for reputation and official-week behavior.**

Use low- and high-reputation copies of the same world to prove higher reputation does not reduce incoming-offer probability/quality under controlled deterministic samples. Prove a due official match produces no practice planning.

- [ ] **Step 3: Write RED tests for accept/decline/outgoing request.**

- Accept incoming -> scheduled opponent and `scheduledBy: "incoming"`.
- Decline incoming -> offer cleared, no schedule.
- Accepted outgoing -> scheduled opponent and candidate status accepted.
- Rejected outgoing -> candidate status rejected, no scheduled opponent.
- Second scheduling attempt -> domain validation error.

- [ ] **Step 4: Run RED.**

```bash
npx vitest run tests/unit/domain/weekly/practiceMatchPlanning.test.ts
```

- [ ] **Step 5: Implement planning and scheduling helpers.**

Use existing `calculateSelectionStrength`/`autoSelectTeam` only for deterministic strength comparison; do not simulate a match during planning.

- [ ] **Step 6: Run GREEN and typecheck.**

```bash
npx vitest run tests/unit/domain/weekly/practiceMatchPlanning.test.ts
npm run typecheck
```

- [ ] **Step 7: Commit.**

```bash
git add src/domain/weekly tests/unit/domain/weekly/practiceMatchPlanning.test.ts
git commit -m "feat: add practice match planning"
```

---

### Task 4: Resolve Scheduled Practice Matches and Apply Bounded Growth

**Files:**

- Create: `src/domain/weekly/practiceMatchGrowth.ts`
- Create: `src/domain/weekly/resolvePracticeMatch.ts`
- Modify: `src/domain/team/autoSelectTeam.ts`
- Create: `tests/unit/domain/weekly/practiceMatchGrowth.test.ts`
- Create: `tests/unit/domain/weekly/resolvePracticeMatch.test.ts`
- Modify: `tests/unit/domain/team/autoSelectTeam.test.ts`

**Interfaces:**

Extend auto-selection only through an optional filter so existing official/PvP callers retain current behavior:

```ts
export interface AutoSelectTeamInput {
  state: GameState;
  schoolId: SchoolId;
  unavailablePlayerIds?: ReadonlySet<PlayerId>;
}
```

Practice resolver:

```ts
export interface PracticeMatchResolution {
  state: GameState;
  simulation: SimulateMatchResult | null;
  skippedReason: "insufficient-players" | null;
  participatingPlayerIds: PlayerId[];
  cohesionDelta: number;
  reputationDelta: number;
}

export function resolveScheduledPracticeMatch(input: {
  state: GameState;
  restingPlayerIds: ReadonlySet<PlayerId>;
}): PracticeMatchResolution;
```

- [ ] **Step 1: Write RED tests for auto-selection exclusions.**

Prove unavailable/resting players are excluded even when they would otherwise be starters, default calls remain unchanged, and fewer than seven eligible players fails deterministically.

- [ ] **Step 2: Write RED tests for repeat multipliers and history bounding.**

Assert exact repeat factors `1 / .7 / .4 / .2`, ignore history older than 12 weeks, append the completed opponent/date, and keep only the latest 12 entries.

- [ ] **Step 3: Write RED tests for practice growth.**

With deterministic seeds, prove:

- stronger opponent produces a greater or equal growth chance than weaker opponent;
- every successful ability mutation is exactly `+1` and remains <=100;
- only active user participants receive practice growth/trust/morale changes;
- a loss can still produce growth;
- repeat-opponent multiplier reduces expected growth signal;
- cohesion and reputation deltas are exactly bounded by the approved constants.

- [ ] **Step 4: Write RED tests for full scheduled match resolution.**

Prove:

- no schedule -> no simulation/no changes;
- scheduled match -> 3-set existing simulator used;
- auto-rest players absent from user practice lineup;
- insufficient available players -> no match and `skippedReason: "insufficient-players"`;
- match result is recorded with existing world/history recording path;
- schedule is cleared after resolution;
- same input produces identical output.

- [ ] **Step 5: Run RED.**

```bash
npx vitest run tests/unit/domain/weekly/practiceMatchGrowth.test.ts tests/unit/domain/weekly/resolvePracticeMatch.test.ts tests/unit/domain/team/autoSelectTeam.test.ts
```

- [ ] **Step 6: Implement the minimal resolver and approved growth constants.**

Use `SeededRandom(state.seed, state.randomCursor)` for match/growth resolution and commit the resulting cursor once. Do not use wall-clock randomness.

- [ ] **Step 7: Run GREEN, related match tests, and typecheck.**

```bash
npx vitest run tests/unit/domain/weekly/practiceMatchGrowth.test.ts tests/unit/domain/weekly/resolvePracticeMatch.test.ts tests/unit/domain/team/autoSelectTeam.test.ts tests/unit/domain/match
npm run typecheck
```

- [ ] **Step 8: Commit.**

```bash
git add src/domain/weekly src/domain/team/autoSelectTeam.ts tests/unit/domain/weekly tests/unit/domain/team/autoSelectTeam.test.ts
git commit -m "feat: resolve practice match growth"
```

---

### Task 5: Build the Atomic Weekly Cycle Domain Resolver

**Files:**

- Create: `src/domain/weekly/sanitizeWeeklySchedule.ts`
- Create: `src/domain/weekly/resolveWeeklyCycle.ts`
- Modify: `src/domain/calendar/academicYearProgression.ts`
- Modify: `src/domain/weekly/createWeeklySchedule.ts`
- Create: `tests/unit/domain/weekly/sanitizeWeeklySchedule.test.ts`
- Create: `tests/unit/domain/weekly/resolveWeeklyCycle.test.ts`
- Modify: `tests/unit/domain/calendar/phase7DynamicsYearProgression.test.ts`

**Interfaces:**

```ts
export interface WeeklyCycleOutcome {
  report: WeeklyReport;
  trainingResult: TrainingResult;
  practiceMatchSimulation: SimulateMatchResult | null;
  officialMatchSimulation: SimulateMatchResult | null;
  academicYearTransition: AcademicYearTransitionSummary | null;
}

export interface ResolveWeeklyCycleInput {
  state: GameState;
  teamSelection: TeamSelection;
  data: GameDataRegistry;
  confirmOfficialMatch: boolean;
}

export interface ResolveWeeklyCycleResult {
  state: GameState;
  teamSelection: TeamSelection;
  outcome: WeeklyCycleOutcome;
}
```

`sanitizeWeeklyTrainingPlan` must keep a valid existing plan but replace graduated/missing focus players and missing menu/instruction IDs deterministically. It must never choose the same player twice.

Weekly order for implementation:

1. validate/sanitize persisted weekly plan;
2. calculate automatic rest once from start-of-week state;
3. resolve weekly training using rest set and shop boost;
4. consume shop boost only after successful training;
5. if official match is due: require confirmation and resolve the official match; otherwise resolve the scheduled practice match;
6. progress academic/calendar week with rest-aware recovery;
7. apply annual transition when crossing April and re-auto-select team as existing code does;
8. surface the next pending event using existing event pipeline if no annual transition blocks it;
9. sanitize carried-forward training plan against the new roster;
10. generate next week’s practice offer/candidates (or none when an official match is due);
11. create/persist the bounded weekly report;
12. return full simulation only in `WeeklyCycleOutcome`, not in persisted report.

- [ ] **Step 1: Write schedule-sanitization RED tests.**

Cover graduated focus player, duplicated focus players, missing instruction, and missing menu. Assert deterministic repair and unchanged valid plan.

- [ ] **Step 2: Write normal-week RED tests.**

Prove one call performs training + optional practice + recovery + date progression + next planning + report. Assert no `completedActivityIds` marker is required for the new flow.

- [ ] **Step 3: Write shop-boost RED test.**

Set `nextTrainingGrowthBoost`, resolve one weekly cycle, assert modifier appears in training result and `shopEffects.nextTrainingGrowthBoost` is consumed exactly once. Replaying from the original immutable input must produce the same result; applying to the returned state must not reuse the boost.

- [ ] **Step 4: Write official-week RED tests.**

When `findDueUserOfficialMatch` returns a due match:

- `confirmOfficialMatch: false` -> explicit domain error `official_match_confirmation_required`, no state mutation;
- `confirmOfficialMatch: true` -> training then existing official simulation/recording then week progression in one returned state;
- practice schedule is not resolved in an official week;
- official simulation remains deterministic and uses `buildPveDynamicsReadinessByPlayerId`.

Extract/reuse the current official-match resolution logic rather than duplicating it in Worker. A focused helper under `src/domain/weekly` may call tournament materialization/recording functions.

- [ ] **Step 5: Write academic-year RED tests.**

Advance across April and prove graduated focus players are replaced, weekly history remains bounded, team selection is rebuilt, and Phase 7 leadership/dynamics rollover tests still pass.

- [ ] **Step 6: Run RED.**

```bash
npx vitest run tests/unit/domain/weekly/sanitizeWeeklySchedule.test.ts tests/unit/domain/weekly/resolveWeeklyCycle.test.ts tests/unit/domain/calendar/phase7DynamicsYearProgression.test.ts
```

- [ ] **Step 7: Implement resolver and pure helper extraction.**

Keep Worker orchestration thin; the resolver should be testable without HTTP or persistence.

- [ ] **Step 8: Run GREEN plus calendar/tournament/training suites.**

```bash
npx vitest run tests/unit/domain/weekly tests/unit/domain/calendar tests/unit/domain/training tests/unit/domain/tournament
npm run typecheck
```

- [ ] **Step 9: Commit.**

```bash
git add src/domain/weekly src/domain/calendar tests/unit/domain/weekly tests/unit/domain/calendar
git commit -m "feat: add atomic weekly game cycle"
```

---

### Task 6: Add Server-Authoritative Weekly Planning Actions

**Files:**

- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify: `tests/unit/worker/actionSchema.test.ts`
- Modify: `tests/unit/worker/applyGameAction.test.ts`
- Modify: `tests/unit/app/createBrowserAppDependencies.test.ts`

**Interfaces:**

Add the new actions while temporarily retaining legacy action variants until Task 13 removes them after all UI callers migrate:

```ts
export type GameAction =
  | { type: "set-weekly-training-plan"; plan: WeeklyPlan }
  | { type: "respond-practice-offer"; decision: "accept" | "decline" }
  | { type: "request-practice-match"; opponentSchoolId: SchoolId }
  | { type: "advance-week"; confirmOfficialMatch?: boolean }
  | /* existing team/leadership/facility/event + temporary legacy variants */;
```

`set-weekly-training-plan` validates/sanitizes the submitted plan against the current user roster and game data but does **not** execute training.

`request-practice-match` accepts only one of the server-persisted `outgoingCandidates`; the browser cannot submit acceptance percentage or outcome.

`respond-practice-offer` accepts/declines only the server-persisted incoming offer.

`advance-week` delegates to `resolveWeeklyCycle` and returns `WeeklyCycleOutcome`.

- [ ] **Step 1: Write action-schema RED tests.**

Prove valid new payloads parse and extra browser-controlled fields such as `accepted`, `growthMultiplier`, `restingPlayerIds`, `matchSeed`, `result`, `opponentStrength`, or `report` are rejected by strict Zod schemas.

- [ ] **Step 2: Rewrite worker RED tests around the new semantics.**

Replace the old “training must be completed first” test with:

```ts
const advanced = applyGameAction(snapshot, {
  type: "advance-week",
  confirmOfficialMatch: false,
});
expect(advanced.state.date).not.toBe(snapshot.state.date);
expect(advanced.outcome).toMatchObject({ report: expect.any(Object) });
expect(snapshot).toEqual(before);
```

Also test plan saving without growth, offer accept/decline, candidate rejection, and official confirmation conflict.

- [ ] **Step 3: Run RED.**

```bash
npx vitest run tests/unit/worker/actionSchema.test.ts tests/unit/worker/applyGameAction.test.ts tests/unit/app/createBrowserAppDependencies.test.ts
```

- [ ] **Step 4: Implement Worker cases as thin delegates.**

Do not duplicate weekly logic in `applyGameAction`. Keep operation/revision idempotency in the existing `GameStore` route/persistence layer unchanged.

- [ ] **Step 5: Prove local-browser parity.**

`StaticGameApiClient` already routes normal game actions through `applyGameAction`; add a regression test that saves a weekly plan, advances a week, recreates dependencies, and sees the persisted schedule/report after reload in session-local mode.

- [ ] **Step 6: Run GREEN and typecheck.**

```bash
npx vitest run tests/unit/worker/actionSchema.test.ts tests/unit/worker/applyGameAction.test.ts tests/unit/app/createBrowserAppDependencies.test.ts
npm run typecheck
```

- [ ] **Step 7: Commit.**

```bash
git add worker/game src/app/createBrowserAppDependencies.ts tests/unit/worker tests/unit/app/createBrowserAppDependencies.test.ts
git commit -m "feat: expose weekly planning actions"
```

---

### Task 7: Convert Training UI into a Persistent Weekly Plan Editor

**Files:**

- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/training/TrainingScreen.tsx`
- Modify: `src/features/training/training.css`
- Modify: `src/features/training/training-direct.css`
- Modify: `tests/unit/features/training/TrainingFlow.test.tsx`
- Create: `tests/unit/features/training/TrainingScreen.test.tsx`

**UI contract:**

```ts
interface TrainingScreenProps {
  state: GameState;
  data: GameDataRegistry;
  plan: WeeklyPlan;
  pending: boolean;
  onSave: (plan: WeeklyPlan) => void | Promise<void>;
}
```

The screen shows:

- `週間練習`
- current team menu
- two focus players/instructions
- automatic-rest preview with names/reasons
- note `この設定は次週も引き継ぎます`
- sticky action `設定を保存`

It must not show `練習を実行`, current-week training result, or a training-completed lock.

- [ ] **Step 1: Rewrite TrainingFlow tests RED-first.**

Prove:

- opening `育成` shows persisted plan;
- changing a menu/player/instruction modifies local draft only;
- `設定を保存` invokes the new server action and persists through tab changes/reload;
- duplicate focus-player selection stays disabled;
- automatic-rest preview displays fatigue/condition/injury reasons;
- there is no `練習を実行` button.

- [ ] **Step 2: Run RED.**

```bash
npx vitest run tests/unit/features/training/TrainingFlow.test.tsx tests/unit/features/training/TrainingScreen.test.tsx
```

- [ ] **Step 3: Implement controlled draft/save flow in `GameApp` and compact screen.**

Use BottomSheet pickers already present. Remove `latestTrainingResult` state once no other screen depends on it.

- [ ] **Step 4: Run GREEN, app tests, and typecheck.**

```bash
npx vitest run tests/unit/features/training tests/unit/app
npm run typecheck
```

- [ ] **Step 5: Commit.**

```bash
git add src/app/GameApp.tsx src/features/training tests/unit/features/training
git commit -m "feat: make training a weekly plan editor"
```

---

### Task 8: Add Practice-Match Inbox/Application UI and Optional Replay

**Files:**

- Create: `src/features/match/PracticeMatchScreen.tsx`
- Create: `src/features/match/practice-match.css`
- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/match/MatchScreen.tsx`
- Modify: `src/features/match/MatchPvpEntry.tsx`
- Modify: `src/features/match/MatchOfficialEntry.tsx`
- Create: `tests/unit/features/match/PracticeMatchScreen.test.tsx`
- Modify: existing tests under `tests/unit/features/match/`

**Screen behavior:**

Tabs/segments within the Match area:

- `練習試合`
- `公式戦`
- `対人戦`

Practice screen states:

1. incoming offer -> opponent name/reputation/strength/growth expectation/load + `断る` / `受ける`;
2. scheduled -> one clear card `今週の練習試合: ○○高校`; no second scheduling action;
3. no scheduled match -> three outgoing candidates with acceptance percentage, growth expectation, and `申し込む`;
4. rejected candidate -> visible `今回は断られました`, other still-available candidates remain actionable.

`MatchScreen` becomes replay/detail presentation for an already-computed simulation when launched from the weekly report. Practice-match UI no longer calls a manual `onStart` action.

- [ ] **Step 1: Write PracticeMatchScreen RED tests for all four states and server-derived actions.**

- [ ] **Step 2: Write RED test that no practice-match UI exposes a manual “試合開始” before week advancement.**

- [ ] **Step 3: Run RED.**

```bash
npx vitest run tests/unit/features/match
```

- [ ] **Step 4: Implement Match-area routing and practice screen.**

Keep PvP behavior unchanged. Replace visible `ONLINE ARENA`, `RATED`, `OFFICIAL`, `PRACTICE MATCH`, `HOME`, `AWAY`, `MATCH LIVE`, and `LINEUP CHECK` decorations with Japanese or remove them.

- [ ] **Step 5: Preserve replay.**

When `WeeklyCycleOutcome.practiceMatchSimulation` or `.officialMatchSimulation` exists in the current session, store it in `GameApp` state only for immediate optional detail. Persisted `WeeklyReport` remains summary-only.

- [ ] **Step 6: Run GREEN and typecheck.**

```bash
npx vitest run tests/unit/features/match
npm run typecheck
```

- [ ] **Step 7: Commit.**

```bash
git add src/app/GameApp.tsx src/features/match tests/unit/features/match
git commit -m "feat: add practice match planning UI"
```

---

### Task 9: Rebuild Home as the Compact Weekly Command Center and Add Weekly Report

**Files:**

- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/home.css`
- Create: `src/features/home/WeeklyReportSheet.tsx`
- Create: `src/features/home/weekly-report.css`
- Modify: `src/app/GameApp.tsx`
- Modify: `tests/unit/features/home/HomeScreen.test.tsx`
- Create: `tests/unit/features/home/WeeklyReportSheet.test.tsx`

**Home content at 390x844 target:**

- compact school/date/reputation header;
- central `今週の予定` card: team training, two focus players, rest count, scheduled practice match, official priority;
- four compact team metrics: cohesion, average fatigue, injuries, roster count;
- at most two actionable notices (incoming practice offer, rest warning, official due);
- sticky/fixed-above-nav `次の週へ` CTA;
- no long `直近の試合` and `現在の状態` sections on the base Home page.

`次の週へ` is enabled whenever no unresolved blocking confirmation is required. It no longer depends on a separate training-completed flag.

Weekly report sheet/card displays persisted `state.weeklySchedule.latestReport` and, immediately after an action, can expose `試合詳細を見る` if the current session has a simulation result.

- [ ] **Step 1: Rewrite Home RED tests to the new information hierarchy.**

Assert the screen shows the weekly plan, rest count, scheduled/offer state, official priority, and enabled next-week action without prior manual training.

- [ ] **Step 2: Write weekly-report RED tests.**

Cover training menu, resting players, growth count, injury/heal changes, practice result/skipped reason, cohesion/reputation delta, and optional detail button.

- [ ] **Step 3: Add a compactness DOM contract test.**

Use stable `data-testid` boundaries and assert the base Home renders only the approved high-level sections; this prevents reintroducing long duplicate report blocks.

- [ ] **Step 4: Run RED.**

```bash
npx vitest run tests/unit/features/home
```

- [ ] **Step 5: Implement Home and report presentation.**

The CTA must use sticky positioning above bottom navigation and safe-area insets. Keep `min-width:0` on every grid child.

- [ ] **Step 6: Run GREEN and typecheck.**

```bash
npx vitest run tests/unit/features/home
npm run typecheck
```

- [ ] **Step 7: Commit.**

```bash
git add src/features/home src/app/GameApp.tsx tests/unit/features/home
git commit -m "feat: rebuild compact weekly home"
```

---

### Task 10: Make Official Matches Confirm Through the Weekly Cycle and Replace the Horizontal Bracket

**Files:**

- Modify: `src/features/tournament/TournamentScreen.tsx`
- Modify: `src/features/tournament/tournament.css`
- Modify: `src/app/GameApp.tsx`
- Modify: `tests/unit/features/tournament/TournamentScreen.test.tsx`
- Modify: `tests/unit/worker/officialMatchAction.test.ts`
- Modify: `tests/e2e/official-tournament-flow.spec.ts`

**UI contract:**

```ts
type TournamentViewMode = "user-route" | "full";
```

Default `user-route` shows a vertical progression of the user’s matches/next match by round. `full` shows all round groups vertically. Neither mode uses a `min-width:700px` bracket nor page-level horizontal scrolling.

A due official match button is labeled `公式戦を開始` and calls `advance-week` with `confirmOfficialMatch: true`. It no longer calls a standalone `official-match` browser action. Training is already performed inside the atomic weekly cycle.

- [ ] **Step 1: Rewrite TournamentScreen RED tests.**

Prove:

- default mode is `自校ルート`;
- `全体表` toggle exposes all bracket matches;
- no `trainingCompleted` prop/gate;
- due button asks for existing confirmation sheet when enabled in settings;
- confirmation invokes weekly advance callback.

- [ ] **Step 2: Add CSS/DOM regression test proving no bracket element requires horizontal scroll.**

Remove `.tournament-bracket-scroll` as a horizontal-scrolling contract and render rounds in one-column mobile flow.

- [ ] **Step 3: Rewrite worker official action test around atomic weekly confirmation.**

No separate training action should be required. `advance-week` without confirmation conflicts; confirmed weekly advance records official result once and increments date/week in the same returned state.

- [ ] **Step 4: Run RED.**

```bash
npx vitest run tests/unit/features/tournament/TournamentScreen.test.tsx tests/unit/worker/officialMatchAction.test.ts
```

- [ ] **Step 5: Implement vertical bracket and GameApp callback.**

- [ ] **Step 6: Run GREEN plus tournament domain suite.**

```bash
npx vitest run tests/unit/features/tournament tests/unit/domain/tournament tests/unit/worker/officialMatchAction.test.ts
npm run typecheck
```

- [ ] **Step 7: Commit.**

```bash
git add src/features/tournament src/app/GameApp.tsx tests/unit/features/tournament tests/unit/worker/officialMatchAction.test.ts tests/e2e/official-tournament-flow.spec.ts
git commit -m "feat: integrate official matches with weekly cycle"
```

---

### Task 11: Compact Player/Team Screens and Centralize Japanese Position Labels

**Files:**

- Create: `src/ui/presentation/positionLabels.ts`
- Modify: `src/domain/selectors/playerPresentation.ts` only if shared presentation helpers belong there; otherwise keep domain math unchanged.
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/player-hub.css`
- Modify: `src/features/team/TeamScreen.tsx`
- Modify: `src/features/team/team.css`
- Modify: `src/features/team/team-direct.css`
- Modify: `src/ui/PlayerTile.tsx`
- Modify: `src/ui/ui.css`
- Modify: `src/mobile-layout.css`
- Modify: `tests/unit/features/team/PlayerHubScreen.test.tsx`
- Modify: `tests/unit/features/team/TeamSelectionFlow.test.tsx`
- Create: `tests/unit/ui/PlayerTile.test.tsx`

**Presentation map:**

```ts
export const positionLabels: Record<Position, string> = {
  OH: "アウトサイド",
  MB: "ミドルブロッカー",
  OP: "オポジット",
  S: "セッター",
  L: "リベロ",
};
```

Player detail removes `player-detail__identity-mark` and the 250-300px hero. Target layout:

- compact back row;
- name / grade / Japanese position / height / overall;
- five ability summaries in dense two-column rows;
- condition / fatigue / morale / trust / role;
- concerns only when present;
- career details below the first viewport.

`PlayerTile` becomes text-first and removes the decorative initials identity mark. Do not substitute a silhouette or generated avatar.

Team section labels become Japanese: `チーム編成`, `先発6人`, `リベロ`, `ベンチ`, `交代設定`.

- [ ] **Step 1: Write PlayerHub RED tests for Japanese positions and absence of identity-mark hero.**

- [ ] **Step 2: Write TeamSelection RED assertions that visible English section labels are absent while existing replacement/lock controls still work.**

- [ ] **Step 3: Write PlayerTile RED test proving no image/initial avatar node is rendered and Japanese position is shown.**

- [ ] **Step 4: Run RED.**

```bash
npx vitest run tests/unit/features/team tests/unit/ui/PlayerTile.test.tsx
```

- [ ] **Step 5: Implement compact presentation and CSS.**

Preserve all existing team-selection persistence and safety behavior.

- [ ] **Step 6: Run GREEN and typecheck.**

```bash
npx vitest run tests/unit/features/team tests/unit/ui/PlayerTile.test.tsx
npm run typecheck
```

- [ ] **Step 7: Commit.**

```bash
git add src/ui src/features/team src/mobile-layout.css tests/unit/features/team tests/unit/ui
git commit -m "feat: compact player and team mobile UI"
```

---

### Task 12: Sweep User-Visible English Across Primary Game Screens

**Files:**

- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/training/TrainingScreen.tsx`
- Modify: `src/features/match/MatchScreen.tsx`
- Modify: `src/features/match/MatchPvpEntry.tsx`
- Modify: `src/features/match/MatchOfficialEntry.tsx`
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/TeamScreen.tsx`
- Modify: `src/features/tournament/TournamentScreen.tsx`
- Modify: `src/features/more/MoreScreen.tsx`
- Modify: other `src/features/**/*.tsx` only when a player-visible decorative English label is found.
- Create: `tests/unit/features/japaneseUiLabels.test.tsx`

**Forbidden decorative labels in representative rendered screens:**

```ts
const forbidden = [
  "YEAR",
  "NEXT ACTION",
  "WEEK PROGRESS",
  "PLAYER ROSTER",
  "MATCH ROSTER",
  "STARTING SIX",
  "SUBSTITUTES",
  "SAFETY POLICY",
  "PRACTICE MATCH",
  "LINEUP CHECK",
  "MATCH LIVE",
  "BRACKET",
  "WEEKLY DEVELOPMENT",
  "CURRENT PLAN",
  "WEEKLY REPORT",
  "OFFICIAL TOURNAMENT",
  "NEXT MATCH",
  "ONLINE ARENA",
  "RATED",
  "MANAGEMENT",
];
```

`VS` may remain only when it is semantically part of a compact score matchup rather than decorative English copy; `HOME`/`AWAY` must not be shown as team labels.

- [ ] **Step 1: Create a RED representative-render test that finds the current labels.**

Render Home, Training, Match/Practice entry, Team, Tournament, and More through the existing App/test harness where practical. The test should fail if any forbidden exact label is visible.

- [ ] **Step 2: Run RED.**

```bash
npx vitest run tests/unit/features/japaneseUiLabels.test.tsx
```

- [ ] **Step 3: Remove/translate the labels without renaming internal discriminators.**

Use meaningful Japanese headings, not arbitrary empty spans.

- [ ] **Step 4: Run GREEN plus all feature tests.**

```bash
npx vitest run tests/unit/features
npm run typecheck
```

- [ ] **Step 5: Commit.**

```bash
git add src/features tests/unit/features/japaneseUiLabels.test.tsx
git commit -m "feat: localize primary game UI to Japanese"
```

---

### Task 13: Remove Legacy Manual Weekly Actions and Guard PvP Isolation

**Files:**

- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify: `src/domain/calendar/weekProgression.ts` only if legacy completion helpers become unused.
- Modify: `src/app/GameApp.tsx`
- Modify: `tests/unit/worker/actionSchema.test.ts`
- Modify: `tests/unit/worker/applyGameAction.test.ts`
- Modify: `tests/unit/worker/pvpDynamicsLeakage.test.ts`
- Modify: `tests/unit/worker/buildPvpSimulationState.test.ts`

After all browser/UI callers use the new flow, remove action variants:

```ts
{ type: "training" }
{ type: "practice-match" }
{ type: "official-match" }
```

No browser can execute these phases independently after Phase 8.

PvP isolation must explicitly clear weekly state in the synthetic simulation state even though frozen DTOs already project only school/players/selection:

```ts
state.weeklySchedule = {
  ...state.weeklySchedule,
  practiceMatch: {
    incomingOffer: null,
    outgoingCandidates: [],
    scheduledOpponentId: null,
    scheduledBy: null,
  },
  recentPracticeMatches: [],
  latestReport: null,
};
```

Better still, if ranked simulation does not require weekly state at all, add a dedicated neutral weekly schedule factory for PvP rather than copying challenger schedule metadata. Do not delete `teamDynamics` from `GameState` if the type requires it; existing ranked readiness isolation remains the controlling behavior.

- [ ] **Step 1: Add RED schema tests proving legacy action payloads are rejected.**

- [ ] **Step 2: Extend PvP leakage test with sentinel weekly data.**

Assert published/frozen/public DTO serialization does not contain `weeklySchedule`, `incomingOffer`, `outgoingCandidates`, `scheduledOpponentId`, `latestReport`, `recentPracticeMatches`, or automatic-rest metadata. Compare ranked simulation results for otherwise identical states with radically different weekly schedule/report content and assert equal results.

- [ ] **Step 3: Run RED where appropriate.**

```bash
npx vitest run tests/unit/worker/actionSchema.test.ts tests/unit/worker/applyGameAction.test.ts tests/unit/worker/pvpDynamicsLeakage.test.ts tests/unit/worker/buildPvpSimulationState.test.ts
```

- [ ] **Step 4: Remove legacy cases and add the smallest PvP neutralization/guard required.**

Delete completion-marker dependencies only after a repository search proves no remaining production caller uses them. Keep generic calendar history if needed by old save migration; do not erase old serialized IDs solely for cleanup.

- [ ] **Step 5: Run Worker/PvP suites and typecheck.**

```bash
npx vitest run tests/unit/worker tests/unit/domain/pvp
npm run typecheck
```

- [ ] **Step 6: Commit.**

```bash
git add worker/game src/domain/calendar/weekProgression.ts src/app/GameApp.tsx tests/unit/worker
git commit -m "refactor: enforce atomic weekly actions"
```

---

### Task 14: Mobile E2E, Long-Run Verification, README, and Release Gate

**Files:**

- Modify: `tests/e2e/home-match-flow.spec.ts`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts`
- Modify: `tests/e2e/official-tournament-flow.spec.ts`
- Create: `tests/e2e/weekly-game-loop.spec.ts`
- Create: `tests/unit/domain/weekly/weeklyCycleLongRun.test.ts`
- Modify: `README.md`
- Create: `docs/superpowers/implementation-progress/2026-08-30-phase8-mobile-game-loop.md`

**E2E required flows:**

1. **Training plan persistence** — open `育成`, change plan, save, switch tabs/reload, plan remains.
2. **Incoming practice offer** — accept when fixture provides one, Home shows scheduled opponent.
3. **Outgoing practice request** — request an available candidate, observe deterministic accept/reject UI.
4. **Weekly advance** — Home `次の週へ` executes training/rest/practice atomically and shows weekly report.
5. **Optional replay** — when report contains a match, `試合詳細を見る` opens the existing computed match presentation without a second simulation/action.
6. **Automatic rest** — E2E fixture with fatigue 65+ shows player in rest preview/report and excludes them from practice participation.
7. **Official week** — due official match requires confirmation and completes training + official + week progression in one action.
8. **Tournament views** — `自校ルート` and `全体表` have no page/body horizontal overflow.
9. **Player detail** — at 390x844, identity/abilities/condition area is visible without the old giant hero; no image/initial-character hero.
10. **Japanese UI** — primary tested screens do not display the forbidden decorative English labels.

**Viewport matrix:** `320x800`, `360x800`, `390x844`, `480x900`.

Long-run unit verification:

- 30 academic years, identical seed -> canonical weekly report/history/reputation/tournament state equality;
- 100 academic years -> practice history <=12, weekly report single-summary only, no stuck scheduled match across official weeks, no unbounded transient offer/candidate accumulation;
- user roster remains valid through graduation/intake and carried training plan always references current roster after rollover.

README update must include:

- Milestone `V2 Phase 8 mobile weekly game loop`;
- Phase 7 Team Dynamics summary;
- Phase 8 weekly planning/rest/practice-match summary;
- serialized GameState schema v5 and v4->v5 migration;
- no new Supabase table migration for Phase 8;
- optional-auth local mode: missing browser Supabase public settings starts local session mode;
- local fallback currently uses `sessionStorage`, therefore reload persistence is supported but closing the browser/tab is not guaranteed to preserve the session;
- Phase 8 mobile bracket is vertical/no horizontal bracket requirement;
- existing production dependency audit and known nonblocking warnings must not be described as fixed unless verification proves otherwise.

- [ ] **Step 1: Rewrite/add E2E tests before final UI verification and confirm at least the newly changed assertions fail against pre-Phase8 behavior if run on the old commit.**

- [ ] **Step 2: Add 30-year/100-year weekly-cycle tests.**

Use deterministic fixtures and avoid real-time waits/network.

- [ ] **Step 3: Run the focused long-run tests.**

```bash
npx vitest run tests/unit/domain/weekly/weeklyCycleLongRun.test.ts tests/unit/domain/tournament/tournamentLongRun.test.ts
```

Expected: PASS after Tasks 1-13.

- [ ] **Step 4: Run all mobile E2E.**

```bash
npm run build:e2e
npm run test:e2e
```

Expected: PASS at all supported viewport widths with no body/document horizontal overflow.

- [ ] **Step 5: Update README and implementation-progress document with only verified behavior.**

- [ ] **Step 6: Run the full release gate.**

```bash
npm run verify
npm run test:e2e
```

Expected:

- formatting PASS;
- lint PASS;
- TypeScript PASS;
- architecture guard PASS;
- production dependency audit gate PASS under the repository’s existing threshold;
- unit tests PASS;
- production build PASS;
- Playwright mobile E2E PASS.

Record but do not misrepresent any nonblocking npm vulnerability count, Vite chunk-size warning, or GitHub Actions runtime deprecation warning that remains.

- [ ] **Step 7: Commit.**

```bash
git add tests/e2e tests/unit/domain/weekly/weeklyCycleLongRun.test.ts README.md docs/superpowers/implementation-progress/2026-08-30-phase8-mobile-game-loop.md
git commit -m "test: verify Phase 8 weekly mobile loop"
```

---

## Final Verification Checklist

Before opening/merging the Phase 8 implementation PR, verify all of the following from fresh command output:

- [ ] `CURRENT_GAME_SCHEMA_VERSION === 5` and v4 saves migrate without rerolling world/player/school/randomCursor data.
- [ ] Training settings persist and carry forward across weeks/rollovers with deterministic repair.
- [ ] Fatigue 64 participates; fatigue 65 rests.
- [ ] Condition 36 participates; condition 35 rests.
- [ ] Injured players rest.
- [ ] Resting players do not train or play practice matches and receive extra approved recovery.
- [ ] Practice planning is deterministic and does not mutate randomCursor merely by viewing/reloading.
- [ ] At most one practice match can be scheduled/resolved per normal week.
- [ ] Official weeks do not allow practice scheduling.
- [ ] Practice growth uses exact approved repeat/strength constants and bounded history.
- [ ] One `advance-week` operation resolves the normal weekly transaction without intermediate persisted phases.
- [ ] Official confirmation resolves training + official match + week advance atomically.
- [ ] Shop training boost is consumed exactly once inside the weekly cycle.
- [ ] Pending events retain explicit player-choice semantics.
- [ ] Ranked PvP does not expose/apply weekly transient metadata.
- [ ] Home is the compact weekly command center and no longer requires manual training completion.
- [ ] Training screen is a plan editor, not an execution screen.
- [ ] Practice Match screen is invitation/application planning, not unlimited manual match execution.
- [ ] Player detail has no large character/initial hero.
- [ ] Tournament default is vertical user route; full bracket is vertical and page-level horizontal scrolling is absent.
- [ ] Primary user-visible decorative English labels are removed/translated.
- [ ] Position labels are Japanese in player-facing UI.
- [ ] 320/360/390/480 px E2E has no body/document horizontal overflow.
- [ ] 30-year deterministic and 100-year bounded weekly-cycle tests pass.
- [ ] `npm run verify` passes.
- [ ] `npm run test:e2e` passes.
