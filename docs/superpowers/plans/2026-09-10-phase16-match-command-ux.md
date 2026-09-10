# Phase 16 Interactive Match Command UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase16 resumable match foundation into a real mobile coaching experience for scheduled practice matches, with bounded decision panels, tactics/substitution commands, safe playback, factual command-impact results, and five-width coverage.

**Architecture:** Keep `MatchState`/`GameState.activeMatch` authoritative and add one high-level server game action for accepted match commands. Scheduled practice matches started through `advance-week` use `startMatch()` and stop at decision boundaries; later `match-command` actions use `applyMatchCommand()` + `resumeMatch()`. `MatchScreen` becomes a controlled presenter for a `MatchStepResult`, revealing only the currently authoritative segment and emitting `MatchCommand` callbacks. Official/PvP session finalization remains unchanged and is deferred to PR16-3.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Testing Library, Playwright, Cloudflare Worker action pipeline, existing `BottomSheet`, Phase15 tactics presentation helpers, Phase16 resumable match domain.

**Spec:** `docs/superpowers/specs/2026-09-10-phase16-match-command-design.md`

## Global Constraints

- Keep `CURRENT_GAME_SCHEMA_VERSION = 8`.
- Never precompute events beyond an unresolved human `coach-decision`.
- Persistent normal `teamSelection` and `School.tactics` must never be mutated by match commands.
- Randomness resumes only from `MatchState.randomSeed` + `MatchState.randomCursor`.
- Human commands are only `timeout`, `set-match-tactics`, `substitute`, and `continue`.
- Timeout is available only for `opponent-run`, max once per set, and keeps the PR16-1 five-rally +4% decision / +5% mental effect.
- `set-break` exposes tactics, substitution, and continue, but not timeout.
- No manual per-rally command UI, fatigue recovery, full FIVB substitution bookkeeping, ranking logic, realtime PvP, or hidden opponent data is added.
- Official tournament interactive finalization and asynchronous PvP command sessions remain PR16-3 scope.
- Existing completed one-shot match presentation remains supported while PR16-3 still has one-shot official/PvP callers.
- Required mobile widths are 320 / 360 / 390 / 414 / 480 px.

---

## File Structure

- Modify `src/domain/calendar/advanceWeekOutcome.ts` — allow pending match presentation to carry incomplete `MatchStepResult` with nullable analysis.
- Modify `worker/game/actionSchema.ts` — add strict high-level `match-command` action schema using the Phase16 `MatchCommand` union.
- Modify `worker/game/applyGameAction.ts` — start scheduled practice matches with `startMatch`, persist `activeMatch`, apply/resume commands, and finalize practice state only at `match-complete`.
- Keep `worker/game/applyServerGameAction.ts` behavior intact unless a focused test proves a change is required; its existing temporary pre-match lineup/tactics projection must continue restoring persistent state after `advance-week`.
- Create `src/features/match/MatchCommandPanel.tsx` — decision CTA surface plus tactics and substitution bottom sheets.
- Create `src/features/match/matchCommandPresentation.ts` — pure labels/factual command-impact derivation.
- Modify `src/features/match/MatchScreen.tsx` — resumable segment playback, decision boundary handling, controlled `onCommand`, current tactic summary, and result command-impact section.
- Modify `src/features/match/match.css` — mobile command panel/sheet/result styling.
- Modify `src/app/GameApp.tsx` — consume incomplete practice presentations and dispatch authoritative `match-command` actions.
- Create `tests/unit/worker/phase16PracticeMatchSession.test.ts` — authoritative start/command/finalization/non-persistence coverage.
- Create `tests/unit/features/match/Phase16MatchCommandUx.test.tsx` — decision UI, sheets, playback boundary and result-impact coverage.
- Create `tests/unit/features/match/matchCommandPresentation.test.ts` — factual impact derivation coverage.
- Modify `tests/unit/features/match/MatchFlow.test.tsx` only where nullable analysis typing requires legacy-complete compatibility assertions.
- Modify `tests/e2e/home-match-flow.spec.ts` — scheduled practice progression now stops for required decisions instead of jumping directly to result.
- Create `tests/e2e/phase16-match-command-ux.spec.ts` — five-width interactive match acceptance.

---

