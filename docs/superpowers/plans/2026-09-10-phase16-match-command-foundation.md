# Phase 16 Match Command Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic resumable match-command domain foundation for Phase 16 so a match can stop at bounded coaching decisions, accept one validated match-local command, and resume from the exact stored random cursor without precomputing future rallies.

**Architecture:** Keep the existing one-shot `simulateMatch()` API as a compatibility wrapper for current callers, but move interactive progression onto the same rally core. `MatchState` remains the single serializable source of in-match truth through `GameState.activeMatch`; new runtime fields are optional for schema-v8 compatibility. Interactive progression is enabled only when a controlled school is supplied, so existing practice/official/PvP callers remain behaviorally unchanged until PR16-2/PR16-3 integrate the new session API.

**Tech Stack:** React 19 project domain layer, TypeScript 5.9, Vitest 4, deterministic `SeededRandom`, existing volleyball rally simulator.

**Spec:** `docs/superpowers/specs/2026-09-10-phase16-match-command-design.md`

## Global Constraints

- Keep `CURRENT_GAME_SCHEMA_VERSION = 8`.
- Never precompute events beyond an unresolved human `coach-decision`.
- Persistent normal `teamSelection` and `School.tactics` must never be mutated by match commands.
- Randomness resumes only from `MatchState.randomSeed` + `MatchState.randomCursor`.
- Four consecutive opponent points create at most one opponent-run decision per set.
- A non-final set creates one set-break decision before the next set starts.
- Timeout is opponent-run only, max once per set, +4% decision / +5% mental for the next five completed rallies or until set end.
- Phase-15 serve/attack/block trade-offs remain the tactical simulation model.
- No fatigue recovery, ranking logic, coach skill tree, realtime PvP, or hidden PvP data is added in PR16-1.
- Existing one-shot match simulation, best-of-three/five scoring, two-point leads, event ordering, and deterministic replay remain compatible.

---

## File Structure

- Modify `src/domain/model/Match.ts` — serializable interactive runtime, high-level command and command-history types.
- Modify `src/domain/match/simulateMatch.ts` — shared rally core plus start/resume interactive session APIs and one-shot compatibility wrapper.
- Create `src/domain/match/applyMatchCommand.ts` — command validation and pure match-local timeout/tactics/substitution/continue state updates.
- Create `tests/unit/domain/match/phase16ResumableMatch.test.ts` — segment boundaries, trigger timing, cursor/determinism and compatibility coverage.
- Create `tests/unit/domain/match/phase16MatchCommands.test.ts` — command validation/effects and non-mutation coverage.
- Modify `docs/PROJECT_CONTEXT.md` only after PR16-1 is green to record that the foundation is implemented while PR16-2 remains next.

---

### Task 1: Match runtime and command model

**Files:**
- Modify: `src/domain/model/Match.ts`
- Test: `tests/unit/domain/match/phase16ResumableMatch.test.ts`

**Interfaces:**
- Produces `MatchCommand`, `CoachDecisionReason`, `MatchCommandRecord`, `MatchRuntimeState`, and optional `MatchState.runtime`.
- Later tasks consume these types directly; no duplicate runtime model is allowed elsewhere.

- [ ] **Step 1: Write the failing model/API test**

Create `tests/unit/domain/match/phase16ResumableMatch.test.ts` with an initial compile/runtime assertion that imports the new public types/API expected by later tasks and proves the current implementation has no resumable entry point. The production change that makes this test pass is the new Phase16 public model/API, not a mock.

```ts
import { describe, expect, it } from "vitest";
import type {
  CoachDecisionReason,
  MatchCommand,
  MatchRuntimeState,
} from "../../../../src/domain/model/Match";
import {
  resumeMatch,
  startMatch,
} from "../../../../src/domain/match/simulateMatch";

describe("Phase16 resumable match API", () => {
  it("exports the high-level resumable match contract", () => {
    const reason: CoachDecisionReason = "opponent-run";
    const command: MatchCommand = { type: "continue" };
    const runtime = null as unknown as MatchRuntimeState;

    expect(reason).toBe("opponent-run");
    expect(command.type).toBe("continue");
    expect(runtime).toBeNull();
    expect(startMatch).toBeTypeOf("function");
    expect(resumeMatch).toBeTypeOf("function");
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
npm test -- tests/unit/domain/match/phase16ResumableMatch.test.ts
```

