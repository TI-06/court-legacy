# Phase21 PR21-2 Relationship Model and Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add canonical special relationships (`rival`, `mentor`, `partner`), make them form from real authored events, show them with numeric-affinity labels in Player Hub, degrade stale partner/mentor bonds safely, archive them at graduation, notify the player compactly, and migrate saves to schema v9.

**Architecture:** Keep `GameState.playerRelationships` as the canonical 0-100 affinity score and add a separate `playerRelationshipBonds` record keyed by existing `relationshipKey`. Special tags are changed only by explicit relationship effects or the documented weekly degradation guard; score thresholds alone never create tags. PR21-2 owns the v8->v9 bump and adds all persisted Phase21 fields so PR21-3/4 remain on schema v9.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest, React 19, existing event pipeline, weekly/year progression, notification state, and game-state codec.

**Spec:** `docs/superpowers/specs/2026-09-15-phase21-player-relationships-fullscreen-events-design.md`

## Global Constraints

- `playerRelationships` remains canonical 0-100 affinity; absent pair reads as 50.
- Labels are exactly: 0-19 `犬猿`, 20-39 `不仲`, 40-59 `普通`, 60-79 `好相性`, 80-100 `親友`.
- Special kinds are exactly `rival`, `mentor`, `partner`; at most two tags per pair.
- Mentor is directional and stores mentor/protege IDs.
- Rival can coexist with any affinity score and never degrades solely because affinity is low.
- Partner may begin degradation after relationship <60; mentor after <50; both are removed only after 8 consecutive weeks below threshold.
- Re-establishing/reinforcing a tag clears its deterioration timer.
- Important bonds archive at graduation; active bonds referencing a graduate are removed after archival.
- Relationship legacy history keeps newest 200 records.
- Special relationship establishment/removal uses compact notifications in addition to fullscreen event result text when the transition was caused by an event.
- PR21-2 changes `CURRENT_GAME_SCHEMA_VERSION` from 8 to 9 and initializes all Phase21 persisted fields.
- v8 saves preserve existing numeric relationships, pending event, event memory, personalities, and performance traits.
- No direct match-stat bonus and no social training-growth modifier in PR21-2.
- Use TDD and branch safe gate; intentional RED workflows must themselves conclude success after confirming expected failure.

---

## File Structure

- Create `src/domain/relationships/relationshipTypes.ts`.
- Create `src/domain/relationships/specialRelationships.ts`.
- Create `src/domain/relationships/relationshipPresentation.ts`.
- Modify `src/domain/model/GameState.ts`, `Player.ts`, `Event.ts`.
- Modify `src/domain/validation/gameDataSchema.ts` and `src/domain/events/eventEligibility.ts`.
- Modify `src/domain/events/resolveEventChoice.ts`.
- Modify `src/data/events/relationship.json`.
- Modify `src/domain/calendar/weekProgression.ts` and `academicYearProgression.ts`.
- Modify `src/domain/notifications/gameNotifications.ts`.
- Modify `src/features/home/HomeScreen.tsx` and its tests for compact relationship notifications.
- Modify `src/features/team/PlayerHubScreen.tsx` and `player-hub.css`.
- Modify `src/persistence/gameStateCodec.ts`.
- Create focused tests under `tests/unit/domain/relationships`, `tests/unit/domain/events`, `tests/unit/domain/calendar`, `tests/unit/notifications`, and `tests/unit/persistence`.

---

### Task 1: v9 relationship model and pure bond helpers

**Files:**
- Create: `src/domain/relationships/relationshipTypes.ts`
- Create: `src/domain/relationships/specialRelationships.ts`
- Modify: `src/domain/model/GameState.ts`
- Modify: `src/domain/model/Player.ts`
- Modify: `src/domain/model/Event.ts`
- Modify: `src/domain/generation/generatePlayer.ts`
- Create: `tests/unit/domain/relationships/specialRelationships.test.ts`

**Interfaces:**

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

Add persisted fields:

```ts
GameState.playerRelationshipBonds: Record<string, PlayerRelationshipBond>;
GameHistory.relationshipLegacyHistory: RelationshipLegacyRecord[];
EventMemory.recentActorPairKeys: string[];
Player.revealedHiddenTraitIds: string[];
Player.hiddenTraitAssignmentInitialized: boolean;
```

Pure helpers:

```ts
addSpecialRelationship(state, input): { state: GameState; transition: SpecialRelationshipTransition | null };
removeSpecialRelationship(state, input): { state: GameState; transition: SpecialRelationshipTransition | null };
getRelationshipBond(state, left, right): PlayerRelationshipBond | null;
```

- [ ] **Step 1: Write failing helper tests**

Assert sorted pair IDs, self-pair rejection, same-kind reinforcement without duplication, mentor direction validation, max-two error `relationship pair cannot exceed two special tags`, and map cleanup after final removal.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/relationships/specialRelationships.test.ts`

- [ ] **Step 3: Implement types/helpers and initialize new-game defaults**

`createEmptyGameHistory()` returns `relationshipLegacyHistory: []`; new `GameState` factories return `playerRelationshipBonds: {}` and event memory `recentActorPairKeys: []`; freshly generated players use:

```ts
hiddenTraitIds: [],
revealedHiddenTraitIds: [],
hiddenTraitAssignmentInitialized: false,
```

- [ ] **Step 4: Set `CURRENT_GAME_SCHEMA_VERSION = 9` and run tests/typecheck**

```bash
npx vitest run tests/unit/domain/relationships/specialRelationships.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/relationships src/domain/model/GameState.ts src/domain/model/Player.ts src/domain/model/Event.ts src/domain/generation/generatePlayer.ts tests/unit/domain/relationships/specialRelationships.test.ts
git commit -m "feat: add Phase21 relationship state model"
```

### Task 2: Pair-aware event eligibility and explicit relationship effects

**Files:**
- Modify: `src/domain/validation/gameDataSchema.ts`
- Modify: `src/domain/events/eventEligibility.ts`
- Modify: `src/domain/events/resolveEventChoice.ts`
- Create: `tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts`

**Interfaces:**

Add optional pair triggers:

```ts
samePreferredPosition?: boolean;
differentGrades?: boolean;
```

When present, they are evaluated only for actorCount >=2 using the first two actors.

Add effects:

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

`higher-grade` requires different grades and selects the older grade as mentor. Add effect runs in choice-effect order, so relationship changes earlier in the same choice are visible before tag creation.

- [ ] **Step 1: Write failing schema/eligibility/effect tests**

Cover same-position true/false, different-grade true/false, rival add, partner add, mentor higher-grade direction, remove, duplicate reinforcement, and visible result strings `特殊関係 ライバル成立`, `特殊関係 師弟成立`, `特殊関係 相棒成立` and corresponding `解消`.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts`

- [ ] **Step 3: Extend schemas and `isEventEligibleForActors`**

Existing trigger rules remain unchanged when the new fields are absent.

- [ ] **Step 4: Apply effects through `addSpecialRelationship`/`removeSpecialRelationship`**

Do not duplicate bond mutation logic inside the event resolver.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts tests/unit/domain/relationships/specialRelationships.test.ts
npm run typecheck
git add src/domain/validation/gameDataSchema.ts src/domain/events/eventEligibility.ts src/domain/events/resolveEventChoice.ts tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts
git commit -m "feat: support special relationship event transitions"
```

### Task 3: Author first real rival, mentor, and partner formation events

**Files:**
- Modify: `src/data/events/relationship.json`
- Create: `tests/unit/domain/events/phase21RelationshipEventData.test.ts`

**Interfaces / exact data edits:**

1. `event.position-rivalry`
   - trigger adds `samePreferredPosition: true`
   - choice `competition` appends `{ "type": "special-relationship-add", "kind": "rival" }` after current effects.

2. `event.senior-junior-serve`
   - trigger adds `differentGrades: true` and `relationship: { "min": 54 }`
   - choice `encourage` keeps `relationship-change +6`, then appends `{ "type": "special-relationship-add", "kind": "mentor", "mentor": "higher-grade" }`; resulting relationship is at least 60.

3. `event.shared-video-review`
   - trigger adds `relationship: { "min": 75 }`
   - choice `formalize` keeps `relationship-change +5`, then appends `{ "type": "special-relationship-add", "kind": "partner" }`; resulting relationship is at least 80.

- [ ] **Step 1: Write failing data tests**

Load registry, locate all three event IDs, assert new trigger/effect contracts, then resolve each with states at the exact threshold and assert the expected tag is formed.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/events/phase21RelationshipEventData.test.ts`

- [ ] **Step 3: Edit JSON exactly as specified**

Do not increase event weight/frequency in this task.