### Task 1: Authoritative resumable practice-match action flow

**Files:**
- Modify: `src/domain/calendar/advanceWeekOutcome.ts`
- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Test: `tests/unit/worker/phase16PracticeMatchSession.test.ts`
- Regression: `tests/unit/worker/phase15MatchTacticsOverride.test.ts`

**Interfaces:**
- Consumes `startMatch({ ..., controlledSchoolId })`, `applyMatchCommand({ state, match, schoolId, command })`, and `resumeMatch({ state, match })` from PR16-1.
- Produces `GameAction = { type: "match-command"; command: MatchCommand }`.
- `PendingMatchPresentation.simulation` becomes `MatchStepResult`; completed `SimulateMatchResult` remains structurally valid.
- A scheduled practice `advance-week` response may now contain an incomplete simulation with `analysis: null` and `state.activeMatch.phase === "coach-decision"`.
- A `match-command` response outcome is a `PendingMatchPresentation` for the same practice match.

- [ ] **Step 1: Write RED tests for the action schema and initial practice boundary**

Add tests that parse all four high-level command variants and reject legacy low-level variants. Start a scheduled practice match through `applyServerGameAction(..., { type: "advance-week" })` and assert:

```ts
expect(outcome.pendingMatchPresentation?.kind).toBe("practice");
expect(outcome.pendingMatchPresentation?.simulation.analysis).toBeNull();
expect(result.state.activeMatch?.phase).toBe("coach-decision");
expect(result.state.activeMatch?.eventLog.at(-1)?.type).not.toBe("match-end");
expect(isWeeklyActionCompleted(result.state, "practice-match")).toBe(false);
expect(result.state.weeklySchedule.practiceMatch.scheduledOpponentId).toBe(opponent.id);
```

Use a bounded seed search when the first boundary can be either `opponent-run` or `set-break`; never alter production probability merely to simplify the test.

- [ ] **Step 2: Run focused tests and verify RED**

Run the worker test file plus Phase15 override regression. Expected failure: `match-command` is unknown and scheduled practice still returns a completed one-shot match.

- [ ] **Step 3: Implement the minimal start-session path**

In `advanceWeekOutcome.ts`, type `simulation` as `MatchStepResult`.

In `actionSchema.ts`, add a strict discriminated `matchCommandSchema`:

```ts
const matchCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("timeout") }).strict(),
  z.object({ type: z.literal("set-match-tactics"), plan: matchTacticPlanSchema }).strict(),
  z.object({
    type: z.literal("substitute"),
    outgoingPlayerId: playerIdSchema,
    incomingPlayerId: playerIdSchema,
  }).strict(),
  z.object({ type: z.literal("continue") }).strict(),
]);
```

Add `{ type: "match-command"; command: MatchCommand }` to schema and `GameAction`.

Refactor only the scheduled-practice path used by `advance-week`: construct the same opponent/id/random input but call `startMatch(..., controlledSchoolId: state.userSchoolId)`, set `state.activeMatch`, synchronize `state.randomCursor`, and return a practice presentation without recording history, marking practice complete, clearing the schedule, or appending recent-opponent history.

Keep the direct legacy `{ type: "practice-match" }` path one-shot unless a focused regression requires it to share the new flow.

- [ ] **Step 4: Verify GREEN for initial session and Phase15 override**

Run the focused tests. Confirm temporary pre-match lineup/tactics still end up inside `activeMatch` while returned persistent `teamSelection`/`School.tactics` remain unchanged through `applyServerGameAction`.

- [ ] **Step 5: Write RED tests for accepted command, continuation, and finalization**

From the returned pending active match:
- submit the matching user command;
- assert same match id, increased command history exactly once, unchanged persistent selection/tactics, and cursor only advances during resumed rallies;
- loop valid `continue` commands until completion;
- assert practice completion/history/schedule clearing/recent practice happen only once at actual `match-complete`;
- assert a command when no active resumable practice match is rejected;
- assert invalid/wrong-state commands do not mutate active match or cursor.

- [ ] **Step 6: Run focused tests and verify RED**

Expected failure: no `match-command` application branch/finalizer exists.

- [ ] **Step 7: Implement command resume/finalization helpers**