Expected: FAIL because `MatchCommand`, `CoachDecisionReason`, `MatchRuntimeState`, `startMatch`, and `resumeMatch` do not yet exist.

- [ ] **Step 3: Add the serializable runtime model**

In `src/domain/model/Match.ts`, add:

```ts
import type { MatchTacticPlan } from "../team/matchTactics";

export type CoachDecisionReason = "opponent-run" | "set-break";

export type MatchCommand =
  | { type: "timeout" }
  | { type: "set-match-tactics"; plan: MatchTacticPlan }
  | {
      type: "substitute";
      outgoingPlayerId: PlayerId;
      incomingPlayerId: PlayerId;
    }
  | { type: "continue" };

export interface MatchCommandRecord {
  sequence: number;
  schoolId: SchoolId;
  setNumber: number;
  homeScore: number;
  awayScore: number;
  decisionReason: CoachDecisionReason;
  command: MatchCommand;
  eventSequence: number;
}

export interface MatchRuntimeState {
  controlledSchoolId: SchoolId | null;
  homeScore: number;
  awayScore: number;
  homeTactics: MatchTacticPlan;
  awayTactics: MatchTacticPlan;
  runWinnerSchoolId: SchoolId | null;
  runLength: number;
  opponentRunDecisionConsumed: boolean;
  timeoutUsedSchoolIds: SchoolId[];
  timeoutBoost: {
    schoolId: SchoolId;
    ralliesRemaining: number;
  } | null;
  pendingDecisionReason: CoachDecisionReason | null;
  commandHistory: MatchCommandRecord[];
}
```

Add `runtime?: MatchRuntimeState` to `MatchState`. Keep the old `CoachCommand` type temporarily for compatibility; do not repurpose its low-level variants into the Phase16 UI contract.

- [ ] **Step 4: Add provisional exported entry-point signatures**

In `simulateMatch.ts`, export the exact public shapes so later tests compile:

```ts
export interface MatchStepResult {
  match: MatchState;
  analysis: MatchAnalysis | null;
}

export interface StartMatchInput extends SimulateMatchInput {
  controlledSchoolId: SchoolId;
}

export interface ResumeMatchInput {
  state: GameState;
  match: MatchState;
}

export function startMatch(input: StartMatchInput): MatchStepResult;
export function resumeMatch(input: ResumeMatchInput): MatchStepResult;
```

At this task only, implementations may throw `new Error("Phase16 resumable match progression not implemented")`; Task 2 immediately replaces those throws. This is allowed only because Task 1's acceptance is contract/type availability, not behavior.

- [ ] **Step 5: Run focused tests and existing match tests**

```bash
npm test -- tests/unit/domain/match/phase16ResumableMatch.test.ts tests/unit/domain/match/simulateMatch.test.ts
```

Expected: PASS for the API contract plus all existing match tests.

- [ ] **Step 6: Commit**

```bash
git add src/domain/model/Match.ts src/domain/match/simulateMatch.ts tests/unit/domain/match/phase16ResumableMatch.test.ts
git commit -m "feat: add Phase16 match command runtime model"
```

---

### Task 2: Resumable deterministic simulation and decision triggers

**Files:**
- Modify: `src/domain/match/simulateMatch.ts`
- Modify: `tests/unit/domain/match/phase16ResumableMatch.test.ts`

**Interfaces:**
- Consumes `MatchRuntimeState` and `MatchStepResult` from Task 1.
- Produces working `startMatch(input)` and `resumeMatch(input)` that stop only at `coach-decision` or `match-complete`.
- `simulateMatch(input)` remains the non-interactive compatibility wrapper.

- [ ] **Step 1: Add RED tests for segment boundaries**

Add deterministic tests using existing game fixtures/helpers already used by `simulateMatch.test.ts`:

1. `startMatch` with `controlledSchoolId` eventually returns either an opponent-run `coach-decision`, set-break `coach-decision`, or `match-complete`; when it stops at a decision, the final event in `eventLog` is the event that caused the decision and no later event exists.
2. Four consecutive points by the opponent in the same set open exactly one `opponent-run` decision.
3. Three consecutive opponent points do not open the run decision.
4. A completed non-final set writes `set-end` then stops at `set-break`; the next set has not started yet.
5. A completed final set writes `match-end` and returns analysis without a set-break decision.
6. Calling `resumeMatch` while the match is still `coach-decision` throws without changing the stored cursor; a command must be applied first.

