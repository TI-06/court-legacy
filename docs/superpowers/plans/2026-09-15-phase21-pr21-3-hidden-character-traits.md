# Phase21 PR21-3 Hidden Character Traits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the persisted hidden-trait fields introduced in PR21-2 into a deterministic, discoverable character-trait system with compact notifications and no unseen performance bonuses.

**Architecture:** Add a separate character-trait catalog to `GameDataRegistry`; do not reuse performance `traitIds`. Assignment is a pure stable hash of `seed + playerId`, evaluated once per player with a 60% assignment rate and without touching `randomCursor`. A pure discovery engine reveals assigned traits from trust, appearances, captaincy, special relationships, or matching event tags. Domain transitions return exact discovery records; `worker/game/applyGameAction.ts` is the authoritative boundary that converts those records into compact notifications. Player Hub shows only revealed character traits.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest, React 19, existing worker action pipeline, existing notification system.

**Spec:** `docs/superpowers/specs/2026-09-15-phase21-player-relationships-fullscreen-events-design.md`

## Global Constraints

- Each player has at most one hidden character trait in Phase21.
- Assignment rate is exactly 60%; 40% intentionally receive no hidden character trait.
- `hiddenTraitAssignmentInitialized=true` means assignment was evaluated, including intentional no-trait cases.
- `revealedHiddenTraitIds` must always be a subset of `hiddenTraitIds`.
- Assignment and backfill never advance `randomCursor`.
- Hidden character traits are separate from performance `traitIds` and contain no ability/situation modifier effects.
- Before reveal, a hidden character trait affects neither training growth nor match stats and is absent from UI.
- Discovery is contextual, not a generic random popup.
- Discovery notifications are compact and do not create `pendingEvent` or consume the normal event slot.
- Notification creation happens at the authoritative worker boundary; domain helpers return discovery records and never independently emit duplicate notifications.
- Schema remains v9; PR21-2 already provides `hiddenTraitAssignmentInitialized` and `revealedHiddenTraitIds` defaults for migrated saves.
- Use TDD; do not open PR21-3 until focused tests, static checks, `npm run verify`, and the branch safe gate are green.

---

## File Structure

- Modify `src/domain/validation/gameDataSchema.ts`: add character-trait definition/discovery-condition schemas.
- Modify `src/data/rawGameData.ts`: add a curated ten-trait catalog.
- Modify `src/data/dataRegistry.ts`: expose `characterTraits` read-only map and uniqueness validation.
- Create `src/domain/player/characterTraitAssignment.ts`: stable 60% assignment and state backfill.
- Create `src/domain/player/characterTraitDiscovery.ts`: pure reveal eligibility.
- Modify `src/domain/generation/generatePlayer.ts`: keep new Player fields initialized safely; final assignment happens after players exist in state.
- Modify `src/app/createInitialGame.ts`: run assignment once on newly created game state.
- Modify `src/domain/calendar/academicYearProgression.ts`: run assignment after new intake/generational players are added.
- Modify `src/domain/events/resolveEventChoice.ts`: evaluate event-tag discovery and return discovery records.
- Modify `worker/game/applyGameAction.ts`: backfill uninitialized migrated players, finalize non-event discovery after every action, and append notifications for both event-specific and general discoveries.
- Modify `src/domain/notifications/gameNotifications.ts`: add `character-trait-discovered` compact notification builder/selector.
- Modify Home notification rendering so discovery remains compact, not fullscreen.
- Modify `src/features/team/PlayerHubScreen.tsx` and `player-hub.css`: show revealed trait only.
- Create tests under `tests/unit/data`, `tests/unit/domain/player`, `tests/unit/domain/events`, `tests/unit/notifications`.
- Modify `tests/unit/worker/applyGameAction.test.ts`, `tests/unit/worker/gameAction.test.ts`, `tests/unit/features/home/HomeScreen.test.tsx`, and `tests/unit/features/team/PlayerHubScreen.test.tsx`.

---

### Task 1: Character-trait catalog and registry