Create focused private helpers in `applyGameAction.ts`:
- build a `practicePresentation` from `MatchStepResult`;
- validate that `state.activeMatch` belongs to the current scheduled practice opponent and controlled user school;
- apply one command using `applyMatchCommand`;
- resume using `resumeMatch`;
- persist the returned match and random cursor;
- if `analysis === null`, return without practice finalization;
- if complete, call existing `recordMatchOutcome`, `markWeeklyActionCompleted`, clear schedule, append recent practice exactly once, then return the completed presentation.

Translate `MatchCommandValidationError` into an explicit `GameRuleConflictError` code rather than swallowing it as a generic practice error.

- [ ] **Step 8: Verify GREEN and run related worker regressions**

Run:
- new Phase16 practice session tests;
- `phase15MatchTacticsOverride`;
- existing practice scheduling/action tests;
- existing `applyGameAction` / `gameAction` tests.

- [ ] **Step 9: Commit Task 1**

Commit message:

```text
feat: add resumable practice match actions
```

---

### Task 2: Pure command presentation and decision panel UI

**Files:**
- Create: `src/features/match/matchCommandPresentation.ts`
- Create: `src/features/match/MatchCommandPanel.tsx`
- Modify: `src/features/match/match.css`
- Test: `tests/unit/features/match/matchCommandPresentation.test.ts`
- Test: `tests/unit/features/match/Phase16MatchCommandUx.test.tsx`

**Interfaces:**
- `MatchCommandPanel` consumes `state`, `match`, `pending`, and `onCommand(command: MatchCommand)`.
- It reads only the user's own players plus public/match-local tactic categories.
- It emits one complete `MatchCommand`; it does not simulate or mutate a match.
- `buildMatchCommandImpactRows(state, match)` returns factual presentation rows derived solely from `runtime.commandHistory` and completed event log.

- [ ] **Step 1: Write RED pure-presentation tests**

Cover:
- labels for timeout/tactics/substitution/continue;
- recorded set + score;
- timeout/tactics next-five `point` events split by commanding school vs opponent;
- fewer than five available future points reported as the observed count only;
- substitution label resolves `outgoing → incoming` own-player names;
- no wording contains causal claims such as `効果で`, `逆転させた`, or `成功させた`.

- [ ] **Step 2: Run pure tests and verify RED**

Expected failure: helper does not exist.

- [ ] **Step 3: Implement `matchCommandPresentation.ts` minimally**

Use `MatchCommandRecord.eventSequence` as the boundary, filter subsequent `point` events, and count at most five. Return data, not JSX, so result rendering stays testable and deterministic.

- [ ] **Step 4: Verify pure tests GREEN**

Run the focused helper test.

- [ ] **Step 5: Write RED component tests for opponent-run and set-break panels**

Build resumable fixture matches using real `startMatch()` seed search. Assert opponent-run panel shows:
- `相手に4連続ポイントを許しています`;
- `タイムアウト`, `戦術変更`, `選手交代`, `このまま続ける`.

Assert set-break panel:
- shows `セット間の監督指示`;
- hides timeout;
- uses `このまま次セットへ`.

- [ ] **Step 6: Run component tests and verify RED**

Expected failure: panel component does not exist.

- [ ] **Step 7: Implement decision CTA surface**

Render a compact card, not a modal, at the authoritative decision boundary. Disable all actions while `pending`. Hide timeout when already used or reason is `set-break`.

- [ ] **Step 8: Verify decision CTA tests GREEN**

Run the focused UI test.

- [ ] **Step 9: Commit Task 2**

Commit message:

```text
feat: add match command decision panel
```

---

### Task 3: Tactics and substitution command sheets

**Files:**
- Modify: `src/features/match/MatchCommandPanel.tsx`
- Modify: `src/features/match/match.css`
- Test: `tests/unit/features/match/Phase16MatchCommandUx.test.tsx`

**Interfaces:**
- Reuse `serveTacticOptions`, `attackTacticOptions`, `blockTacticOptions`, and `tacticOptionLabel` from `features/team/tacticsPresentation.ts`.
- Reuse `BottomSheet`.
- Use `getPlayerConditionPresentation`, `calculatePlayerDisplayPower`, and `ratingToGrade` for own-player substitution rows.
- Do not introduce drag-and-drop.

- [ ] **Step 1: Write RED tactics-sheet test**

