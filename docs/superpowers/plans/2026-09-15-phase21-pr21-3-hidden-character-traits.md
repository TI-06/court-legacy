# Phase21 PR21-3 Hidden Character Traits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing hidden-trait fields into a deterministic, discoverable character-trait system with compact notifications and no unseen performance bonuses.

**Architecture:** Add a separate character-trait catalog to game data rather than reusing performance `traitIds`. Assign zero or one hidden character trait per player deterministically using stable `seed + playerId` hashing, with a 60% assignment rate and no `randomCursor` consumption. Reveal assigned traits only through explicit discovery contexts, then surface them in Player Hub and compact notifications. Keep all pre-discovery performance effects at zero.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest, React 19, existing GameDataRegistry, existing notification infrastructure, existing schema v9 fields created in PR21-2.

**Spec:** `docs/superpowers/specs/2026-09-15-phase21-player-relationships-fullscreen-events-design.md`

## Global Constraints

- Each player has at most one hidden character trait in Phase21.
- Assignment rate is exactly 60%; 40% of players intentionally have no hidden character trait.
- Assignment is deterministic from stable inputs and never advances simulation `randomCursor`.
- `hiddenTraitAssignmentInitialized=true` means assignment was evaluated, including the intentional no-trait case.
- `revealedHiddenTraitIds` is always a subset of `hiddenTraitIds`.
- Hidden character traits are distinct from performance `traitIds` and must not use ability/situation modifier effects.
- Before reveal, a hidden character trait applies no training-growth or match-stat modifier and is not shown in UI.
- Discovery is contextual, not a generic random popup.
- Discovery notifications are compact informational notifications and do not consume the three-week event slot.
- Existing v8 saves are already migrated to v9 by PR21-2 with `hiddenTraitAssignmentInitialized=false`; PR21-3 performs deterministic backfill on the first canonicalization path that has game data available.
- Use TDD and branch safe-gate verification before PR creation.

---

## File Structure

- Modify `src/domain/validation/gameDataSchema.ts`: add separate character-trait schema.
- Modify `src/data/rawGameData.ts`: add curated 10-trait catalog.
- Modify `src/data/dataRegistry.ts`: expose `characterTraits` read-only map and validate uniqueness.
- Create `src/domain/player/characterTraitAssignment.ts`: deterministic 60% assignment/backfill helper.
- Create `src/domain/player/characterTraitDiscovery.ts`: pure discovery eligibility/reveal helper.
- Modify `src/domain/generation/generatePlayer.ts`: initialize assignment deterministically for newly generated players.
- Modify `worker/game/applyGameAction.ts`: ensure legacy/uninitialized active players are backfilled before domain action processing and evaluate weekly-context discoveries at a stable point.
- Modify `src/domain/events/resolveEventChoice.ts`: evaluate event-tag discovery after event resolution.
- Modify `src/domain/notifications/gameNotifications.ts`: add compact character-trait discovery notification and Phase21 relationship-change notification type.
- Modify `src/features/team/PlayerHubScreen.tsx`: show discovered character trait only.
- Modify `src/features/team/player-hub.css`: trait card styling.
- Modify the existing home notification rendering path to display new compact notifications; use the current notification host rather than fullscreen events.
- Create `tests/unit/domain/player/characterTraitAssignment.test.ts`.
- Create `tests/unit/domain/player/characterTraitDiscovery.test.ts`.
- Create `tests/unit/domain/events/phase21CharacterTraitEventDiscovery.test.ts`.
- Create `tests/unit/notifications/phase21CharacterTraitNotifications.test.ts`.
- Modify `tests/unit/features/team/PlayerHubScreen.test.tsx`.
- Add worker-focused regression coverage beside existing `applyGameAction` tests.

---

### Task 1: Character trait catalog and registry

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

Add to `RawGameData`:

```ts
characterTraits: CharacterTraitDefinition[];
```

Add to `GameDataRegistry`:

```ts
characterTraits: ReadonlyMap<string, CharacterTraitDefinition>;
```

Initial catalog IDs and intended flavor:

```text
character.caring          面倒見がいい
character.analytical      研究熱心
character.training-lover  練習の虫
character.resilient       負けを引きずらない
character.team-first      仲間思い
character.bottles-up      一人で抱え込みやすい
character.spotlight       注目されると燃える
character.competitive-growth 競争相手がいると伸びる
character.quiet-observer  観察眼が鋭い
character.clutch-support  苦しい時ほど仲間を支える
```

None of these definitions contains ability or direct match-stat effects.

- [ ] **Step 1: Write failing catalog validation tests**

```ts
expect(data.characterTraits.size).toBe(10);
for (const trait of data.characterTraits.values()) {
  expect(trait.discoveryConditions.length).toBeGreaterThan(0);
}
expect(data.characterTraits.get("character.caring")?.name).toBe("面倒見がいい");
```

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/data/phase21CharacterTraits.test.ts`

- [ ] **Step 3: Add schema, raw catalog, registry map, uniqueness check**

Use the existing `createReadOnlyMap` and `assertUniqueIds` paths in `dataRegistry.ts`. Do not alter performance-trait reference validation.

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

### Task 2: Deterministic 60% assignment without random-cursor changes

**Files:**
- Create: `src/domain/player/characterTraitAssignment.ts`
- Modify: `src/domain/generation/generatePlayer.ts`
- Create: `tests/unit/domain/player/characterTraitAssignment.test.ts`

**Interfaces:**

```ts
export interface CharacterTraitAssignmentResult {
  hiddenTraitIds: string[];
  hiddenTraitAssignmentInitialized: true;
}

export function assignCharacterTraitDeterministically(
  seed: string,
  playerId: PlayerId,
  characterTraitIds: readonly string[],
): CharacterTraitAssignmentResult;

