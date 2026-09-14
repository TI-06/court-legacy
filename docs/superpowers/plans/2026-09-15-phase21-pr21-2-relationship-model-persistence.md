# Phase21 PR21-2 Relationship Model and Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add canonical special relationships (`rival`, `mentor`, `partner`), make them form from real authored events, show affinity and tags in Player Hub/fullscreen events, degrade stale partner/mentor bonds safely, archive them at graduation, notify the player compactly, and migrate saves to schema v9.

**Architecture:** Keep `GameState.playerRelationships` as the canonical 0-100 affinity map and add `playerRelationshipBonds` keyed by existing `relationshipKey`. Explicit event effects create/remove tags; a weekly guard handles prolonged partner/mentor deterioration. Domain functions return exact transition records; `worker/game/applyGameAction.ts` appends compact notifications. PR21-2 owns the v8→v9 schema bump and all persisted Phase21 fields.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest, React 19, event/weekly/year progression, worker action pipeline, notification state, game-state codec.

**Spec:** `docs/superpowers/specs/2026-09-15-phase21-player-relationships-fullscreen-events-design.md`

## Global Constraints

- Numeric affinity remains 0-100; absent pair reads as 50.
- Labels: 0-19 `犬猿`, 20-39 `不仲`, 40-59 `普通`, 60-79 `好相性`, 80-100 `親友`.
- Special kinds: `rival`, `mentor`, `partner`; maximum two tags/pair.
- Mentor is directional. Rival may coexist with any affinity and never affinity-degrades.
- Partner threshold for deterioration is <60; mentor <50; remove only after 8 consecutive weeks below threshold.
- Re-establish/reinforce clears deterioration timer.
- Event result text must show affinity label transition when a `relationship-change` crosses a label boundary.
- Two-player fullscreen event actor cards show current relationship label and active special tags.
- Important bonds archive at graduation; legacy keeps newest 200.
- Relationship transition notifications are compact and are created only at worker boundary.
- Schema becomes v9; v8 relationships/pending event/event memory/personality/performance traits remain semantically intact.
- No relationship training modifier and no direct match-stat bonus in PR21-2.
- Normal event cadence is unchanged.
- TDD + safe gate before PR; expected RED workflow must itself conclude success after verifying the intended failure.

---

## File Structure

- Create `src/domain/relationships/relationshipTypes.ts`.
- Create `src/domain/relationships/specialRelationships.ts`.
- Create `src/domain/relationships/relationshipPresentation.ts`.
- Modify `src/domain/model/GameState.ts`, `Player.ts`, `Event.ts`.
- Modify `src/domain/validation/gameDataSchema.ts`, `src/domain/events/eventEligibility.ts`, `resolveEventChoice.ts`.
- Modify `src/data/events/relationship.json`.
- Modify `src/domain/calendar/weekProgression.ts`, `academicYearProgression.ts`.
- Modify `src/domain/notifications/gameNotifications.ts` and `worker/game/applyGameAction.ts`.
- Modify `src/features/team/PlayerHubScreen.tsx`, `player-hub.css`.
- Modify `src/features/home/FullscreenEventExperience.tsx`, `HomeScreen.tsx`.
- Modify `src/persistence/gameStateCodec.ts`.
- Add/modify focused tests named in tasks below.

---

### Task 1: v9 model, relationship labels, and pure bond helpers

**Files:**

- Create: `src/domain/relationships/relationshipTypes.ts`
- Create: `src/domain/relationships/specialRelationships.ts`
- Create: `src/domain/relationships/relationshipPresentation.ts`
- Modify: `src/domain/model/GameState.ts`
- Modify: `src/domain/model/Player.ts`
- Modify: `src/domain/model/Event.ts`
- Modify: `src/domain/generation/generatePlayer.ts`
- Create: `tests/unit/domain/relationships/specialRelationships.test.ts`
- Create: `tests/unit/domain/relationships/relationshipPresentation.test.ts`

**Types:**

