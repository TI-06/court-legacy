# Phase 11 Home-driven Week Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Home's `次の週へ進む` the only normal PvE execution entry point, keep match playback visible before week completion, and redesign the training-result sheet for clear light-surface readability.

**Architecture:** Extend the authoritative `advance-week` worker action into a small progression state machine that composes the existing training/practice/official match functions. Return a typed, presentation-safe match payload that includes display metadata for transient guest tournament opponents. `GameApp` owns only transient playback navigation; server state remains authoritative. Training and Match tabs keep setup/reference/PvP functions but remove normal PvE start actions.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4, Testing Library, Playwright, existing Cloudflare worker action pipeline.

**Spec:** `docs/superpowers/specs/2026-08-31-phase11-home-week-progression-design.md`

## Global Constraints

- Do not change training formulas, match simulation balance, tournament qualification, or PvP execution semantics.
- Do not add a new persistence schema unless a persisted field becomes unavoidable; current design should not need one.
- Normal PvE execution must happen only through `advance-week`; standalone worker actions may remain for compatibility/tests.
- A progression step resolves at most one match and never advances the date in the same response as a newly resolved match.
- Official matches take priority over scheduled practice matches.
- If any official match involving the user is recorded on the current game date, skip the scheduled practice match for that date when the official chain ends.
- Match playback must support official guest representatives without persisting guest schools/players.
- Repeated operation IDs must return the exact persisted response without duplicating training notifications or match history.
- PvP remains manually started from Match.
- Training-result sheet readable text must be at least 12px and must not horizontally overflow at 320/360/390/414/480px.
- Full `npm run verify` and full mobile E2E must be green before merge; post-merge `main` CI must also be green.

---

### Task 1: Define the shared weekly progression outcome and make `advance-week` authoritative

**Files:**
- Create: `src/domain/calendar/advanceWeekOutcome.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify: `tests/unit/worker/applyGameAction.test.ts`
- Modify: `tests/unit/worker/deferredTrainingPlan.test.ts`
- Modify: `tests/unit/worker/officialMatchAction.test.ts`

**Interfaces:**

```ts
export interface MatchTeamPresentation {
  schoolId: SchoolId;
  displayName: string;
  shortName: string;
}

export interface PendingMatchPresentation {
  kind: "practice" | "official";
  simulation: SimulateMatchResult;
  homeTeam: MatchTeamPresentation;
  awayTeam: MatchTeamPresentation;
  official?: {
    tournamentId: string;
    circuit: TournamentCircuit;
    level: TournamentLevel;
    round: TournamentRound;
  };
}