**Files:**
- Modify: `src/domain/validation/gameDataSchema.ts`
- Modify: `src/data/rawGameData.ts`
- Modify: `src/data/dataRegistry.ts`
- Create: `tests/unit/data/phase21CharacterTraits.test.ts`

**Interfaces:**

```ts
export const characterTraitDiscoveryConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("trust-min"), value: z.number().int().min(0).max(100) }),
  z.object({ type: z.literal("appearances-min"), value: z.number().int().min(1).max(1000) }),
  z.object({ type: z.literal("captaincy") }),
  z.object({
    type: z.literal("special-relationship"),
    kind: z.enum(["rival", "mentor", "partner"]).optional(),
  }),
  z.object({ type: z.literal("event-tag"), tag: z.string().trim().min(1).max(30) }),
]);

export const characterTraitDefinitionSchema = z.object({
  id: dataIdSchema,
  name: z.string().trim().min(1).max(24),
  description: z.string().trim().min(1).max(180),
  eventTags: z.array(z.string().trim().min(1).max(30)).max(8),
  relationshipBias: z.number().int().min(-10).max(10),
  discoveryConditions: z.array(characterTraitDiscoveryConditionSchema).min(1).max(4),
});
```

Registry adds:

```ts
characterTraits: ReadonlyMap<string, CharacterTraitDefinition>;
```

Catalog IDs are fixed:

```text
character.caring
character.analytical
character.training-lover
character.resilient
character.team-first
character.bottles-up
character.spotlight
character.competitive-growth
character.quiet-observer
character.clutch-support
```

- [ ] **Step 1: Write failing catalog tests**

```ts
expect(data.characterTraits.size).toBe(10);
expect(data.characterTraits.get("character.caring")?.name).toBe("面倒見がいい");
for (const trait of data.characterTraits.values()) {
  expect(trait.discoveryConditions.length).toBeGreaterThan(0);
}
```

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/data/phase21CharacterTraits.test.ts`

- [ ] **Step 3: Add schema, raw catalog, registry map, and uniqueness check**

Use the existing `assertUniqueIds` and `createReadOnlyMap` patterns. Do not modify performance-trait validation.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/unit/data/phase21CharacterTraits.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/validation/gameDataSchema.ts src/data/rawGameData.ts src/data/dataRegistry.ts tests/unit/data/phase21CharacterTraits.test.ts
git commit -m "feat: add character trait catalog"
```

### Task 2: Stable assignment/backfill helper

**Files:**
- Create: `src/domain/player/characterTraitAssignment.ts`
- Create: `tests/unit/domain/player/characterTraitAssignment.test.ts`

**Interfaces:**

```ts
export function assignCharacterTraitDeterministically(
  seed: string,
  playerId: PlayerId,
  characterTraitIds: readonly string[],
): { hiddenTraitIds: string[]; hiddenTraitAssignmentInitialized: true };

export function ensureCharacterTraitAssignments(
  state: GameState,
  data: GameDataRegistry,
): GameState;
```

Exact algorithm:

```text
ids = characterTraitIds sorted lexicographically
hash = 32-bit FNV-1a(`${seed}:phase21-character-trait:${playerId}`)
assigned iff hash % 100 < 60
if assigned: ids[Math.floor(hash / 100) % ids.length]
if not assigned: []
```

If `hiddenTraitAssignmentInitialized` is already true, preserve the player's assignment exactly.

- [ ] **Step 1: Write deterministic tests**

Assert same inputs give same result, max one trait, initialized players do not reroll, and a synthetic 10,000-player sample produces an assignment rate between 58% and 62%.

- [ ] **Step 2: Write cursor-invariance test**

```ts
const before = state.randomCursor;
const next = ensureCharacterTraitAssignments(state, data);
expect(next.randomCursor).toBe(before);
```

- [ ] **Step 3: Run RED**

`npx vitest run tests/unit/domain/player/characterTraitAssignment.test.ts`

- [ ] **Step 4: Implement pure assignment/backfill**

