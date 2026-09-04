# Phase 12 Game Loop Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Training top-level flow with player-centric weekly training and a School tab, make condition—not fatigue—the active form mechanic, surface practice-match decisions on Home, clarify lineup roles, and provide blocking operation feedback for mobile gameplay.

**Architecture:** Keep all game mutations server-authoritative through the existing `set-training-plan`, practice-offer, team-selection, and `advance-week` actions. Preserve the serialized `WeeklyPlan` object shape for compatibility (`teamTrainingMenuId` remains as a legacy compatibility field), but make Phase 12 growth come from player-specific instructions and allow any roster-size assignment list; missing player assignments resolve to `instruction.overall`. Add small pure presentation helpers for condition and training labels so domain logic, match simulation, and React screens share one definition.

**Tech Stack:** TypeScript, React 19, Zod, Vitest + Testing Library, Playwright, Cloudflare Worker action layer, existing CSS modules/global feature CSS.

**Spec:** `docs/superpowers/specs/2026-09-01-phase12-game-loop-navigation-design.md`

## Global Constraints

- Bottom navigation must be exactly `ホーム | 選手 | 学校 | 試合 | その他`.
- School owns `設備 | スカウト | 記録 | 卒業生`; School/Scouting must not remain duplicated under `その他` or the removed Training tab.
- Player-facing training choices are exactly `全体 | 攻撃 | 守備 | 跳躍 | 体力 | 休養`.
- `休養` applies `condition +25`, clamped to 0–100, and applies no normal ability growth.
- Condition remains an internal 0–100 number and is rendered as five colored face states. Match modifiers are `+8% / +4% / 0% / -4% / -8%`.
- Use bands `85–100 絶好調`, `65–84 好調`, `40–64 普通`, `20–39 不調`, `0–19 絶不調`.
- Weekly condition gets a small deterministic seeded fluctuation during week progression.
- `fatigue` remains decodable for legacy saves but must not affect Phase 12 training, matches, auto-rest, or injury probability.
- Injury probability uses training/menu risk, player injury resistance, relevant facility effect, and current condition; it remains deterministic.
- Incoming practice-match offers are actionable from Home.
- Authoritative mutations expose a blocking full-screen operation state and prevent duplicate navigation/input while submitting.
- Normal CI must be green before merge to `main`.

---

### Task 1: Centralize five-stage condition presentation and match modifiers

**Files:**

- Create: `src/domain/player/playerCondition.ts`
- Modify: `src/domain/selectors/playerPresentation.ts`
- Modify: `src/domain/match/simulateMatch.ts`
- Test: `tests/unit/domain/selectors/playerPresentation.test.ts`
- Test: `tests/unit/domain/match/simulateMatch.test.ts`

**Interfaces:**

- Produces: `type PlayerConditionLevel = "excellent" | "good" | "normal" | "poor" | "terrible"`.
- Produces: `getPlayerConditionPresentation(condition: number): { level; label; icon; colorToken; matchMultiplier }`.
- Produces: `getConditionMatchMultiplier(condition: number): number` returning `1.08 | 1.04 | 1 | 0.96 | 0.92`.
- `simulateMatch` consumes `getConditionMatchMultiplier()` and no longer reads `player.fatigue` in readiness.

- [ ] **Step 1: Write failing condition-band tests**

Add table-driven assertions to `tests/unit/domain/selectors/playerPresentation.test.ts`:

```ts
import { getPlayerConditionPresentation } from "../../../src/domain/player/playerCondition";

it.each([
  [100, "絶好調", 1.08],
  [85, "絶好調", 1.08],
  [84, "好調", 1.04],
  [65, "好調", 1.04],
  [64, "普通", 1],
  [40, "普通", 1],
  [39, "不調", 0.96],
  [20, "不調", 0.96],
  [19, "絶不調", 0.92],
  [0, "絶不調", 0.92],
])("maps condition %i", (condition, label, multiplier) => {
  const result = getPlayerConditionPresentation(condition);
  expect(result.label).toBe(label);
  expect(result.matchMultiplier).toBe(multiplier);
});
```

- [ ] **Step 2: Run the focused selector test and verify RED**

Run: `npx vitest run tests/unit/domain/selectors/playerPresentation.test.ts`

Expected: FAIL because `src/domain/player/playerCondition.ts` does not exist.

- [ ] **Step 3: Implement the pure condition helper**

Create `src/domain/player/playerCondition.ts` with one clamping function and the exact five bands. Use stable UI tokens rather than inline CSS colors:

```ts
export type PlayerConditionLevel =
  "excellent" | "good" | "normal" | "poor" | "terrible";

export interface PlayerConditionPresentation {
  level: PlayerConditionLevel;
  label: "絶好調" | "好調" | "普通" | "不調" | "絶不調";
  icon: "😄" | "🙂" | "😐" | "☹️" | "😣";
  colorToken: "red" | "green" | "yellow" | "blue" | "purple";
  matchMultiplier: 1.08 | 1.04 | 1 | 0.96 | 0.92;
}

export function getPlayerConditionPresentation(
  rawCondition: number,
): PlayerConditionPresentation {
  /* exact threshold mapping */
}

export function getConditionMatchMultiplier(condition: number): number {
  return getPlayerConditionPresentation(condition).matchMultiplier;
}
```

Re-export/use the helper from player presentation code where screen presentation already depends on that module.

- [ ] **Step 4: Add a match regression test proving fatigue is irrelevant**

In `tests/unit/domain/match/simulateMatch.test.ts`, build two otherwise identical seeded match inputs whose selected players differ only in `fatigue` (`0` vs `100`). Assert the simulation result/analysis is identical. Add a second assertion that changing condition from a normal-band value to an excellent-band value changes effective readiness in the expected direction under the same seed.

- [ ] **Step 5: Run the focused match test and verify RED**

Run: `npx vitest run tests/unit/domain/match/simulateMatch.test.ts`

Expected: FAIL because current readiness includes `(100 - player.fatigue) / 100`.

- [ ] **Step 6: Replace readiness fatigue math with the condition multiplier**

In `src/domain/match/simulateMatch.ts`, keep the existing injury penalty but make readiness condition-driven:

```ts
function readiness(player: Player): number {
  const injuryPenalty = player.injury ? 0.58 : 1;
  return getConditionMatchMultiplier(player.condition) * injuryPenalty;
}
```

Do not remove `fatigue` from `Player`; persistence compatibility is intentional.

- [ ] **Step 7: Run focused tests and commit**

Run:
`npx vitest run tests/unit/domain/selectors/playerPresentation.test.ts tests/unit/domain/match/simulateMatch.test.ts`

Expected: PASS.

Commit:

```bash
git add src/domain/player/playerCondition.ts src/domain/selectors/playerPresentation.ts src/domain/match/simulateMatch.ts tests/unit/domain/selectors/playerPresentation.test.ts tests/unit/domain/match/simulateMatch.test.ts
git commit -m "feat: make condition drive match readiness"
```

---

### Task 2: Replace old individual instructions with the six Phase 12 choices

**Files:**

- Modify: `src/data/individualTrainingInstructions.ts`
- Modify: `src/domain/validation/gameDataSchema.ts`
- Test: `tests/unit/data/individualTrainingInstructions.test.ts`

**Interfaces:**

- Produces IDs: `instruction.overall`, `instruction.attack`, `instruction.defense`, `instruction.jump`, `instruction.fitness`, `instruction.rest`.
- The existing `IndividualTrainingInstructionDefinition` remains the data contract; `fatigue` remains present only as compatibility metadata and is set to `0` for all six Phase 12 definitions.
- `instruction.rest` is identified by the `rest` tag and is handled specially by Task 3.

- [ ] **Step 1: Replace catalog expectations with exactly six approved choices**

Update `tests/unit/data/individualTrainingInstructions.test.ts` to assert:

```ts
expect(
  individualTrainingInstructions.map(({ id, name }) => ({ id, name })),
).toEqual([
  { id: "instruction.overall", name: "全体" },
  { id: "instruction.attack", name: "攻撃" },
  { id: "instruction.defense", name: "守備" },
  { id: "instruction.jump", name: "跳躍" },
  { id: "instruction.fitness", name: "体力" },
  { id: "instruction.rest", name: "休養" },
]);
expect(individualTrainingInstructions.every((item) => item.fatigue === 0)).toBe(
  true,
);
```

Also assert `instruction.rest.tags` contains `rest`.

- [ ] **Step 2: Run the catalog test and verify RED**

Run: `npx vitest run tests/unit/data/individualTrainingInstructions.test.ts`

Expected: FAIL because the catalog still contains spike/serve/receive/setting/block/mental.

- [ ] **Step 3: Define the six menu records**

Use the existing ability vocabulary with these targets:

```ts
// overall: spike, receive, serve (resolver spreads balanced growth across all abilities)
// attack: spike, serve, decision
// defense: receive, block, speed
// jump: jump, block, spike
// fitness: stamina, speed, mental
// rest: mental (baseGrowth is schema-minimum 1, but resolver skips growth for rest)
```

Set all `fatigue: 0`. Keep non-rest `injuryRisk` low/moderate and `rest` risk at `0`.

- [ ] **Step 4: Run catalog/schema tests and commit**

Run:
`npx vitest run tests/unit/data/individualTrainingInstructions.test.ts tests/unit/data/gameDataSchema.test.ts`

Expected: PASS.

Commit:

```bash
git add src/data/individualTrainingInstructions.ts src/domain/validation/gameDataSchema.ts tests/unit/data/individualTrainingInstructions.test.ts
git commit -m "feat: add Phase 12 player training choices"
```

---

### Task 3: Make weekly training player-centric, rest-based, and fatigue-independent

**Files:**

- Modify: `src/domain/training/resolveWeeklyTraining.ts`
- Modify: `src/domain/training/trainingSafety.ts`
- Modify: `src/domain/weekly/createWeeklySchedule.ts`
- Modify: `src/domain/weekly/weeklyScheduleTypes.ts`
- Modify: `src/domain/weekly/autoRest.ts`
- Test: `tests/unit/domain/training/resolveWeeklyTraining.test.ts`
- Test: `tests/unit/domain/training/phase8AutomaticRestTraining.test.ts`
- Test: `tests/unit/domain/training/trainingSafety.test.ts`
- Test: `tests/unit/domain/weekly/autoRest.test.ts`

**Interfaces:**

- `WeeklyPlan` retains `{ teamTrainingMenuId: string; individualAssignments: IndividualTrainingAssignment[] }` for save compatibility.
- `teamTrainingMenuId` becomes a compatibility field; Phase 12 ability growth is driven by each player's individual instruction.
- Missing roster assignments resolve as `instruction.overall`.
- `resolveWeeklyTraining()` applies `instruction.rest` as no growth plus `condition +25` before bounded weekly fluctuation.
- Weekly condition fluctuation uses the existing injected `RandomSource`; use an integer delta in `[-4, +4]` so seeded tests are stable.
- Training result fatigue deltas are `0`; `Player.fatigue` is copied unchanged.

- [ ] **Step 1: Write failing resolver tests for rest and default-all-player behavior**

Add tests that create a school roster of at least three active players and pass assignments for only one player:

```ts
const plan: WeeklyPlan = {
  teamTrainingMenuId: "training.spike",
  individualAssignments: [
    { playerId: player1.id, instructionId: "instruction.rest" },
  ],
};
```

Assert:

- validation accepts assignment counts other than exactly two;
- player1 gets no ability growth and condition rises by 25 plus only the deterministic weekly fluctuation;
- unassigned active players resolve with `instruction.overall` growth;
- every player's `fatigue` equals pre-training fatigue;
- changing only fatigue in the input does not change growth/injury outcome with the same seeded random values.

- [ ] **Step 2: Run resolver tests and verify RED**

Run: `npx vitest run tests/unit/domain/training/resolveWeeklyTraining.test.ts`

Expected: FAIL on the exactly-two validation and fatigue-dependent calculations.

- [ ] **Step 3: Rewrite weekly plan validation and resolver semantics**

In `resolveWeeklyTraining.ts`:

- remove the `length !== 2` guard;
- reject duplicate player IDs and unknown/non-roster player IDs as today;
- find the assigned instruction or fall back to `instruction.overall`;
- do not use team-menu target weights to award growth;
- treat `instruction.overall` as balanced growth across `ABILITY_KEYS` using its base growth budget;
- if the instruction is `instruction.rest`, skip growth and injury roll, apply `+25` condition;
- otherwise compute injury risk from instruction/menu base risk, `injuryResistance`, facility modifier, and condition only;
- apply `Math.floor(random.next() * 9) - 4` as the weekly condition drift after the instruction-specific effect;
- leave `fatigue` unchanged and report `fatigueChange: 0`.

Keep deterministic random-consumption order explicit in the function so tests can pin it.

- [ ] **Step 4: Remove fatigue-triggered automatic resting**

Update `autoRest.ts` so it no longer rests a healthy player because of fatigue. Injury can still force non-training participation; low condition should not silently override the user's chosen instruction. Update `weeklyScheduleTypes.ts` so new reports no longer emit `reason: "fatigue"`; retain decoder compatibility in persistence in Task 4.