Use a small deterministic seed search helper in test code only when a precise rally sequence is needed. Bound the search to a finite set and assert the chosen seed is found.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/unit/domain/match/phase16ResumableMatch.test.ts
```

Expected: FAIL because the Task-1 entry points still throw / do not segment simulation.

- [ ] **Step 3: Refactor the existing rally loop into a resumable core**

Keep current rally probability functions in `simulateMatch.ts`. Introduce private helpers with responsibilities equivalent to:

```ts
function createInitialMatchState(input: SimulateMatchInput, controlledSchoolId: SchoolId | null): MatchState;
function runUntilBoundary(state: GameState, match: MatchState): MatchStepResult;
function beginNextSet(match: MatchState): MatchState;
function updateRunAfterPoint(match: MatchState, winnerSchoolId: SchoolId): void;
function shouldOpenOpponentRunDecision(match: MatchState): boolean;
```

Initialize `runtime.homeTactics` / `runtime.awayTactics` with `deriveMatchTacticPlan()` from the actual schools used by the simulation. Store current set score in `runtime.homeScore/awayScore`; completed sets stay in `match.sets`.

`runUntilBoundary` must instantiate randomness strictly as:

```ts
const random = new SeededRandom(match.randomSeed, match.randomCursor);
```

After every generated rally, assign `match.randomCursor = random.cursor` before checking whether a decision boundary should stop the segment.

- [ ] **Step 4: Apply exact decision timing**

After each `point` event:

- update `runWinnerSchoolId` / `runLength`;
- if the winner is the opponent of `runtime.controlledSchoolId`, run length reaches 4, and `opponentRunDecisionConsumed === false`, transition to:

```ts
match.phase = "coach-decision";
match.pendingCoachCommandForSchoolId = runtime.controlledSchoolId;
match.runtime.pendingDecisionReason = "opponent-run";
```

Do not append any future rally after that transition.

At set completion:

- append `set-end`;
- update set wins and `match.sets`;
- clear timeout boost because set end expires it;
- if the match is complete, append `match-end`, set `phase = "match-complete"`, clear pending fields, and return final analysis;
- otherwise set `phase = "coach-decision"`, `pendingDecisionReason = "set-break"`, and stop before the next set begins.

- [ ] **Step 5: Preserve non-interactive compatibility**

Implement `simulateMatch(input)` on the same core with `controlledSchoolId = null`. With no human-controlled school, opponent-run and set-break pauses are bypassed and the wrapper runs to `match-complete` in one call. Do not add command events/history during this compatibility path.

- [ ] **Step 6: GREEN tests**

```bash
npm test -- tests/unit/domain/match/phase16ResumableMatch.test.ts tests/unit/domain/match/simulateMatch.test.ts tests/unit/domain/match/phase15TacticalTradeoffs.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/match/simulateMatch.ts tests/unit/domain/match/phase16ResumableMatch.test.ts
git commit -m "feat: make match simulation resumable"
```

---

### Task 3: High-level coach command validation and match-local effects

**Files:**
- Create: `src/domain/match/applyMatchCommand.ts`
- Create: `tests/unit/domain/match/phase16MatchCommands.test.ts`
- Modify: `src/domain/match/simulateMatch.ts`

**Interfaces:**
- Consumes `MatchCommand`, `CoachDecisionReason`, `MatchRuntimeState`.
- Produces:

```ts
export class MatchCommandValidationError extends Error {
  constructor(public readonly code: string, message: string);
}

export interface ApplyMatchCommandInput {
  state: GameState;
  match: MatchState;
  schoolId: SchoolId;
  command: MatchCommand;
}

export function applyMatchCommand(input: ApplyMatchCommandInput): MatchState;
```

- [ ] **Step 1: Add RED validation/effect tests**

Cover each behavior separately:

- rejects when phase is not `coach-decision`;
- rejects a school other than `pendingCoachCommandForSchoolId`;
- timeout is rejected at `set-break`;
- timeout is accepted at `opponent-run`, records one `timeout` event/history item, sets five rallies of boost, and cannot be used twice in the set;
- tactics command replaces only `runtime.homeTactics` or `runtime.awayTactics` for the commanding side;
- substitution rejects a non-court outgoing player or non-bench incoming player;
- a valid substitution updates rotation, serving order when required, bench membership, persists in the match, and passes `validateTeamSelection` against an isolated game-state view;
- `continue` changes no lineup/tactics;
- every accepted command clears pending decision fields and moves to a resumable phase;
- every rejected command leaves match object and cursor deeply unchanged.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/unit/domain/match/phase16MatchCommands.test.ts
```