```ts
export type SpecialRelationshipKind = "rival" | "mentor" | "partner";

export interface SpecialRelationshipTag {
  kind: SpecialRelationshipKind;
  establishedDate: GameDate;
  sourceEventId: EventId | null;
  lastReinforcedDate: GameDate;
  belowThresholdSince: GameDate | null;
  mentorPlayerId?: PlayerId;
  protegePlayerId?: PlayerId;
}

export interface PlayerRelationshipBond {
  playerIds: [PlayerId, PlayerId];
  tags: SpecialRelationshipTag[];
}

export interface RelationshipLegacyRecord {
  playerIds: [PlayerId, PlayerId];
  displayNames: [string, string];
  tags: SpecialRelationshipTag[];
  finalRelationshipScore: number;
  archivedDate: GameDate;
}

export interface SpecialRelationshipTransition {
  action: "established" | "removed";
  kind: SpecialRelationshipKind;
  playerIds: [PlayerId, PlayerId];
}
```

Persisted fields:

```ts
GameState.playerRelationshipBonds: Record<string, PlayerRelationshipBond>;
GameHistory.relationshipLegacyHistory: RelationshipLegacyRecord[];
EventMemory.recentActorPairKeys: string[];
Player.revealedHiddenTraitIds: string[];
Player.hiddenTraitAssignmentInitialized: boolean;
```

Presentation contract:

```ts
export type RelationshipLabel = "犬猿" | "不仲" | "普通" | "好相性" | "親友";
export function relationshipLabel(score: number): RelationshipLabel;
```

Helper contract:

```ts
addSpecialRelationship(state, input): {
  state: GameState;
  transition: SpecialRelationshipTransition | null;
};
removeSpecialRelationship(state, input): {
  state: GameState;
  transition: SpecialRelationshipTransition | null;
};
getRelationshipBond(state, left, right): PlayerRelationshipBond | null;
```

- [ ] **Step 1:** Write RED tests for label boundaries 19/20/39/40/59/60/79/80 and defensive clamp.
- [ ] **Step 2:** Write RED helper tests: sorted pair IDs, self-pair rejection, duplicate reinforcement, mentor direction, max-two error, final-tag cleanup.
- [ ] **Step 3:** Run RED.

```bash
npx vitest run tests/unit/domain/relationships/relationshipPresentation.test.ts tests/unit/domain/relationships/specialRelationships.test.ts
```

- [ ] **Step 4:** Implement types/helpers/labels and new-game defaults. `createEmptyGameHistory()` gets `relationshipLegacyHistory: []`; new GameState/event-memory fields are empty; generated players initialize `hiddenTraitIds=[]`, `revealedHiddenTraitIds=[]`, `hiddenTraitAssignmentInitialized=false`.
- [ ] **Step 5:** Set `CURRENT_GAME_SCHEMA_VERSION = 9`; run GREEN + typecheck.
- [ ] **Step 6:** Commit.

```bash
git add src/domain/relationships src/domain/model/GameState.ts src/domain/model/Player.ts src/domain/model/Event.ts src/domain/generation/generatePlayer.ts tests/unit/domain/relationships
git commit -m "feat: add Phase21 relationship state model"
```

### Task 2: Pair-aware event eligibility and explicit relationship effects

**Files:**

- Modify: `src/domain/validation/gameDataSchema.ts`
- Modify: `src/domain/events/eventEligibility.ts`
- Modify: `src/domain/events/resolveEventChoice.ts`
- Create: `tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts`

**Trigger additions:**

```ts
samePreferredPosition?: boolean;
differentGrades?: boolean;
```

Evaluate these only for actorCount >=2 using first two actors.

**Effect additions:**

```ts
{
  type: "special-relationship-add";
  kind: "rival" | "partner";
}
{
  type: "special-relationship-add";
  kind: "mentor";
  mentor: "higher-grade" | "actor-0" | "actor-1";
}
{
  type: "special-relationship-remove";
  kind: "rival" | "mentor" | "partner";
}
```

`higher-grade` requires different grades. Effects execute in listed choice order.

Extend resolver:

```ts
export interface ResolveEventChoiceResult {
  state: GameState;
  occurrence: EventOccurrence;
  specialRelationshipTransitions: SpecialRelationshipTransition[];
}
```

For existing `relationship-change`, compute `beforeScore`, `afterScore`, `beforeLabel`, `afterLabel`. Visible result is:

```text
same band: 連携 +8
crossed band: 連携 +8（普通 → 好相性）
```

Special add/remove visible results are `特殊関係 ライバル成立`, `特殊関係 師弟成立`, `特殊関係 相棒成立`, or corresponding `解消`.