- [ ] **Step 5: Make safety logic fatigue-free**

Update `trainingSafety.ts` so no multiplier or branch reads `player.fatigue`. Keep player injury resistance and relevant facility/safety effects only where they still serve the approved injury formula.

- [ ] **Step 6: Create default assignments for the whole current roster**

Change `createDefaultWeeklyPlan()` to map `school.playerIds`:

```ts
return {
  teamTrainingMenuId: "training.spike",
  individualAssignments: school.playerIds.map((playerId) => ({
    playerId,
    instructionId: "instruction.overall",
  })),
};
```

The compatibility team menu ID must not affect Phase 12 growth.

- [ ] **Step 7: Run the weekly training suite and commit**

Run:
`npx vitest run tests/unit/domain/training/resolveWeeklyTraining.test.ts tests/unit/domain/training/phase8AutomaticRestTraining.test.ts tests/unit/domain/training/trainingSafety.test.ts tests/unit/domain/weekly/autoRest.test.ts`

Expected: PASS.

Commit:

```bash
git add src/domain/training/resolveWeeklyTraining.ts src/domain/training/trainingSafety.ts src/domain/weekly/createWeeklySchedule.ts src/domain/weekly/weeklyScheduleTypes.ts src/domain/weekly/autoRest.ts tests/unit/domain/training/resolveWeeklyTraining.test.ts tests/unit/domain/training/phase8AutomaticRestTraining.test.ts tests/unit/domain/training/trainingSafety.test.ts tests/unit/domain/weekly/autoRest.test.ts
git commit -m "feat: make weekly training player centric"
```

---

### Task 4: Preserve save/action compatibility for roster-size assignments

**Files:**

- Modify: `src/persistence/gameStateCodec.ts`
- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Test: `tests/unit/persistence/gameStateCodec.test.ts`
- Test: `tests/unit/persistence/phase10GameStateMigration.test.ts`
- Test: `tests/unit/worker/deferredTrainingPlan.test.ts`
- Test: `tests/unit/worker/applyGameAction.test.ts`

**Interfaces:**

- Persistence accepts legacy two-assignment saves and new zero-to-roster-size assignment arrays.
- No schema-version bump is required solely for broadening the allowed assignment-array length.
- `set-training-plan` continues to be the only authoritative mutation used by player training chips.

- [ ] **Step 1: Add persistence tests for old and new plans**

In `gameStateCodec.test.ts`, keep an explicit legacy sample with two assignments and add a current sample with more than two assignments. Assert both decode/encode.

Also assert a legacy `fatigue` number round-trips unchanged so Phase 12 does not corrupt existing saves.

- [ ] **Step 2: Run codec tests and verify RED**

Run: `npx vitest run tests/unit/persistence/gameStateCodec.test.ts tests/unit/persistence/phase10GameStateMigration.test.ts`

Expected: new multi-assignment test FAILS because `weeklyPlanSchema.individualAssignments` is `.length(2)`.

- [ ] **Step 3: Broaden persisted plan validation without deleting legacy fatigue fields**

Change the persisted weekly plan schema to:

```ts
individualAssignments: z.array(
  z.object({
    playerId: z.string().min(1),
    instructionId: z.string().min(1),
  }).strict(),
).max(64),
```

Keep existing fatigue fields in old notification/report schemas where needed for decoder compatibility. New Phase 12 production code should write `0` deltas rather than using fatigue gameplay semantics.

- [ ] **Step 4: Add worker tests for saving a full-roster plan**

Update `deferredTrainingPlan.test.ts` so `set-training-plan` stores three-or-more assignments and `advance-week` resolves them later. Verify the saved instruction IDs survive the server round trip.

- [ ] **Step 5: Run worker tests and implement only schema/validation changes required**

Run:
`npx vitest run tests/unit/worker/deferredTrainingPlan.test.ts tests/unit/worker/applyGameAction.test.ts`

Expected: PASS after the resolver/persistence changes; if `applyGameAction` still assumes two assignments, replace that assumption with `validateWeeklyPlan()` and the roster-size plan.

- [ ] **Step 6: Commit compatibility changes**

```bash
git add src/persistence/gameStateCodec.ts worker/game/actionSchema.ts worker/game/applyGameAction.ts tests/unit/persistence/gameStateCodec.test.ts tests/unit/persistence/phase10GameStateMigration.test.ts tests/unit/worker/deferredTrainingPlan.test.ts tests/unit/worker/applyGameAction.test.ts
git commit -m "fix: support roster size weekly training plans"
```