export interface AdvanceWeekOutcome {
  trainingResult?: TrainingResult;
  pendingMatchPresentation: PendingMatchPresentation | null;
  weekAdvanced: boolean;
  academicYearTransition: AcademicYearTransitionSummary | null;
  recoveredPlayerIds: PlayerId[];
  healedPlayerIds: PlayerId[];
}
```

- [ ] **Step 1: Write RED tests for practice progression**

In `applyGameAction.test.ts`, schedule a practice opponent and call `advance-week`.

Assert:

```ts
expect(result.state.date).toBe(snapshot.state.date);
expect(isWeeklyActionCompleted(result.state, "training")).toBe(true);
expect(isWeeklyActionCompleted(result.state, "practice-match")).toBe(true);
expect(result.state.history.matches).toHaveLength(historyBefore + 1);
expect(result.outcome).toMatchObject({
  weekAdvanced: false,
  pendingMatchPresentation: { kind: "practice" },
});
```

Then build a snapshot from the returned state and call `advance-week` again. Assert the date advances, the history count does not increase, and the training notification is not duplicated.

- [ ] **Step 2: Write RED tests for official progression and priority**

Update the official action tests so a due official match is resolved by `advance-week` rather than rejected. Assert one authoritative result is persisted and returned as `pendingMatchPresentation.kind === "official"` with date unchanged.

Also schedule a practice opponent on the same official week. After the official chain finishes, call `advance-week` and assert the week advances while `practice-match` remains incomplete and no practice history row is created for that date.

- [ ] **Step 3: Add guest-safe presentation metadata coverage**

Use an existing national/guest official fixture (or construct the smallest deterministic one already supported by official tournament tests). Assert `pendingMatchPresentation.homeTeam/awayTeam` carry the guest display/short name even though the guest school is absent from the persisted `result.state.schools`.

- [ ] **Step 4: Run focused worker tests and verify RED**

Run:

```bash
npm test -- tests/unit/worker/applyGameAction.test.ts tests/unit/worker/deferredTrainingPlan.test.ts tests/unit/worker/officialMatchAction.test.ts
```

Expected: failures specifically show that `advance-week` still blocks official matches / skips practice execution / lacks the new outcome contract.

- [ ] **Step 5: Implement the shared contract**

Create `advanceWeekOutcome.ts` with the interfaces above. Do not put React types in this domain module.

- [ ] **Step 6: Implement progression helpers in `applyGameAction.ts`**

Add a persisted-history helper:

```ts
function hasUserOfficialMatchOnCurrentDate(state: GameState): boolean {
  return state.history.matches.some(
    (match) =>
      match.date === state.date &&
      match.tournamentId !== null &&
      (match.homeSchoolId === state.userSchoolId ||
        match.awaySchoolId === state.userSchoolId),
  );
}
```

Add small converters that build `PendingMatchPresentation` from `applyPracticeMatch` and `applyOfficialMatch` outcomes. For official guest teams use due entrant metadata, not `state.schools` lookup.

Refactor `applyAdvanceWeek` in this order:

1. resolve training + notification if incomplete;
2. if `hasRequiredOfficialMatch(currentState)`, call `applyOfficialMatch(currentState, teamSelection)`, return one official presentation and `weekAdvanced:false`;
3. else if a practice opponent is scheduled, practice is incomplete, and no user official match exists on `currentState.date`, call `applyPracticeMatch`, return practice presentation and `weekAdvanced:false`;
4. otherwise call `advanceGameWeek`, surface event, and return `weekAdvanced:true` with no pending match.

Do not catch nested rule conflicts and convert them to silent skips.

- [ ] **Step 7: Run focused worker tests and verify GREEN**

Run the command from Step 4.

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/calendar/advanceWeekOutcome.ts worker/game/applyGameAction.ts tests/unit/worker/applyGameAction.test.ts tests/unit/worker/deferredTrainingPlan.test.ts tests/unit/worker/officialMatchAction.test.ts
git commit -m "feat: drive pve matches through week progression"
```

---

### Task 2: Make match playback consume progression output and continue the week

**Files:**
- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/match/MatchScreen.tsx`
- Modify: `src/features/match/matchPresentation.ts`
- Modify: `tests/unit/features/match/MatchFlow.test.tsx`
- Modify: `tests/unit/features/match/AppMatchFlow.test.tsx`

**Interfaces:**
- Consumes: `AdvanceWeekOutcome`, `PendingMatchPresentation`.
- `MatchScreen` becomes playback-only.

- [ ] **Step 1: Write RED playback tests**

Refactor the test fixture to build a `PendingMatchPresentation` and assert:

```tsx
fireEvent.click(screen.getByRole("button", { name: "結果まで進む" }));
expect(screen.getByRole("button", { name: "結果を確認して次へ" })).toBeVisible();
fireEvent.click(screen.getByRole("button", { name: "結果を確認して次へ" }));
expect(onContinue).toHaveBeenCalledOnce();
```

Add a guest-opponent presentation fixture whose away school does not exist in `state.schools`; rendering result/playback must not throw and must display the supplied guest team name.

- [ ] **Step 2: Run match UI tests and verify RED**

Run:

```bash
npm test -- tests/unit/features/match/MatchFlow.test.tsx tests/unit/features/match/AppMatchFlow.test.tsx
```

Expected: FAIL because `MatchScreen` still has pre-match `試合開始` flow and no continuation callback.

- [ ] **Step 3: Extend match event presentation for transient team names**

Add optional `schoolDisplayNames` to `MatchPresentationContext`. Resolve winner/team names from that map before `state.schools`. Keep unknown player fallback as `選手`.

- [ ] **Step 4: Refactor `MatchScreen` to playback-only**

Use props similar to:

```ts
interface MatchScreenProps {
  state: GameState;
  presentation: PendingMatchPresentation;
  reducedMotion: boolean;
  onContinue: () => void;
}
```

Remove pre-match preparation/start UI from this component. Use presentation `homeTeam`/`awayTeam` for scoreboard and winner labels. Replace `ホームへ戻る` on the completed result with `結果を確認して次へ` invoking `onContinue`.

- [ ] **Step 5: Refactor `GameApp.advanceWeek()`**

Replace the client-local old `AdvanceWeekOutcome` with the shared domain type and add:

```ts
const [activeMatchPresentation, setActiveMatchPresentation] =
  useState<PendingMatchPresentation | null>(null);