- [ ] **Step 1:** Write failing schema/eligibility/effect/transition tests, including affinity-band crossing text.
- [ ] **Step 2:** Run RED: `npx vitest run tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts`.
- [ ] **Step 3:** Extend Zod + eligibility and implement effects through pure bond helpers; collect transitions in effect order.
- [ ] **Step 4:** Run GREEN + typecheck and commit.

```bash
npx vitest run tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts tests/unit/domain/relationships/specialRelationships.test.ts tests/unit/domain/relationships/relationshipPresentation.test.ts
npm run typecheck
git add src/domain/validation/gameDataSchema.ts src/domain/events/eventEligibility.ts src/domain/events/resolveEventChoice.ts tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts
git commit -m "feat: support special relationship event transitions"
```

### Task 3: Author real rival, mentor, and partner formation events

**Files:**

- Modify: `src/data/events/relationship.json`
- Create: `tests/unit/domain/events/phase21RelationshipEventData.test.ts`

Exact edits:

```text
event.position-rivalry
  trigger.samePreferredPosition = true
  choice competition appends special-relationship-add rival

event.senior-junior-serve
  trigger.differentGrades = true
  trigger.relationship.min = 54
  choice encourage keeps relationship +6 then appends mentor higher-grade
  => establishment score >=60

event.shared-video-review
  trigger.relationship.min = 75
  choice formalize keeps relationship +5 then appends partner
  => establishment score >=80
```

- [ ] **Step 1:** RED data tests load registry, verify trigger/effect definitions, and resolve each at exact threshold.
- [ ] **Step 2:** Run RED.
- [ ] **Step 3:** Edit JSON only; do not increase event weights/cadence.
- [ ] **Step 4:** Run GREEN + typecheck and commit.

```bash
npx vitest run tests/unit/domain/events/phase21RelationshipEventData.test.ts
npm run typecheck
git add src/data/events/relationship.json tests/unit/domain/events/phase21RelationshipEventData.test.ts
git commit -m "feat: form special relationships from authored events"
```

### Task 4: Weekly deterioration guard

**Files:**

- Modify: `src/domain/relationships/specialRelationships.ts`
- Modify: `src/domain/calendar/weekProgression.ts`
- Create: `tests/unit/domain/relationships/phase21RelationshipDegradation.test.ts`

**Interface:**

```ts
export function progressSpecialRelationshipsWeekly(
  state: GameState,
  nextDate: GameDate,
): { state: GameState; transitions: SpecialRelationshipTransition[] };

export interface WeekProgressionResult {
  state: GameState;
  recoveredPlayerIds: PlayerId[];
  healedPlayerIds: PlayerId[];
  specialRelationshipTransitions: SpecialRelationshipTransition[];
}
```

Rules:

```text
partner <60: start/continue timer
mentor <50: start/continue timer
recovery before 8 weeks: clear timer
weeksBetween(belowThresholdSince,nextDate) >=8 while still below: remove that tag
rival: never removed by this guard
reinforcement: clear timer + update lastReinforcedDate
```

- [ ] **Step 1:** RED tests for week7 retained/week8 removed, recovery reset, mentor threshold, rival immunity, transition emission, two-tag pair removes only degraded tag.
- [ ] **Step 2:** Run RED.
- [ ] **Step 3:** Call progressor in `advanceOneWeek` after computing next date; preserve injury behavior; `advanceGameWeek` naturally carries the extra result field via spread.
- [ ] **Step 4:** Run GREEN + typecheck and commit.

```bash
npx vitest run tests/unit/domain/relationships/phase21RelationshipDegradation.test.ts tests/unit/domain/weekly
npm run typecheck
git add src/domain/relationships/specialRelationships.ts src/domain/calendar/weekProgression.ts tests/unit/domain/relationships/phase21RelationshipDegradation.test.ts
git commit -m "feat: degrade stale partner and mentor bonds"
```

### Task 5: Worker-boundary compact relationship notifications

**Files:**

- Modify: `src/domain/notifications/gameNotifications.ts`
- Modify: `worker/game/applyGameAction.ts`
- Create: `tests/unit/notifications/phase21RelationshipNotifications.test.ts`
- Modify: `tests/unit/worker/applyGameAction.test.ts`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `tests/unit/features/home/HomeScreen.test.tsx`