---

### Task 5: Put condition and individual training directly on the Player screen and clarify lineup roles

**Files:**

- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/TeamScreen.tsx`
- Modify: `src/features/team/player-hub.css`
- Modify: `src/features/team/team-direct.css`
- Modify: `src/app/GameApp.tsx`
- Test: `tests/unit/features/team/PlayerHubScreen.test.tsx`
- Test: `tests/unit/features/team/TeamSelectionFlow.test.tsx`

**Interfaces:**

- `PlayerHubScreen` gains `trainingPending: boolean` and `onChangeTraining(playerId: PlayerId, instructionId: string): void`.
- `GameApp` builds the next `WeeklyPlan` from `gameState.weeklySchedule.trainingPlan`, replacing/adding one player's assignment, and passes it to existing `saveTrainingPlan()`.
- Training chip text comes from the six catalog entries; unknown legacy IDs render safely as `全体` until explicitly changed.
- Condition display consumes `getPlayerConditionPresentation()`.

- [ ] **Step 1: Add failing PlayerHub rendering tests**

Assert a roster row shows:

- position abbreviation such as `OH`;
- colored accessible condition label such as `好調` instead of raw `状態 81`;
- the active training chip such as `全体`;
- no `疲労` text.

Add an interaction test:

```ts
await user.click(screen.getByRole("button", { name: /田中 拓海.*全体/ }));
await user.click(screen.getByRole("button", { name: "攻撃" }));
expect(onChangeTraining).toHaveBeenCalledWith(playerId, "instruction.attack");
```

- [ ] **Step 2: Run PlayerHub tests and verify RED**

Run: `npx vitest run tests/unit/features/team/PlayerHubScreen.test.tsx`

Expected: FAIL because the screen has no training chooser and still renders numeric condition.

- [ ] **Step 3: Add compact training chip + BottomSheet chooser**

Render each player row with a right-side compact chip (`全体`, `攻撃`, `守備`, `跳躍`, `体力`, `休養`). Tapping it opens the existing `BottomSheet` with all six full choices. Disable choices while `trainingPending` or weekly training is completed.

Use CSS custom/state classes such as:

```css
.player-condition--red {
  /* token-backed red state */
}
.player-condition--green {
  /* token-backed green state */
}
.player-condition--yellow {
  /* token-backed yellow state */
}
.player-condition--blue {
  /* token-backed blue state */
}
.player-condition--purple {
  /* token-backed purple state */
}
```

Keep the current mobile screen width/density; no horizontal scrolling.

- [ ] **Step 4: Wire one-player plan updates through `GameApp.saveTrainingPlan`**

Add a helper in `GameApp.tsx`:

```ts
const changePlayerTraining = async (
  playerId: PlayerId,
  instructionId: string,
) => {
  const current = gameState.weeklySchedule.trainingPlan;
  const withoutPlayer = current.individualAssignments.filter(
    (assignment) => assignment.playerId !== playerId,
  );
  await saveTrainingPlan({
    ...current,
    individualAssignments: [...withoutPlayer, { playerId, instructionId }],
  });
};
```

Pass `trainingPending={cloudSession.operation.status === "submitting"}` and the handler into `PlayerHubScreen`.

- [ ] **Step 5: Add lineup-context tests**

Update `TeamSelectionFlow.test.tsx` to assert the replacement sheet shows the target slot as secondary context and prominently shows the current/candidate player's preferred position and overall. Do not label a rotation slot itself as a fixed volleyball role.

- [ ] **Step 6: Implement role-first replacement context**

In `TeamScreen.tsx`, change titles/content from an ambiguous `ローテーション3の選手を選択` to a persistent context block such as:

```text
変更する枠: ローテーション3
現在: 田中 拓海  OH  総合43
```

Candidate rows prominently show `S / OH / MB / OP / L`, then overall, then current assignment state. Keep rotation number as supporting text.

- [ ] **Step 7: Run team feature tests and commit**

Run:
`npx vitest run tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/features/team/TeamSelectionFlow.test.tsx`

Expected: PASS.

Commit:

```bash
git add src/features/team/PlayerHubScreen.tsx src/features/team/TeamScreen.tsx src/features/team/player-hub.css src/features/team/team-direct.css src/app/GameApp.tsx tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/features/team/TeamSelectionFlow.test.tsx
git commit -m "feat: move training controls into player management"
```

---

### Task 6: Replace Training navigation with School and move Scouting under School

**Files:**

- Modify: `src/ui/shell/appNavigation.ts`
- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/school/SchoolScreen.tsx`
- Modify: `src/features/school/school-screen.css`
- Modify: `src/features/more/MoreScreen.tsx`
- Test: `tests/unit/ui/shell/BottomGameNav.test.tsx`
- Test: `tests/unit/features/school/SchoolScreen.test.tsx`
- Test: `tests/unit/features/more/MoreScreen.test.tsx`
- Test: `tests/unit/app/GameApp.scouting.test.tsx`