Click `戦術変更`, assert three tactic groups use the current match-local runtime plan, change all three axes, apply, and assert exactly:

```ts
expect(onCommand).toHaveBeenCalledWith({
  type: "set-match-tactics",
  plan: { serve: "aggressive", attack: "quick", block: "commit" },
});
```

Assert opening/changing draft values alone does not call `onCommand` and cannot write `School.tactics`.

- [ ] **Step 2: Verify RED, then implement minimal tactics sheet**

Use one BottomSheet with tap-safe option buttons and a single `この戦術で続ける` submit action. Keep draft state local to the panel and reset from authoritative runtime plan when reopened after a command result.

- [ ] **Step 3: Verify tactics test GREEN**

Run the focused UI test.

- [ ] **Step 4: Write RED substitution-sheet test**

Click `選手交代`. Assert the first step lists exactly the six current rotation players; each row shows name, preferred position, five-level condition presentation, and A-G overall grade. Select outgoing, then assert the second step lists current bench only. Select incoming and submit; assert exactly one `substitute` command with those IDs.

Also cover cancel/back without command and pending-disabled submit.

- [ ] **Step 5: Verify RED, then implement minimal two-step substitution sheet**

Use one BottomSheet with internal `outgoingPlayerId`/`incomingPlayerId`. Do not expose opponent private ability details. The confirmation area shows only the selected own-player swap.

- [ ] **Step 6: Verify substitution test GREEN and run BottomSheet accessibility regression**

Run the focused UI test plus existing `tests/unit/ui/BottomSheet.test.tsx`.

- [ ] **Step 7: Commit Task 3**

Commit message:

```text
feat: add match tactics and substitution sheets
```

---

### Task 4: Resumable MatchScreen playback and GameApp wiring

**Files:**
- Modify: `src/features/match/MatchScreen.tsx`
- Modify: `src/features/match/match.css`
- Modify: `src/app/GameApp.tsx`
- Test: `tests/unit/features/match/Phase16MatchCommandUx.test.tsx`
- Regression: `tests/unit/features/match/MatchFlow.test.tsx`
- Regression: relevant `tests/unit/app/GameApp*.test.tsx`

**Interfaces:**
- `MatchScreen.result` accepts `MatchStepResult | null` while legacy completed results remain valid.
- Add `onCommand?: (command: MatchCommand) => void | Promise<void>` and `commandPending?: boolean`.
- GameApp dispatches `{ type: "match-command", command }` through `cloudSession.runAction` and adopts the server result already placed in the returned snapshot/outcome.
- Do not call `startMatch`, `resumeMatch`, or `applyMatchCommand` in browser UI code.

- [ ] **Step 1: Write RED test for authoritative segment playback**

Render an incomplete match segment. Assert:
- event counter starts at `1 / current authoritative event count`;
- the command panel is hidden until the current segment's last event has been revealed;
- `次の判断まで進む` reveals only to the segment end and then shows the decision panel;
- no result screen appears while `analysis === null`;
- `再生` stops at the segment end and cannot cross the unresolved decision.

- [ ] **Step 2: Verify RED, then implement minimal MatchScreen segment semantics**

Use actual completion as:

```ts
const authoritativeMatchComplete =
  result.analysis !== null && result.match.phase === "match-complete";
```

Keep a separate `segmentRevealed` condition based on current `eventLog.length`. For an incomplete interactive match, label fast-forward `次の判断まで進む`; for a completed legacy/full match keep `結果まで進む`.

When a later server segment arrives with the same match id and a longer event log, do not reset `visibleEventIndex` to zero. Preserve the previously revealed boundary and reveal new events normally.

- [ ] **Step 3: Verify MatchScreen RED→GREEN and legacy MatchFlow regression**

Confirm existing completed-result playback remains unchanged for one-shot official/PvP compatibility.

- [ ] **Step 4: Write RED test for live tactic summary and command-impact result**

Assert live play displays current runtime serve/attack/block labels. After a completed match with command history, assert `監督采配` appears with factual rows; a completed match with no command history omits it.

- [ ] **Step 5: Implement tactic summary and result-impact section**

Use `tacticOptionLabel`; use `buildMatchCommandImpactRows`; do not invent causal language.