**Notification:**

```ts
export interface SpecialRelationshipNotification {
  id: string;
  type: "special-relationship";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: {
    action: "established" | "removed";
    kind: SpecialRelationshipKind;
    playerIds: [PlayerId, PlayerId];
    displayNames: [string, string];
  };
}
```

Worker helper:

```ts
function appendSpecialRelationshipNotifications(
  state: GameState,
  transitions: readonly SpecialRelationshipTransition[],
): GameState;
```

`applyEventChoice` consumes resolver transitions. `applyAdvanceWeek` consumes `progression.specialRelationshipTransitions`, appends notifications to progression state, then calls `surfaceWeeklyEvent` on that notified state. `appendNotification` keeps newest of this type and de-duplicates ID.

- [ ] **Step 1:** RED builder/retention tests.
- [ ] **Step 2:** RED worker tests: one event establishment and one 8-week weekly removal create exactly one compact notification.
- [ ] **Step 3:** Run RED.

```bash
npx vitest run tests/unit/notifications/phase21RelationshipNotifications.test.ts tests/unit/worker/applyGameAction.test.ts
```

- [ ] **Step 4:** Implement worker-only notification append.
- [ ] **Step 5:** Home UI regression: relationship notice visible, opening/viewing it does not create `fullscreen-event`.
- [ ] **Step 6:** Run GREEN + typecheck and commit.

```bash
npx vitest run tests/unit/notifications/phase21RelationshipNotifications.test.ts tests/unit/worker/applyGameAction.test.ts tests/unit/features/home/HomeScreen.test.tsx
npm run typecheck
git add src/domain/notifications/gameNotifications.ts worker/game/applyGameAction.ts src/features/home/HomeScreen.tsx tests/unit/notifications/phase21RelationshipNotifications.test.ts tests/unit/worker/applyGameAction.test.ts tests/unit/features/home/HomeScreen.test.tsx
git commit -m "feat: notify special relationship changes"
```

### Task 6: Relationship presentation in Player Hub and fullscreen events

**Files:**

- Modify: `src/domain/relationships/relationshipPresentation.ts`
- Modify: `tests/unit/domain/relationships/relationshipPresentation.test.ts`
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/player-hub.css`
- Modify: `src/features/home/FullscreenEventExperience.tsx`
- Modify: `tests/unit/features/team/PlayerHubScreen.test.tsx`
- Modify: `tests/unit/features/home/EventDialog.test.tsx`

**Selector:**

```ts
export interface PlayerRelationshipPresentation {
  playerId: PlayerId;
  displayName: string;
  score: number;
  label: RelationshipLabel;
  specialKinds: SpecialRelationshipKind[];
  mentorDirection: "mentor" | "protege" | null;
}