**Interfaces:**

- `AppTab = "home" | "team" | "school" | "match" | "more"`.
- `SchoolScreen` gains `onOpenScouting(): void`.
- GameApp uses `scoutingOpen` only while `activeTab === "school"`; ScoutingScreen's existing API/recruitment logic remains unchanged.
- `MoreView` becomes `"menu" | "shop"`.

- [ ] **Step 1: Write failing navigation tests**

In `BottomGameNav.test.tsx`, assert the rendered labels equal exactly:

```ts
["ホーム", "選手", "学校", "試合", "その他"];
```

and assert no `育成` tab exists.

- [ ] **Step 2: Run nav tests and verify RED**

Run: `npx vitest run tests/unit/ui/shell/BottomGameNav.test.tsx`

Expected: FAIL because `appNavigation.ts` still defines `training`/`育成`.

- [ ] **Step 3: Change the AppTab contract and GameApp routing**

Update `APP_NAVIGATION`, remove TrainingScreen/TrainingScoutingEntry imports and render branches, route `activeTab === "school"` to School/Scouting, and update `changeTab()` to close scouting when leaving `school`.

- [ ] **Step 4: Add School/More/Scouting failing tests**

Assert School exposes four segment actions `設備`, `スカウト`, `記録`, `卒業生`; clicking `スカウト` calls `onOpenScouting`. Assert More no longer renders a School entry. Update GameApp scouting test to navigate through bottom tab `学校` then `スカウト`.

- [ ] **Step 5: Implement compact School layout and scouting segment**

Keep SchoolScreen focused on facilities/records/alumni, with `スカウト` delegating to `onOpenScouting`. Compress facility cards into a mobile grid/list with name, `Lv.n`, next cost/status, and one `強化` target; keep details in the existing BottomSheet. Do not duplicate ScoutingScreen internals.

- [ ] **Step 6: Remove School from More**

Delete `onOpenSchool` from `MoreScreen` and the `moreView === "school"` GameApp branch. Keep Shop and account/sign-out behavior unchanged.

- [ ] **Step 7: Run navigation/scouting tests and commit**

Run:
`npx vitest run tests/unit/ui/shell/BottomGameNav.test.tsx tests/unit/features/school/SchoolScreen.test.tsx tests/unit/features/more/MoreScreen.test.tsx tests/unit/app/GameApp.scouting.test.tsx`

Expected: PASS.

Commit:

```bash
git add src/ui/shell/appNavigation.ts src/app/GameApp.tsx src/features/school/SchoolScreen.tsx src/features/school/school-screen.css src/features/more/MoreScreen.tsx tests/unit/ui/shell/BottomGameNav.test.tsx tests/unit/features/school/SchoolScreen.test.tsx tests/unit/features/more/MoreScreen.test.tsx tests/unit/app/GameApp.scouting.test.tsx
git commit -m "feat: make school a primary game tab"
```

---

### Task 7: Surface incoming practice offers on Home

**Files:**

- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/home.css`
- Modify: `src/app/GameApp.tsx`
- Test: `tests/unit/features/home/HomeScreen.test.tsx`
- Test: `tests/unit/app/GameApp.practiceScheduling.test.tsx`

**Interfaces:**

- `HomeScreen` gains `onAcceptPracticeOffer`, `onDeclinePracticeOffer`, and `operationPending` props.
- It reads `state.weeklySchedule.practiceMatch.incomingOffer` and opponent school data already present in state.
- The existing worker actions `practice-offer-accept` and `practice-offer-decline` remain unchanged.

- [ ] **Step 1: Add failing Home offer tests**

Render Home with an incoming offer and assert:

```ts
expect(screen.getByText("練習試合の申し込み")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "受ける" })).toBeEnabled();
expect(screen.getByRole("button", { name: "断る" })).toBeEnabled();
```

Click each in separate tests and verify callbacks. Re-render with `operationPending` and assert both buttons are disabled.

- [ ] **Step 2: Run Home tests and verify RED**

Run: `npx vitest run tests/unit/features/home/HomeScreen.test.tsx`

Expected: FAIL because Home does not expose incoming-offer actions.

- [ ] **Step 3: Implement the actionable Home card**

Place the offer in the current-week action region before ordinary quick links. Show school name plus compact growth/load ratings and `断る` / `受ける` buttons. If an opponent is already scheduled, render the existing scheduled state instead of an offer card.

- [ ] **Step 4: Wire existing GameApp callbacks**

Pass `acceptPracticeOffer`, `declinePracticeOffer`, and `cloudSession.operation.status === "submitting"` to HomeScreen. Do not create new API routes.

- [ ] **Step 5: Run Home/App scheduling tests and commit**

Run:
`npx vitest run tests/unit/features/home/HomeScreen.test.tsx tests/unit/app/GameApp.practiceScheduling.test.tsx`

Expected: PASS.

Commit:

```bash
git add src/features/home/HomeScreen.tsx src/features/home/home.css src/app/GameApp.tsx tests/unit/features/home/HomeScreen.test.tsx tests/unit/app/GameApp.practiceScheduling.test.tsx
git commit -m "feat: handle practice offers from home"
```

---

### Task 8: Add blocking full-screen operation feedback

**Files:**

- Create: `src/ui/status/OperationBlockingOverlay.tsx`
- Modify: `src/ui/status/operation-status.css`
- Modify: `src/ui/shell/GamePageFrame.tsx`
- Test: `tests/unit/ui/OperationBlockingOverlay.test.tsx`
- Test: `tests/e2e/v2-operation-feedback.spec.ts`

**Interfaces:**

- `OperationBlockingOverlay` consumes the existing `OperationState` from `useGameSession`.
- When `operation.status === "submitting"`, it renders `role="status"`, `aria-live="polite"`, `aria-busy="true"`, the operation label, spinner, and a full viewport interaction shield.
- For idle/success/offline/error it renders `null`; the existing OperationStatusBar continues to own success/error/retry text.

- [ ] **Step 1: Write the failing component test**

Create `tests/unit/ui/OperationBlockingOverlay.test.tsx`:

```tsx
render(
  <OperationBlockingOverlay
    operation={{ status: "submitting", label: "練習設定を保存しています…" }}
  />,
);
expect(screen.getByRole("status")).toHaveTextContent(
  "練習設定を保存しています…",
);
expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
```

Also assert `idle`, `success`, `offline`, and `error` render no blocking overlay.

- [ ] **Step 2: Run the component test and verify RED**

Run: `npx vitest run tests/unit/ui/OperationBlockingOverlay.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement and mount the overlay at shell level**

Mount `OperationBlockingOverlay` in `GamePageFrame` next to the existing status/header/navigation so every authoritative `runAction` gets the same blocking treatment. CSS must use fixed viewport positioning, safe-area padding, a dim backdrop, spinner animation respecting `prefers-reduced-motion`, and a z-index above sheets/nav while submitting.

- [ ] **Step 4: Extend E2E feedback test**

In `v2-operation-feedback.spec.ts`, delay an action response, click an authoritative action, assert the overlay text appears, assert another navigation/action cannot be activated while pending, release the response, then assert the overlay disappears and normal interaction returns.

- [ ] **Step 5: Run UI tests and commit**

Run:
`npx vitest run tests/unit/ui/OperationBlockingOverlay.test.tsx tests/unit/ui/OperationStatusBar.test.tsx`

Expected: PASS.

Commit:

```bash
git add src/ui/status/OperationBlockingOverlay.tsx src/ui/status/operation-status.css src/ui/shell/GamePageFrame.tsx tests/unit/ui/OperationBlockingOverlay.test.tsx tests/e2e/v2-operation-feedback.spec.ts
git commit -m "feat: block input during game mutations"
```

---

### Task 9: Update week-progression notifications/reports for condition-first gameplay

**Files:**

- Modify: `src/domain/calendar/advanceWeek.ts`
- Modify: `src/domain/notifications/trainingNotifications.ts`
- Modify: `src/persistence/gameStateCodec.ts`
- Test: `tests/unit/domain/weekly/advanceWeek.test.ts`
- Test: `tests/unit/domain/notifications/trainingNotifications.test.ts`
- Test: `tests/unit/worker/phase11WeekProgression.test.ts`