Expected: FAIL because `applyMatchCommand` does not exist.

- [ ] **Step 3: Implement pure command validation**

Implement command handling without consuming randomness. Every function starts from `structuredClone(input.match)`; invalid commands throw before returning a modified state.

Accepted-command common behavior:

```ts
runtime.commandHistory.push({
  sequence: runtime.commandHistory.length + 1,
  schoolId,
  setNumber: match.currentSetNumber,
  homeScore: runtime.homeScore,
  awayScore: runtime.awayScore,
  decisionReason: runtime.pendingDecisionReason!,
  command: structuredClone(command),
  eventSequence: match.eventLog.length,
});

match.pendingCoachCommandForSchoolId = null;
runtime.pendingDecisionReason = null;
```

For an opponent-run decision, set `opponentRunDecisionConsumed = true` after any accepted command. For a set-break decision, reset per-set run/timeout-consumption state when the next set is started by `resumeMatch`, not inside command validation.

- [ ] **Step 4: Implement timeout**

Timeout rules:

```ts
runtime.timeoutBoost = { schoolId, ralliesRemaining: 5 };
runtime.timeoutUsedSchoolIds = [...runtime.timeoutUsedSchoolIds, schoolId];
```

Append one `timeout` event at the current set/current score with `detailCode = "timeout.coach-command"`. Do not touch player fatigue, condition, growth, morale, or persistent player data.

- [ ] **Step 5: Implement tactics change**

Update only the commanding side's runtime categorical plan:

```ts
runtime.homeTactics = structuredClone(command.plan);
// or awayTactics
```

Do not modify `state.schools[schoolId].tactics`.

- [ ] **Step 6: Implement substitution**

Clone the commanding side `TeamSelection`. Swap exactly one current rotation player with exactly one current bench player. Replace the outgoing player in serving order if present. Replace bench membership so the outgoing player becomes bench and incoming leaves bench. Keep libero unchanged unless it was already unrelated; Phase16 does not implement libero-specific manual substitution.

Validate the resulting selection with existing `validateTeamSelection`. On success, write it only into `match.homeSelection` or `match.awaySelection` and append one `substitution` event with incoming as actor, outgoing as target, and `detailCode = "substitution.coach-command"`.

- [ ] **Step 7: Resume-phase semantics**

After an accepted opponent-run command, set `match.phase = "set-in-progress"`.

After an accepted set-break command, set `match.phase = "set-complete"`; `resumeMatch` recognizes this and calls `beginNextSet()` before simulating the next rally.

- [ ] **Step 8: GREEN tests**

```bash
npm test -- tests/unit/domain/match/phase16MatchCommands.test.ts tests/unit/domain/match/phase16ResumableMatch.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/domain/match/applyMatchCommand.ts src/domain/match/simulateMatch.ts tests/unit/domain/match/phase16MatchCommands.test.ts
git commit -m "feat: apply Phase16 match commands"
```

---

### Task 4: Timeout stabilization, tactics projection, and deterministic resume

**Files:**
- Modify: `src/domain/match/simulateMatch.ts`
- Modify: `tests/unit/domain/match/phase16ResumableMatch.test.ts`
- Modify: `tests/unit/domain/match/phase16MatchCommands.test.ts`

**Interfaces:**
- Consumes `runtime.timeoutBoost` and runtime `MatchTacticPlan` values.
- Produces simulation effects that apply only to future rallies.

- [ ] **Step 1: Add RED effect tests**

Add fixed-seed tests proving:

- a timeout affects only rallies after the timeout event;
- the boost lasts at most five completed rallies and the counter decreases once per completed rally, not once per random draw/event;
- decision effective ability receives `1.04`, mental receives `1.05`, all other abilities receive no timeout multiplier;
- set end clears remaining timeout boost;
- a `set-match-tactics` command changes future rally behavior through the existing Phase15 model and does not rewrite prior events;
- same initial state/seed plus same ordered command sequence yields identical scores, event log, command history and final cursor;
- at least one deterministic fixture demonstrates two different valid command sequences producing a different future event/result, without asserting that one tactic is globally superior.