- [ ] **Step 6: Write RED GameApp integration test**

Drive a scheduled practice start from pre-match and mock authoritative server responses:
- first `advance-week` response contains incomplete practice presentation and activeMatch;
- MatchScreen shows the decision after revealing segment;
- clicking continue sends one `{ type: "match-command", command: { type: "continue" } }` through `runAction`/API;
- later incomplete response stays on Match screen;
- final completed response shows result;
- only result continuation calls `advance-week` again to actually advance the calendar.

- [ ] **Step 7: Implement GameApp controlled command wiring**

Store the latest `PendingMatchPresentation` regardless of nullable analysis. Derive `activeMatchResult` from it or widen its type to `MatchStepResult`. Add one `executeMatchCommand` handler that calls `cloudSession.runAction` and replaces presentation from the action outcome. `commandPending` uses existing operation state. Do not add client-side fallback simulation.

- [ ] **Step 8: Verify focused app/UI tests GREEN**

Run Phase16 UX, MatchFlow, AppMatchFlow, GameApp actions/practice scheduling tests.

- [ ] **Step 9: Commit Task 4**

Commit message:

```text
feat: connect interactive practice match UX
```

---

### Task 5: Mobile E2E, compatibility, full verification, and PR completion

**Files:**
- Modify: `tests/e2e/home-match-flow.spec.ts`
- Create: `tests/e2e/phase16-match-command-ux.spec.ts`
- Modify: `docs/PROJECT_CONTEXT.md` only after code/E2E is GREEN

**Interfaces:**
- Browser path must use the real server action flow; no test-only production switches.
- The E2E helper may use deterministic test data/routes already exposed by the existing E2E environment, but must not add a production backdoor.

- [ ] **Step 1: Write/adjust E2E expectation for bounded fast-forward**

Update the existing Home practice test so after pre-match start it repeatedly:
1. clicks `次の判断まで進む` when present;
2. handles a visible decision with `このまま続ける` / `このまま次セットへ`;
3. continues until `試合結果`;
4. confirms result and verifies the week advances only after completion.

This prevents the old `結果まで進む` expectation from silently skipping interactive decisions.

- [ ] **Step 2: Add five-width Phase16 command UX E2E**

For 320/360/390/414/480:
- schedule/start a real practice match;
- reach at least one deterministic decision (set-break is guaranteed before a non-final next set);
- assert decision controls are visible and no horizontal overflow;
- open tactics sheet and assert all three axes/actions fit without horizontal overflow or bottom-nav collision;
- open substitution sheet, assert court/bench rows are reachable and sheet does not create page-level horizontal overflow;
- continue and eventually reach result.

Add a deterministic opponent-run/timeout path when the existing E2E seed reliably reaches one. If the default seed does not, create the fixture through existing test initialization data rather than weakening production trigger rules.

- [ ] **Step 3: Run focused E2E and verify GREEN**

Run the new Phase16 spec and `home-match-flow.spec.ts` across configured Chromium.

- [ ] **Step 4: Run full quality gate**

Run `npm run verify`. Fix only demonstrated formatting/lint/type/test/build failures; do not broaden scope.

- [ ] **Step 5: Run full mobile E2E**

Run `npm run test:e2e` and confirm no regression at the established widths.

- [ ] **Step 6: Review final diff against scope**

Confirm:
- schema stays v8;
- no official/PvP interactive finalization was added;
- no browser-side simulation authority;
- no persistent teamSelection/School.tactics mutation from commands;
- no future rally precomputation past a decision;
- no hidden opponent player data exposed;
- no fatigue-management UI;
- no temporary CI/debug files.

- [ ] **Step 7: Update project handoff after GREEN**

Update `docs/PROJECT_CONTEXT.md` to record PR16-2 Interactive Match Command UX complete and PR16-3 Official/PvP Completion next. Add this plan path under Phase16 docs.

- [ ] **Step 8: Re-run formatting/full verification after docs**

The docs change modifies the final tree, so rerun the exact final quality/CI gate.

- [ ] **Step 9: Mark PR ready, merge with expected head SHA, and verify main push CI**

Do not claim PR16-2 complete until `dependency-audit`, `quality`, and `mobile-e2e` are GREEN for the final PR tree and again for the merged main SHA.