Do not use `SeededRandom`, `Math.random`, or wall-clock data.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/player/characterTraitAssignment.test.ts
npm run typecheck
git add src/domain/player/characterTraitAssignment.ts tests/unit/domain/player/characterTraitAssignment.test.ts
git commit -m "feat: assign hidden character traits deterministically"
```

### Task 3: Assign new and migrated players at canonical lifecycle points

**Files:**
- Modify: `src/domain/generation/generatePlayer.ts`
- Modify: `src/app/createInitialGame.ts`
- Modify: `src/domain/calendar/academicYearProgression.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify: `tests/unit/worker/applyGameAction.test.ts`
- Modify: `tests/unit/worker/academicYearRecruitment.test.ts`

**Interfaces:**
- `generatePlayer` initializes `hiddenTraitIds: []`, `revealedHiddenTraitIds: []`, `hiddenTraitAssignmentInitialized: false`.
- `createInitialGame` calls `ensureCharacterTraitAssignments` after world/player construction.
- `advanceAcademicYear` calls the same helper after all intake and generational-talent players are inserted.
- `applyGameAction` normalizes migrated/uninitialized players before processing the action.

- [ ] **Step 1: Add failing legacy backfill test in `tests/unit/worker/applyGameAction.test.ts`**

Use a zero-random administrative action and assert the player becomes initialized while `randomCursor` stays exact.

- [ ] **Step 2: Add failing intake test in `tests/unit/worker/academicYearRecruitment.test.ts`**

After year transition, every new intake player must have `hiddenTraitAssignmentInitialized === true`, max one hidden trait, and `revealedHiddenTraitIds=[]`.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/unit/worker/applyGameAction.test.ts tests/unit/worker/academicYearRecruitment.test.ts
```

- [ ] **Step 4: Implement lifecycle normalization**

Call the helper once per lifecycle boundary; do not repeatedly rewrite already initialized players.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run tests/unit/worker/applyGameAction.test.ts tests/unit/worker/academicYearRecruitment.test.ts tests/unit/domain/player/characterTraitAssignment.test.ts
npm run typecheck
git add src/domain/generation/generatePlayer.ts src/app/createInitialGame.ts src/domain/calendar/academicYearProgression.ts worker/game/applyGameAction.ts tests/unit/worker/applyGameAction.test.ts tests/unit/worker/academicYearRecruitment.test.ts
git commit -m "feat: initialize character traits across player lifecycle"
```

### Task 4: Pure discovery engine

**Files:**
- Create: `src/domain/player/characterTraitDiscovery.ts`
- Create: `tests/unit/domain/player/characterTraitDiscovery.test.ts`

**Interfaces:**

```ts
export interface CharacterTraitDiscoveryContext {
  eventTags?: readonly string[];
  captainPlayerId?: PlayerId | null;
  viceCaptainPlayerId?: PlayerId | null;
}

export interface CharacterTraitDiscovery {
  playerId: PlayerId;
  traitId: string;
}

export function discoverEligibleCharacterTraits(
  state: GameState,
  data: GameDataRegistry,
  context?: CharacterTraitDiscoveryContext,
): { state: GameState; discoveries: CharacterTraitDiscovery[] };
```

Condition semantics:

```text
trust-min            player.trust >= value
appearances-min      player.career.appearances >= value
captaincy            player is current captain or vice captain
special-relationship player participates in requested active bond kind (or any when kind omitted)
event-tag            context.eventTags contains configured tag
```

Any one configured condition can reveal the trait. Only assigned, unrevealed IDs are considered. Results are ordered by player ID then trait ID.

- [ ] **Step 1: Write failing tests for every condition and invariants**

Include boundary values, already revealed, unassigned, and `revealedHiddenTraitIds ⊆ hiddenTraitIds`.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/player/characterTraitDiscovery.test.ts`

- [ ] **Step 3: Implement pure reveal function**

The function returns discovery records but does not create notifications itself.

- [ ] **Step 4: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/player/characterTraitDiscovery.test.ts
npm run typecheck
git add src/domain/player/characterTraitDiscovery.ts tests/unit/domain/player/characterTraitDiscovery.test.ts
git commit -m "feat: discover hidden character traits"
```