```

After `advance-week`:
- if `pendingMatchPresentation`, set it, update `latestMatchResult`, clear bracket/PvP transient view, and navigate to Match playback;
- if `weekAdvanced`, clear active match presentation, apply year transition state, and return Home.

Remove `startPracticeMatch` and `startOfficialMatch` from normal UI wiring. Match result continuation calls the same `advanceWeek()`.

- [ ] **Step 6: Run match UI tests and verify GREEN**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/GameApp.tsx src/features/match/MatchScreen.tsx src/features/match/matchPresentation.ts tests/unit/features/match/MatchFlow.test.tsx tests/unit/features/match/AppMatchFlow.test.tsx
git commit -m "feat: continue weekly progression from match playback"
```

---

### Task 3: Make Match and Tournament tabs setup/reference-only for PvE

**Files:**
- Modify: `src/features/match/PracticeMatchPlanning.tsx`
- Modify: `src/features/tournament/TournamentScreen.tsx`
- Modify: `tests/unit/features/tournament/TournamentScreen.test.tsx`
- Delete or rewrite: `tests/unit/features/tournament/TournamentPendingStatus.test.tsx`
- Modify: `src/app/GameApp.tsx` if Task 2 did not already remove obsolete props.

- [ ] **Step 1: Write RED reference-only tests**

For a due official state assert:

```tsx
expect(screen.queryByRole("button", { name: /公式戦を開始/ })).toBeNull();
expect(
  screen.getByText(/ホームの「次の週へ進む」から試合を開始/),
).toBeVisible();
```

For a scheduled practice state assert the planning card says the match is executed from Home and no `試合開始` button exists.

- [ ] **Step 2: Run tournament/match integration tests and verify RED**

Run:

```bash
npm test -- tests/unit/features/tournament/TournamentScreen.test.tsx tests/unit/features/match/AppMatchFlow.test.tsx
```

Expected: FAIL on the old official-start UI / old scheduled-practice copy.

- [ ] **Step 3: Remove official execution controls**

Simplify `TournamentScreenProps` to `state`, `circuit`, `level`, `onBack`. Remove `pending`, `trainingCompleted`, `onStartOfficialMatch`, confirmation state, confirmation BottomSheet, and start CTA. For a due user match render a compact informational note that Home will execute it.

- [ ] **Step 4: Update practice planning copy**

For the scheduled opponent card replace `試合準備へ` with `ホームの「次の週へ進む」で実施` (or equivalent exact copy used by tests). Offers and outgoing requests remain interactive.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 2 plus any rewritten pending-status test.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/match/PracticeMatchPlanning.tsx src/features/tournament/TournamentScreen.tsx tests/unit/features/tournament/TournamentScreen.test.tsx tests/unit/features/tournament/TournamentPendingStatus.test.tsx src/app/GameApp.tsx
git commit -m "refactor: keep pve match tabs setup only"
```

---

### Task 4: Redesign the training-result BottomSheet for light-surface readability

**Files:**
- Modify: `src/features/home/TrainingResultNotificationSheet.tsx`
- Modify: `src/features/home/training-result-notification.css`
- Modify: `tests/unit/features/home/TrainingResultNotificationSheet.test.tsx`

- [ ] **Step 1: Add RED semantic/style-hook tests**

Keep existing content assertions and add structural assertions for one player card, growth chips, status chips, and injury state:

```tsx
const playerCard = within(dialog)
  .getByText(player.displayName)
  .closest("article");