export function selectPlayerRelationships(
  state: GameState,
  playerId: PlayerId,
): PlayerRelationshipPresentation[];
```

Current teammates only. Sort tagged rows first, then distance from 50 descending, then player ID.

Player Hub shows `人間関係`, teammate, label, accessible gauge `関係値 74`, special tags, mentor/protege direction.

For a two-actor fullscreen event, derive their current pair score/default50 and bond; actor/content area shows `好相性` etc. and `ライバル / 師弟 / 相棒` tags. One-actor events show no relationship badge.

- [ ] **Step 1:** RED selector tests including default50 and sort/direction.
- [ ] **Step 2:** RED Player Hub assertions (`人間関係`, teammate, `好相性`, `関係値 74`, `ライバル`).
- [ ] **Step 3:** RED EventDialog assertion that a two-player event displays the current relationship label and special tag.
- [ ] **Step 4:** Implement selector and both UI surfaces.
- [ ] **Step 5:** Run GREEN + typecheck and commit.

```bash
npx vitest run tests/unit/domain/relationships/relationshipPresentation.test.ts tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/features/home/EventDialog.test.tsx
npm run typecheck
git add src/domain/relationships/relationshipPresentation.ts src/features/team/PlayerHubScreen.tsx src/features/team/player-hub.css src/features/home/FullscreenEventExperience.tsx tests/unit/domain/relationships/relationshipPresentation.test.ts tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/features/home/EventDialog.test.tsx
git commit -m "feat: show player relationships across character UI"
```

### Task 7: Graduation legacy archival

**Files:**

- Modify: `src/domain/calendar/academicYearProgression.ts`
- Create: `tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts`

**Interface:**

```ts
export function archiveGraduatingRelationships(
  state: GameState,
  graduatedPlayerIds: readonly PlayerId[],
  archivedDate: GameDate,
): Pick<GameState, "playerRelationshipBonds" | "history">;
```

Archive each active bond touching a graduate exactly once, capture both names before cleanup, current score/default50, newest200; remove archived active bonds before numeric relationship rebuild.

- [ ] **Step 1:** RED tests for graduate+returner, two graduates/one bond, score/names, max200, no graduated active ref.
- [ ] **Step 2:** Run RED.
- [ ] **Step 3:** Implement before `rebuildRelationships`.
- [ ] **Step 4:** Run GREEN + typecheck and commit.

```bash
npx vitest run tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts
npm run typecheck
git add src/domain/calendar/academicYearProgression.ts tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts
git commit -m "feat: archive relationships at graduation"
```

### Task 8: v8→v9 codec migration

**Files:**

- Modify: `src/persistence/gameStateCodec.ts`
- Create: `tests/unit/persistence/phase21GameStateMigration.test.ts`
- Modify: `tests/unit/persistence/gameStateCodec.test.ts`

Defaults:

```ts
playerRelationshipBonds = {};
history.relationshipLegacyHistory = [];
eventMemory.recentActorPairKeys = [];
player.revealedHiddenTraitIds = [];
player.hiddenTraitAssignmentInitialized = false;
```

- [ ] **Step 1:** RED v8 migration test: version9/defaults + preserve numeric relationship, pending event, event history, personality/performance traits.
- [ ] **Step 2:** Run RED.
- [ ] **Step 3:** Add strict v9 schemas: max2 tags, mentor IDs in pair, deterioration date/null, legacy max200, recent pair memory, new Player fields, special relationship notification.
- [ ] **Step 4:** Add v9 round-trip test with rival+mentor, timer, legacy, recent pair memory, notification.
- [ ] **Step 5:** Persistence regressions + commit.

```bash
npx vitest run tests/unit/persistence/phase21GameStateMigration.test.ts tests/unit/persistence/gameStateCodec.test.ts tests/unit/persistence/phase20PracticeOfferCanonicalCodec.test.ts tests/unit/persistence/phase20PracticeOfferHistoryCodec.test.ts
npm run typecheck
git add src/persistence/gameStateCodec.ts tests/unit/persistence/phase21GameStateMigration.test.ts tests/unit/persistence/gameStateCodec.test.ts
git commit -m "feat: migrate game state to schema v9"
```

### Task 9: PR21-2 verification gate

- [ ] **Step 1:** Focused suites.

```bash
npx vitest run \
  tests/unit/domain/relationships/specialRelationships.test.ts \
  tests/unit/domain/relationships/phase21RelationshipDegradation.test.ts \
  tests/unit/domain/relationships/relationshipPresentation.test.ts \
  tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts \
  tests/unit/domain/events/phase21RelationshipEventData.test.ts \
  tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts \
  tests/unit/notifications/phase21RelationshipNotifications.test.ts \
  tests/unit/persistence/phase21GameStateMigration.test.ts \
  tests/unit/worker/applyGameAction.test.ts \
  tests/unit/features/home/HomeScreen.test.tsx \
  tests/unit/features/home/EventDialog.test.tsx \
  tests/unit/features/team/PlayerHubScreen.test.tsx
```

- [ ] **Step 2:** Static/full checks.

```bash
npm run typecheck
npm run lint
npm run format:check
npm run verify
```

- [ ] **Step 3:** Branch safe gate; remove temporary workflow before PR. Never open red PR.
- [ ] **Step 4:** Final invariants:

```text
schemaVersion=9
max tags/pair=2
legacy max=200
rival affinity-degradation disabled
partner/mentor degradation=8 consecutive weeks
real authored formation event exists for all 3 kinds
event result can show affinity label transition
two-player fullscreen events show current relationship/tag
relationship notifications originate from worker transition handoff
no relationship training bonus yet
no direct match-stat bonus
normal event cadence unchanged
no temporary workflow
```