- [ ] **Step 2: Verify RED**

```bash
npm test -- tests/unit/domain/match/phase16ResumableMatch.test.ts tests/unit/domain/match/phase16MatchCommands.test.ts
```

Expected: FAIL because runtime plans/timeout boost are not yet applied inside rally calculations.

- [ ] **Step 3: Project runtime tactics onto isolated rally schools**

Before a rally is simulated, build side-local school values by applying the runtime categorical plan to the base school with existing `applyMatchTacticPlan`. Do not mutate `GameState.schools`.

The current rally continues to use existing Phase15 `deriveMatchTacticPlan`, attack/block matchup, and serve profiles against those isolated school values.

- [ ] **Step 4: Apply timeout ability multipliers**

Change effective-ability evaluation to accept match context. For players belonging to `runtime.timeoutBoost.schoolId` while `ralliesRemaining > 0`:

- `decision` effective ability multiplier: `1.04`;
- `mental` effective ability multiplier: `1.05`;
- otherwise multiplier: `1`.

Preserve current condition/injury readiness calculation and clamp effective ability to existing safety range before downstream probability use.

- [ ] **Step 5: Decrement boost once after each rally**

After one rally completes and exactly one point has been awarded, decrement `ralliesRemaining`. Clear at zero. At set end clear it regardless of remaining value.

- [ ] **Step 6: GREEN deterministic tests**

```bash
npm test -- tests/unit/domain/match/phase16ResumableMatch.test.ts tests/unit/domain/match/phase16MatchCommands.test.ts tests/unit/domain/match/phase15TacticalTradeoffs.test.ts tests/unit/domain/match/simulateMatch.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/match/simulateMatch.ts tests/unit/domain/match/phase16ResumableMatch.test.ts tests/unit/domain/match/phase16MatchCommands.test.ts
git commit -m "feat: apply match-local command effects"
```

---

### Task 5: One-shot compatibility, non-mutation, and PR16-1 verification

**Files:**
- Modify: `tests/unit/domain/match/phase16ResumableMatch.test.ts`
- Modify if needed: `src/domain/match/simulateMatch.ts`
- Modify: `docs/PROJECT_CONTEXT.md`

**Interfaces:**
- Produces a PR16-1 foundation that current callers can adopt incrementally in PR16-2/PR16-3.

- [ ] **Step 1: Add compatibility RED/guard tests**

Cover:

- `simulateMatch(input)` still returns a completed `SimulateMatchResult` with non-null analysis;
- same fixed seed and input remain deterministic;
- input `GameState`, `homeSelection`, and `awaySelection` remain unmodified;
- interactive `startMatch`/`resumeMatch` never modify input game state or persistent school tactics;
- interactive match-local substitutions never modify input persistent team selection;
- completed best-of-three/five matches retain legal target/two-point-lead behavior;
- event sequence remains contiguous and every rally still produces exactly one point event;
- runtime command history does not appear in ordinary one-shot compatibility matches.

- [ ] **Step 2: Run full focused domain suite**

```bash
npm test -- tests/unit/domain/match
```

Expected: PASS.

- [ ] **Step 3: Run full quality gate**

```bash
npm run verify
```

Expected: PASS: format, lint, typecheck, unit/integration tests and production build.

- [ ] **Step 4: Update durable project context**

In `docs/PROJECT_CONTEXT.md`, change Phase16 from one-line future roadmap text to a concise status note:

- PR16-1 foundation provides resumable deterministic match sessions and high-level command domain effects;
- current production flows still use the compatibility one-shot path until PR16-2/PR16-3 integration;
- PR16-2 Interactive Match Command UX is next;
- schema remains v8.

Do not mark all Phase16 complete.

- [ ] **Step 5: Final diff review**

Check changed files and confirm:

- no UI scope leaked into PR16-1;
- no worker official/PvP finalization rewrite leaked into PR16-1;
- no save-schema bump;
- no persistent lineup/tactics mutation;
- no precomputed events beyond a user decision;
- no random-cursor change on rejected commands;
- no fatigue recovery;
- no temporary workflow/debug files.

- [ ] **Step 6: PR/CI**

Open Draft PR `feat: add Phase 16 match command foundation`. Require exact-head `dependency-audit`, `quality`, and `mobile-e2e` GREEN. After final review mark ready, merge with expected head SHA, then verify the `main` push CI is fully GREEN before starting PR16-2.