expect(playerCard).toHaveClass("training-result-notification__player");
expect(within(playerCard!).getByText("怪我あり")).toHaveClass("is-injured");
```

Add a second healthy player or a second fixture and assert `怪我なし` receives `is-healthy`.

- [ ] **Step 2: Run sheet tests and verify RED**

Run:

```bash
npm test -- tests/unit/features/home/TrainingResultNotificationSheet.test.tsx
```

Expected: FAIL on the new healthy/status style hooks.

- [ ] **Step 3: Implement light-surface styles**

Keep `.home-notification-*` dark-panel styles untouched. Replace only `.training-result-notification*` styling with explicit light-surface colors:

- primary text approximately `#203743`;
- muted text approximately `#60727c`;
- cards `#fff` with `#d7e1e5` borders;
- neutral chips `#edf3f5`;
- growth chips orange text/background (`#b94d0a` / `#fff0e5`);
- injury chip red (`#9f3128` / `#ffe7e2`);
- healthy chip green/neutral (`#38614d` / `#e8f3ed`).

Use explicit minimum `font-size:12px`; player name 15–16px; section heading 14–15px. Ensure all flex rows wrap and children use `min-width:0`.

- [ ] **Step 4: Add `is-healthy` in component markup**

The injury chip class must be `is-injured` or `is-healthy`; do not encode status only by color.

- [ ] **Step 5: Run sheet test and verify GREEN**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/home/TrainingResultNotificationSheet.tsx src/features/home/training-result-notification.css tests/unit/features/home/TrainingResultNotificationSheet.test.tsx
git commit -m "fix: improve training result sheet readability"
```

---

### Task 5: Update full mobile E2E, verify, and merge

**Files:**
- Modify: `tests/e2e/home-match-flow.spec.ts`
- Modify: `tests/e2e/official-tournament-flow.spec.ts`
- Modify: `tests/e2e/official-tournament-continuity.spec.ts`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts`
- Keep passing: `tests/e2e/pvp-flow.spec.ts`
- Modify other tests only when failures are direct old-flow assumptions.

- [ ] **Step 1: Update the practice-match E2E path**

Flow:
1. schedule practice from Match;
2. navigate Home;
3. click `次の週へ進む`;
4. expect `試合ダイジェスト` without any `試合開始` click;
5. click `結果まで進む`;
6. click `結果を確認して次へ`;
7. expect Home on the next week and the training notification present.

- [ ] **Step 2: Update official-tournament E2E**

Assert bracket/reference screen has no normal official start button. Return Home, use `次の週へ進む`, and verify official playback/result. Preserve continuity/guest-opponent assertions.

- [ ] **Step 3: Update 320/360/390/414/480 layout audit**

After saving training and scheduling practice, use Home progression to reach playback. Open the Home training-result notification and run the existing overflow audit while the BottomSheet is open at each viewport width.

- [ ] **Step 4: Run focused E2E first**

Run:

```bash
npx playwright test tests/e2e/home-match-flow.spec.ts tests/e2e/official-tournament-flow.spec.ts tests/e2e/official-tournament-continuity.spec.ts tests/e2e/mobile-layout-audit.spec.ts tests/e2e/pvp-flow.spec.ts
```

Expected: all selected tests pass. PvP still starts manually from Match.

- [ ] **Step 5: Run full quality verification**

Run:

```bash
npm run verify
```

Expected: formatting, lint, typecheck, unit tests, production dependency audit, and build all pass.

- [ ] **Step 6: Run full mobile E2E**

Run:

```bash
npm run test:e2e
```

Expected: all Playwright tests pass.

- [ ] **Step 7: Commit E2E updates**

```bash
git add tests/e2e
git commit -m "test: cover home-driven pve progression"
```

- [ ] **Step 8: Confirm clean branch and open non-draft PR**

Compare `main...feature/phase11-home-week-progression`. Ensure no temporary workflow files exist and branch is not behind main. Create a non-draft PR titled `Phase 11: drive PvE progression from Home`.

- [ ] **Step 9: Require fresh PR CI**

Verify PR-head Quality and `mobile-e2e` are both `success`. Do not merge on stale branch-only results.

- [ ] **Step 10: Merge with expected head SHA**

Use the exact verified head SHA in the merge call. Prefer normal merge unless repository settings require otherwise.

- [ ] **Step 11: Verify post-merge `main` CI**

Confirm the merge commit is the `main` head and the new main CI has both Quality and `mobile-e2e` `success` before declaring Phase 11 complete.