**Interfaces:**

- New weekly results use `fatigueChange: 0` and `totalFatigueChange: 0` only where old persisted notification contracts require those properties.
- User-facing notification copy must not tell players to manage fatigue.
- Weekly condition changes reflect rest plus deterministic drift.

- [ ] **Step 1: Add failing notification/week tests**

Assert an `advance-week` result with a resting player reports condition improvement, does not produce fatigue-based auto-rest wording, and produces zero fatigue deltas in legacy-shaped notification payloads.

- [ ] **Step 2: Run focused tests and verify RED**

Run:
`npx vitest run tests/unit/domain/weekly/advanceWeek.test.ts tests/unit/domain/notifications/trainingNotifications.test.ts tests/unit/worker/phase11WeekProgression.test.ts`

Expected: FAIL anywhere Phase 8/11 still expects fatigue recovery or fatigue warnings.

- [ ] **Step 3: Update report/notification mapping**

Keep persisted compatibility fields but map new resolver results directly. Replace fatigue-centric user copy with condition-centric wording and preserve existing notification IDs/read handling.

- [ ] **Step 4: Re-run focused tests and commit**

Run:
`npx vitest run tests/unit/domain/weekly/advanceWeek.test.ts tests/unit/domain/notifications/trainingNotifications.test.ts tests/unit/worker/phase11WeekProgression.test.ts`

Expected: PASS.

Commit:

```bash
git add src/domain/calendar/advanceWeek.ts src/domain/notifications/trainingNotifications.ts src/persistence/gameStateCodec.ts tests/unit/domain/weekly/advanceWeek.test.ts tests/unit/domain/notifications/trainingNotifications.test.ts tests/unit/worker/phase11WeekProgression.test.ts
git commit -m "feat: report condition first weekly results"
```

---

### Task 10: Mobile/E2E regression and final quality gate

**Files:**

- Modify as failures require: `tests/e2e/app-shell.spec.ts`
- Modify as failures require: `tests/e2e/mobile-layout-audit.spec.ts`
- Modify as failures require: `tests/e2e/scouting-flow.spec.ts`
- Modify as failures require: `tests/e2e/home-match-flow.spec.ts`
- Modify as failures require: feature CSS touched in Tasks 5–8

**Interfaces:**

- No new production interface. This task locks the approved mobile flow and removes stale Training-tab selectors from E2E coverage.

- [ ] **Step 1: Update shell/scouting/home E2E expectations**

Replace selectors that navigate through `育成` with `学校` → `スカウト`, assert the five new bottom labels, and add a Home incoming-offer accept/decline path.

- [ ] **Step 2: Run the mobile layout audit**

Run: `npx playwright test tests/e2e/mobile-layout-audit.spec.ts`

Expected: PASS at the repository's configured mobile viewport set, with no horizontal overflow from condition icons or training chips.

- [ ] **Step 3: Run the critical game-loop E2E set**

Run:
`npx playwright test tests/e2e/app-shell.spec.ts tests/e2e/scouting-flow.spec.ts tests/e2e/home-match-flow.spec.ts tests/e2e/v2-operation-feedback.spec.ts`

Expected: PASS.

- [ ] **Step 4: Run the complete static/unit gate**

Run: `npm run check`

Expected: ESLint, Prettier, app TypeScript, worker TypeScript, Vitest, structure verification, and event-distribution verification all PASS.

- [ ] **Step 5: Run production build**

Run: `npm run build`

Expected: Vite production build PASS.

- [ ] **Step 6: Run full Playwright suite**

Run: `npm run test:e2e`

Expected: PASS.

- [ ] **Step 7: Inspect the final diff for forbidden/stale behavior**

Run:

```bash
git diff main...HEAD --check
git grep -n 'activeTab === "training"\|label: "育成"' -- src || true
git status --short
```

Expected: no whitespace errors, no top-level Training route/label, and a clean working tree after the next commit.

- [ ] **Step 8: Commit final E2E adjustments**

```bash
git add tests/e2e src
git commit -m "test: cover Phase 12 mobile game loop"
```

- [ ] **Step 9: Push branch and verify normal CI before PR/merge**

Push `feature/phase12-game-loop-polish`, open/update the Phase 12 PR, and wait for normal `quality` and `mobile-e2e` jobs to pass. Do not merge to `main` while either job is pending or failing.