### Task 5: Event-specific and post-action discovery handoff

**Files:**
- Modify: `src/domain/events/resolveEventChoice.ts`
- Modify: `worker/game/applyGameAction.ts`
- Create: `tests/unit/domain/events/phase21CharacterTraitEventDiscovery.test.ts`
- Modify: `tests/unit/worker/gameAction.test.ts`

**Interfaces:**

Extend event result exactly:

```ts
export interface ResolveEventChoiceResult {
  state: GameState;
  occurrence: EventOccurrence;
  characterTraitDiscoveries: CharacterTraitDiscovery[];
}
```

`resolveEventChoice` runs:

```ts
const discovery = discoverEligibleCharacterTraits(nextState, data, {
  eventTags: event.tags,
  captainPlayerId: nextState.teamDynamics.captainPlayerId,
  viceCaptainPlayerId: nextState.teamDynamics.viceCaptainPlayerId,
});
```

It returns `discovery.state` and `discovery.discoveries` after event effects/history are finalized.

At worker level, refactor `applyGameAction` from direct `return` in each switch case to:

```ts
const applied = applyActionByType(canonicalState, teamSelection, action, context);
const finalized = discoverEligibleCharacterTraits(applied.state, gameData, {
  captainPlayerId: applied.state.teamDynamics.captainPlayerId,
  viceCaptainPlayerId: applied.state.teamDynamics.viceCaptainPlayerId,
});
return appendCharacterTraitDiscoveryNotifications(
  { ...applied, state: finalized.state },
  eventSpecificDiscoveries + finalized.discoveries,
  gameData,
);
```

Implement this without a recursive second action call. Event-specific discoveries are taken from `ResolveEventChoiceResult`; because those traits are already revealed, the general finalizer will not rediscover them.

- [ ] **Step 1: Write failing event-tag test**

Assign an unrevealed trait with `event-tag: analysis`, resolve an `analysis` event, and assert the result contains one `characterTraitDiscoveries` entry and the state reveals it.

- [ ] **Step 2: Write failing post-action threshold test in `tests/unit/worker/gameAction.test.ts`**

Set an assigned `trust-min:70` trait with trust 70, run a canonical action, and assert reveal occurs without creating a new pending event.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/unit/domain/events/phase21CharacterTraitEventDiscovery.test.ts tests/unit/worker/gameAction.test.ts
```

- [ ] **Step 4: Implement the exact domain-to-worker handoff above**

Keep `surfaceWeeklyEvent` unchanged. Do not inject trait discovery into `EventOccurrence.visibleResultCodes`.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/events/phase21CharacterTraitEventDiscovery.test.ts tests/unit/worker/gameAction.test.ts
npm run typecheck
git add src/domain/events/resolveEventChoice.ts worker/game/applyGameAction.ts tests/unit/domain/events/phase21CharacterTraitEventDiscovery.test.ts tests/unit/worker/gameAction.test.ts
git commit -m "feat: reveal character traits from gameplay context"
```

### Task 6: Compact discovery notification

**Files:**
- Modify: `src/domain/notifications/gameNotifications.ts`
- Modify: `worker/game/applyGameAction.ts`
- Create: `tests/unit/notifications/phase21CharacterTraitNotifications.test.ts`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `tests/unit/features/home/HomeScreen.test.tsx`

**Interfaces:**

```ts
export interface CharacterTraitDiscoveredNotification {
  id: string;
  type: "character-trait-discovered";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: {
    playerId: PlayerId;
    displayName: string;
    traitId: string;
    traitName: string;
    description: string;
  };
}

export function buildCharacterTraitDiscoveredNotification(
  state: GameState,
  discovery: CharacterTraitDiscovery,
  data: GameDataRegistry,
): CharacterTraitDiscoveredNotification;
```

Worker helper contract:

```ts
function appendCharacterTraitDiscoveryNotifications(
  applied: AppliedGameAction,
  discoveries: readonly CharacterTraitDiscovery[],
  data: GameDataRegistry,
): AppliedGameAction;
```

Append discoveries in deterministic order with `appendNotification`; same notification ID is de-duplicated and newest-per-type retention is preserved.