export function ensureCharacterTraitAssignments(
  state: GameState,
  data: GameDataRegistry,
): GameState;
```

Algorithm contract:

1. Sort catalog IDs lexicographically before selection.
2. Hash the UTF-8 string `${seed}:phase21-character-trait:${playerId}` with a deterministic 32-bit FNV-1a implementation local to this module.
3. `hash % 100 < 60` means assigned; otherwise assigned list is `[]`.
4. If assigned, choose `sortedIds[Math.floor(hash / 100) % sortedIds.length]`.
5. Never instantiate or consume `SeededRandom` and never modify `state.randomCursor`.
6. If `hiddenTraitAssignmentInitialized` is already true, preserve current `hiddenTraitIds` exactly.

- [ ] **Step 1: Write deterministic assignment tests**

Assert same seed/player gives same result, different players produce stable possibly different results, assigned players have one ID maximum, and a 10,000-player synthetic sample lands between 58% and 62% assigned.

- [ ] **Step 2: Add cursor invariance test**

```ts
const before = state.randomCursor;
const next = ensureCharacterTraitAssignments(state, data);
expect(next.randomCursor).toBe(before);
expect(next.players[playerId].hiddenTraitAssignmentInitialized).toBe(true);
```

- [ ] **Step 3: Run RED**

`npx vitest run tests/unit/domain/player/characterTraitAssignment.test.ts`

- [ ] **Step 4: Implement hash/assignment/backfill helper**

`ensureCharacterTraitAssignments` clones only players that were not initialized.

- [ ] **Step 5: Integrate new-player generation**

After `generatePlayer` knows the game seed is required for assignment. Do not silently add ambient global seed access. Extend `GeneratePlayerInput` with `worldSeed: string` and update `generateInitialSquad`, `generateIntake`, and their call sites to pass `state.seed`/creation seed explicitly. Set:

```ts
hiddenTraitIds: assignment.hiddenTraitIds,
revealedHiddenTraitIds: [],
hiddenTraitAssignmentInitialized: true,
```

- [ ] **Step 6: Run generation regression tests and typecheck**

```bash
npx vitest run tests/unit/domain/player/characterTraitAssignment.test.ts tests/unit/domain/generation
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/domain/player/characterTraitAssignment.ts src/domain/generation/generatePlayer.ts tests/unit/domain/player/characterTraitAssignment.test.ts
git commit -m "feat: assign hidden character traits deterministically"
```

### Task 3: Legacy active-player backfill on authoritative action path

**Files:**
- Modify: `worker/game/applyGameAction.ts`
- Modify: worker/applyGameAction tests that cover canonical action processing.

**Interfaces:**
- Consumes: `ensureCharacterTraitAssignments(state, data)`.
- Produces: every authoritative action starts from a state whose active players have `hiddenTraitAssignmentInitialized=true`, without cursor change.

- [ ] **Step 1: Add failing worker regression test**

Construct a schema-v9 state representing migrated legacy data with one active player:

```ts
hiddenTraitIds: [],
revealedHiddenTraitIds: [],
hiddenTraitAssignmentInitialized: false,
```

Apply a non-random administrative action and assert returned state initializes the assignment while preserving the incoming `randomCursor` except for any random use intrinsic to that action. Use an action whose existing contract consumes zero random values so the assertion can be exact.

- [ ] **Step 2: Run RED**

Run the exact worker test file with `npx vitest run <worker-test-path>`.

- [ ] **Step 3: Normalize state once at the start of `applyGameAction`**

```ts
const canonicalState = ensureCharacterTraitAssignments(state, data);
```

All switch branches use `canonicalState`, not the pre-normalized input. Do not persist a second assignment pass elsewhere on every render.

- [ ] **Step 4: Run GREEN and relevant server-action regressions**

```bash
npx vitest run <worker-test-path>
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add worker/game/applyGameAction.ts <worker-test-path>
git commit -m "feat: backfill legacy character traits on server actions"
```

### Task 4: Discovery engine

**Files:**
- Create: `src/domain/player/characterTraitDiscovery.ts`
- Create: `tests/unit/domain/player/characterTraitDiscovery.test.ts`

**Interfaces:**

```ts
export interface CharacterTraitDiscoveryContext {
  eventTags?: readonly string[];
  establishedSpecialRelationshipKinds?: readonly SpecialRelationshipKind[];
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

- `trust-min`: player trust >= configured value.
- `appearances-min`: `player.career.appearances >= value`.
- `captaincy`: player equals current captain or vice-captain from context/team dynamics.
- `special-relationship`: player participates in an active bond of requested kind, or any kind when omitted.
- `event-tag`: context `eventTags` contains configured tag.
- A trait is revealed when **any** of its configured discovery conditions is true.
- Only assigned but unrevealed traits are considered.
- Discovery order is deterministic by player ID then trait ID.

- [ ] **Step 1: Write failing pure discovery tests**

Cover trust threshold below/at boundary, appearances threshold, special relationship, event-tag context, already revealed trait, unassigned trait, and subset invariant.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/player/characterTraitDiscovery.test.ts`

- [ ] **Step 3: Implement pure reveal function**

Do not create notifications inside this pure function. It returns discoveries for callers to translate into notifications.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/unit/domain/player/characterTraitDiscovery.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/player/characterTraitDiscovery.ts tests/unit/domain/player/characterTraitDiscovery.test.ts
git commit -m "feat: discover hidden character traits"
```

### Task 5: Event and weekly discovery integration

**Files:**
- Modify: `src/domain/events/resolveEventChoice.ts`
- Modify: `worker/game/applyGameAction.ts`
- Create: `tests/unit/domain/events/phase21CharacterTraitEventDiscovery.test.ts`
- Modify: worker weekly-progression tests.

**Interfaces:**
- Event resolution passes `event.tags` and newly created special-relationship kinds into `discoverEligibleCharacterTraits` after all choice effects have applied.
- Weekly/action canonicalization evaluates non-event discovery conditions after state-changing action completion so trust/appearances/captaincy thresholds can reveal traits.

- [ ] **Step 1: Write failing event discovery test**

Create a player assigned `character.analytical` whose definition includes `event-tag: analysis`, resolve an event tagged `analysis`, and assert the trait is appended to `revealedHiddenTraitIds` exactly once.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/events/phase21CharacterTraitEventDiscovery.test.ts`

- [ ] **Step 3: Integrate discovery after event effects**

Preserve event `visibleResultCodes`; discovery itself is returned through state/notification integration, not injected as a fake ability result.

- [ ] **Step 4: Add weekly threshold test**

Set assigned trait with `trust-min:70`, player trust=70, run a weekly/action path, and assert reveal occurs without changing event cadence or creating `pendingEvent`.

- [ ] **Step 5: Run GREEN**

```bash
npx vitest run tests/unit/domain/events/phase21CharacterTraitEventDiscovery.test.ts <worker-weekly-test-path>
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/domain/events/resolveEventChoice.ts worker/game/applyGameAction.ts tests/unit/domain/events/phase21CharacterTraitEventDiscovery.test.ts <worker-weekly-test-path>
git commit -m "feat: reveal character traits from gameplay context"
```

### Task 6: Compact Phase21 notifications

**Files:**
- Modify: `src/domain/notifications/gameNotifications.ts`
- Create: `tests/unit/notifications/phase21CharacterTraitNotifications.test.ts`
- Modify: existing home notification rendering component(s) selected by current notification-host tests.
- Modify: corresponding UI tests.

**Interfaces:**

Add notification union members:

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

Retention contract: `appendNotification` keeps only the newest item per notification type, matching existing training/concern behavior.

- [ ] **Step 1: Write failing notification-builder tests**

Assert copy payload resolves player and trait names and duplicate IDs are not appended twice.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/notifications/phase21CharacterTraitNotifications.test.ts`

- [ ] **Step 3: Add builders/selectors and wire domain discoveries/transitions to append notifications**

Notification creation occurs at the authoritative state transition point. It must not create `pendingEvent` and must not consume event cadence.

- [ ] **Step 4: Add compact UI regression test**

Assert notification card/text appears on Home and `screen.queryByTestId("fullscreen-event")` remains absent for an informational discovery notification.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run tests/unit/notifications/phase21CharacterTraitNotifications.test.ts tests/unit/features/home/HomeScreen.test.tsx
npm run typecheck
git add src/domain/notifications/gameNotifications.ts tests/unit/notifications/phase21CharacterTraitNotifications.test.ts src/features/home tests/unit/features/home
git commit -m "feat: notify character and relationship discoveries"
```

### Task 7: Discovered character trait on Player Hub

**Files:**
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/player-hub.css`
- Modify: `tests/unit/features/team/PlayerHubScreen.test.tsx`

**Interfaces:**
- Consumes: `selectedPlayer.hiddenTraitIds`, `revealedHiddenTraitIds`, `data.characterTraits`.
- Produces: `aria-label="発見した個性"` section only when at least one revealed trait exists.

- [ ] **Step 1: Add failing visibility tests**

Two cases:

```ts
// assigned but not revealed
expect(screen.queryByText("面倒見がいい")).not.toBeInTheDocument();

// revealed
expect(screen.getByText("面倒見がいい")).toBeInTheDocument();
expect(screen.getByText(/後輩/)).toBeInTheDocument();
```

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/features/team/PlayerHubScreen.test.tsx`

- [ ] **Step 3: Render only revealed IDs that resolve in registry**

Do not show placeholders for hidden-but-unrevealed IDs. Invalid IDs should be ignored defensively in UI while codec/data validation catches canonical errors.

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
  tests/unit/features/team/PlayerHubScreen.test.tsx
```

- [ ] **Step 2: Run static checks**

```bash
npm run typecheck
npm run lint
npm run format:check
```

- [ ] **Step 3: Run full verification**

`npm run verify`

- [ ] **Step 4: Run explicit deterministic backfill audit**

Use a focused test or script that initializes at least 10,000 synthetic player IDs twice and asserts identical assignments, 58-62% assignment share, max one trait/player, and unchanged `randomCursor`.

- [ ] **Step 5: Run branch safe gate before PR and remove temporary workflow**

Do not open PR if any safe-gate command is red. Expected RED demonstration workflows must themselves conclude success.

- [ ] **Step 6: Review final diff invariants**

Confirm no character trait definition contains ability modifiers, unrevealed traits are absent from Player Hub, discovery notifications are not fullscreen, schema stays at v9, and event cadence code is unchanged.