- [ ] **Step 4: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/events/phase21RelationshipEventData.test.ts
npm run typecheck
git add src/data/events/relationship.json tests/unit/domain/events/phase21RelationshipEventData.test.ts
git commit -m "feat: form special relationships from authored events"
```

### Task 4: Weekly deterioration guard for partner/mentor

**Files:**
- Modify: `src/domain/relationships/specialRelationships.ts`
- Modify: `src/domain/calendar/weekProgression.ts`
- Create: `tests/unit/domain/relationships/phase21RelationshipDegradation.test.ts`

**Interfaces:**

```ts
export function progressSpecialRelationshipsWeekly(
  state: GameState,
  nextDate: GameDate,
): { state: GameState; transitions: SpecialRelationshipTransition[] };
```

Rules:

```text
partner threshold: 60
mentor threshold: 50
first below-threshold weekly check: set belowThresholdSince=nextDate
score recovers before 8 weeks: clear belowThresholdSince
weeksBetween(belowThresholdSince, nextDate) >= 8 while still below: remove tag
rival: never removed by affinity degradation
reinforcement: clears belowThresholdSince and updates lastReinforcedDate
```

- [ ] **Step 1: Write failing degradation tests**

Cover 7 weeks retained, week 8 removed, recovery resets timer, mentor threshold, rival immunity, and a pair with two tags removing only the degraded tag.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/relationships/phase21RelationshipDegradation.test.ts`

- [ ] **Step 3: Implement pure weekly progression and call from `advanceOneWeek` after next date is calculated**

Preserve injury progression behavior and return transitions for notification creation.

- [ ] **Step 4: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/relationships/phase21RelationshipDegradation.test.ts tests/unit/domain/weekly
npm run typecheck
git add src/domain/relationships/specialRelationships.ts src/domain/calendar/weekProgression.ts tests/unit/domain/relationships/phase21RelationshipDegradation.test.ts
git commit -m "feat: degrade stale partner and mentor bonds"
```

### Task 5: Compact special-relationship notifications

**Files:**
- Modify: `src/domain/notifications/gameNotifications.ts`
- Modify: `src/domain/events/resolveEventChoice.ts`
- Modify: `src/domain/calendar/weekProgression.ts`
- Modify: `src/features/home/HomeScreen.tsx`
- Create: `tests/unit/notifications/phase21RelationshipNotifications.test.ts`
- Modify: `tests/unit/features/home/HomeScreen.test.tsx`

**Interfaces:**

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

`appendNotification` keeps only newest notification of this type and de-duplicates by ID.

- [ ] **Step 1: Write failing builder/retention tests**

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/notifications/phase21RelationshipNotifications.test.ts`

- [ ] **Step 3: Append notifications from event transitions and weekly degradation transitions**

Event transitions still keep visible result text in fullscreen result; notification is informational and must not create another fullscreen event.

- [ ] **Step 4: Add Home UI test**

Assert `ライバル関係が成立` or corresponding removal copy is visible and `fullscreen-event` is absent when opening the compact notification itself.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run tests/unit/notifications/phase21RelationshipNotifications.test.ts tests/unit/features/home/HomeScreen.test.tsx
npm run typecheck
git add src/domain/notifications/gameNotifications.ts src/domain/events/resolveEventChoice.ts src/domain/calendar/weekProgression.ts src/features/home/HomeScreen.tsx tests/unit/notifications/phase21RelationshipNotifications.test.ts tests/unit/features/home/HomeScreen.test.tsx
git commit -m "feat: notify special relationship changes"
```

### Task 6: Relationship labels/gauges in Player Hub

**Files:**
- Create: `src/domain/relationships/relationshipPresentation.ts`
- Create: `tests/unit/domain/relationships/relationshipPresentation.test.ts`
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/player-hub.css`
- Modify: `tests/unit/features/team/PlayerHubScreen.test.tsx`

**Interfaces:**

```ts
export type RelationshipLabel = "犬猿" | "不仲" | "普通" | "好相性" | "親友";
export function relationshipLabel(score: number): RelationshipLabel;
export function selectPlayerRelationships(
  state: GameState,
  playerId: PlayerId,
): PlayerRelationshipPresentation[];
```

UI rows show teammate, label, gauge/accessible numeric value, special tags, and mentor/protege direction. Current teammates only. Sort tagged relationships first, then distance from 50 descending, then deterministic ID tie-break.