- [ ] **Step 1: Write failing builder/retention tests**

Assert trait/player display data and newest-only behavior.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/notifications/phase21CharacterTraitNotifications.test.ts`

- [ ] **Step 3: Implement worker notification finalization**

Event-tag discoveries from Task 5 and generic post-action discoveries flow through the same helper. Notification creation must not modify `pendingEvent`.

- [ ] **Step 4: Add Home UI test**

```ts
expect(screen.getByText("新しい個性を発見！")).toBeInTheDocument();
expect(screen.queryByTestId("fullscreen-event")).not.toBeInTheDocument();
```

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run tests/unit/notifications/phase21CharacterTraitNotifications.test.ts tests/unit/features/home/HomeScreen.test.tsx tests/unit/worker/gameAction.test.ts
npm run typecheck
git add src/domain/notifications/gameNotifications.ts worker/game/applyGameAction.ts src/features/home/HomeScreen.tsx tests/unit/notifications/phase21CharacterTraitNotifications.test.ts tests/unit/features/home/HomeScreen.test.tsx tests/unit/worker/gameAction.test.ts
git commit -m "feat: notify discovered character traits"
```

### Task 7: Player Hub revealed-trait presentation

**Files:**
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/player-hub.css`
- Modify: `tests/unit/features/team/PlayerHubScreen.test.tsx`

**Interfaces:**
- Show `aria-label="発見した個性"` only when a `revealedHiddenTraitId` resolves in `data.characterTraits`.
- Never render assigned-but-unrevealed IDs.

- [ ] **Step 1: Add failing hidden-vs-revealed UI test**

```ts
expect(screen.queryByText("面倒見がいい")).not.toBeInTheDocument();
// rerender with character.caring revealed
expect(screen.getByText("面倒見がいい")).toBeInTheDocument();
```

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/features/team/PlayerHubScreen.test.tsx`

- [ ] **Step 3: Render discovered trait name and description**

Ignore unresolved IDs defensively in UI.

- [ ] **Step 4: Run GREEN and commit**

```bash
npx vitest run tests/unit/features/team/PlayerHubScreen.test.tsx
npm run typecheck
git add src/features/team/PlayerHubScreen.tsx src/features/team/player-hub.css tests/unit/features/team/PlayerHubScreen.test.tsx
git commit -m "feat: show discovered character traits"
```

### Task 8: PR21-3 verification gate

**Files:**
- No planned production changes.

- [ ] **Step 1: Run focused suites**

```bash
npx vitest run \
  tests/unit/data/phase21CharacterTraits.test.ts \
  tests/unit/domain/player/characterTraitAssignment.test.ts \
  tests/unit/domain/player/characterTraitDiscovery.test.ts \
  tests/unit/domain/events/phase21CharacterTraitEventDiscovery.test.ts \
  tests/unit/notifications/phase21CharacterTraitNotifications.test.ts \
  tests/unit/worker/applyGameAction.test.ts \
  tests/unit/worker/gameAction.test.ts \
  tests/unit/worker/academicYearRecruitment.test.ts \
  tests/unit/features/home/HomeScreen.test.tsx \
  tests/unit/features/team/PlayerHubScreen.test.tsx
```

- [ ] **Step 2: Run static checks and full verification**

```bash
npm run typecheck
npm run lint
npm run format:check
npm run verify
```

- [ ] **Step 3: Re-run deterministic 10,000-player assignment audit twice**

Both runs must produce identical assignment counts and IDs; assigned share must be 58-62%; `randomCursor` remains unchanged.

- [ ] **Step 4: Run branch safe gate and remove temporary workflow before PR**

Expected TDD RED checks must be converted to successful workflow conclusions after verifying the expected failure. Do not knowingly open a red PR.

- [ ] **Step 5: Final diff invariants**

```text
schemaVersion remains 9
max hidden character traits/player = 1
unrevealed traits do not appear in UI
no character trait contains ability/match modifiers
discovery notifications are compact
normal event cadence is unchanged
no temporary workflow file remains
```