- [ ] **Step 1: Write failing boundary tests for 19/20/39/40/59/60/79/80 and default 50**

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/relationships/relationshipPresentation.test.ts`

- [ ] **Step 3: Implement selector and failing Player Hub test**

Assert `人間関係`, teammate name, `好相性`, `関係値 74`, and `ライバル` tag.

- [ ] **Step 4: Render relationship section and run GREEN**

```bash
npx vitest run tests/unit/domain/relationships/relationshipPresentation.test.ts tests/unit/features/team/PlayerHubScreen.test.tsx
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/relationships/relationshipPresentation.ts src/features/team/PlayerHubScreen.tsx src/features/team/player-hub.css tests/unit/domain/relationships/relationshipPresentation.test.ts tests/unit/features/team/PlayerHubScreen.test.tsx
git commit -m "feat: show player relationships in Player Hub"
```

### Task 7: Graduation relationship legacy archival

**Files:**
- Modify: `src/domain/calendar/academicYearProgression.ts`
- Create: `tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts`

**Interfaces:**

```ts
export function archiveGraduatingRelationships(
  state: GameState,
  graduatedPlayerIds: readonly PlayerId[],
  archivedDate: GameDate,
): Pick<GameState, "playerRelationshipBonds" | "history">;
```

Archive any active bond with at least one graduating player exactly once, capture both display names before active cleanup, use current numeric score/default50, retain newest200, remove archived active bonds before relationship rebuild.

- [ ] **Step 1: Write failing annual-transition tests**

Cover graduate+returner, two graduates one bond, final score, names, max200, and no graduated active reference.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts`

- [ ] **Step 3: Implement archival before `rebuildRelationships`**

- [ ] **Step 4: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts
npm run typecheck
git add src/domain/calendar/academicYearProgression.ts tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts
git commit -m "feat: archive relationships at graduation"
```

### Task 8: v8 -> v9 codec migration and canonical validation

**Files:**
- Modify: `src/persistence/gameStateCodec.ts`
- Create: `tests/unit/persistence/phase21GameStateMigration.test.ts`
- Modify: `tests/unit/persistence/gameStateCodec.test.ts`

**Migration defaults:**

```ts
playerRelationshipBonds = {}
history.relationshipLegacyHistory = []
eventMemory.recentActorPairKeys = []
player.revealedHiddenTraitIds = []
player.hiddenTraitAssignmentInitialized = false
```

- [ ] **Step 1: Write failing v8 migration test**

Assert version9, all defaults, preservation of known numeric relationship and pending event, and no mutation of existing event history/personality/performance traits.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/persistence/phase21GameStateMigration.test.ts`

- [ ] **Step 3: Add strict v9 schemas and migration normalization**

Validate max2 tags, mentor IDs within pair, `belowThresholdSince` game-date/null, legacy max200, and special relationship notification shape.

- [ ] **Step 4: Add v9 round-trip test with rival+mentor bond, deterioration timer, legacy record, recent pair memory, and notification**

- [ ] **Step 5: Run persistence regressions and commit**

```bash
npx vitest run tests/unit/persistence/phase21GameStateMigration.test.ts tests/unit/persistence/gameStateCodec.test.ts tests/unit/persistence/phase20PracticeOfferCanonicalCodec.test.ts tests/unit/persistence/phase20PracticeOfferHistoryCodec.test.ts
npm run typecheck
git add src/persistence/gameStateCodec.ts tests/unit/persistence/phase21GameStateMigration.test.ts tests/unit/persistence/gameStateCodec.test.ts
git commit -m "feat: migrate game state to schema v9"
```

### Task 9: PR21-2 verification gate

- [ ] **Step 1: Run focused suites**

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
  tests/unit/features/home/HomeScreen.test.tsx \
  tests/unit/features/team/PlayerHubScreen.test.tsx
```

- [ ] **Step 2: Run static/full checks**

```bash
npm run typecheck
npm run lint
npm run format:check
npm run verify
```

- [ ] **Step 3: Run branch safe gate and remove temporary workflow before PR**

Do not open PR while safe gate is red; expected TDD RED workflows must verify the intended failure and still conclude workflow success.

- [ ] **Step 4: Final diff invariants**

```text
schemaVersion = 9
max tags/pair = 2
legacy max = 200
rival does not affinity-degrade
partner/mentor degradation = 8 consecutive weeks
real authored event exists for rival, mentor, partner
no relationship training bonus yet
no direct match-stat bonus
normal event cadence unchanged
no temporary workflow file
```
