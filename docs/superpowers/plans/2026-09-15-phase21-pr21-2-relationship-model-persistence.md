# Phase21 PR21-2 Relationship Model and Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add canonical special-relationship state, relationship presentation, explicit event-driven relationship-tag transitions, graduation legacy archival, and schema v9 persistence while preserving v8 saves.

**Architecture:** Keep the existing numeric `playerRelationships` map as the canonical 0-100 affinity score and add a separate bounded `playerRelationshipBonds` map keyed by the existing sorted `relationshipKey`. Encode special relationships as explicit event effects so tags are created or removed by authored events rather than inferred from score thresholds alone. Increment persistence to v9 in this PR and introduce every Phase21 persisted field with safe empty defaults, allowing PR21-3/4 to add behavior without another schema bump.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest, React 19 for Player Hub presentation, existing game-state codec and academic-year progression.

**Spec:** `docs/superpowers/specs/2026-09-15-phase21-player-relationships-fullscreen-events-design.md`

## Global Constraints

- `playerRelationships` remains the canonical 0-100 affinity map with default score 50 when absent.
- UI relationship labels are exactly: 0-19 `犬猿`, 20-39 `不仲`, 40-59 `普通`, 60-79 `好相性`, 80-100 `親友`.
- Special relationship kinds are exactly `rival`, `mentor`, `partner`.
- A pair may hold at most two special relationship tags.
- `mentor` is directional and stores mentor/protege identity.
- Special relationships are created/removed by explicit event effects; numeric thresholds alone do not silently create them.
- Rivalry may coexist with low affinity; low score alone never removes `rival`.
- Graduation archives notable active bonds, then removes active bonds that reference graduated players.
- Relationship legacy history is bounded to the newest 200 records.
- PR21-2 increments `CURRENT_GAME_SCHEMA_VERSION` from 8 to 9 and introduces all Phase21 persisted fields.
- v8 saves must decode successfully and re-encode canonically as v9 without changing existing numeric relationships, pending events, event history, personalities, or performance traits.
- Use TDD and a branch safe gate before opening the PR. Intentional RED workflows must conclude success after verifying the expected test failure.

---

## File Structure

- Create `src/domain/relationships/relationshipTypes.ts`: special-bond and legacy types.
- Create `src/domain/relationships/relationshipPresentation.ts`: score-to-label/gauge and teammate relationship selector.
- Create `src/domain/relationships/specialRelationships.ts`: pure add/remove/update helpers and validation.
- Modify `src/domain/model/GameState.ts`: v9 bond map and legacy history.
- Modify `src/domain/model/Player.ts`: introduce Phase21 persisted discovery fields now (`revealedHiddenTraitIds`, `hiddenTraitAssignmentInitialized`) with no PR21-3 behavior yet.
- Modify `src/domain/model/Event.ts`: add `recentActorPairKeys` now with empty/default behavior; PR21-4 uses it.
- Modify `src/domain/validation/gameDataSchema.ts`: add explicit `special-relationship-add` and `special-relationship-remove` event effects.
- Modify `src/domain/events/resolveEventChoice.ts`: apply special-relationship event effects and emit visible result codes.
- Modify `src/domain/calendar/academicYearProgression.ts`: archive bonds involving graduates and remove them from active state.
- Modify `src/persistence/gameStateCodec.ts`: v9 schema/defaults/migration.
- Modify `src/features/team/PlayerHubScreen.tsx`: display relationship list and tags.
- Modify `src/features/team/player-hub.css`: relationship UI.
- Create `tests/unit/domain/relationships/relationshipPresentation.test.ts`.
- Create `tests/unit/domain/relationships/specialRelationships.test.ts`.
- Create `tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts`.
- Create `tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts`.
- Create `tests/unit/persistence/phase21GameStateMigration.test.ts`.
- Modify `tests/unit/features/team/PlayerHubScreen.test.tsx`.

---

### Task 1: Canonical v9 relationship and discovery state types

**Files:**
- Create: `src/domain/relationships/relationshipTypes.ts`
- Modify: `src/domain/model/GameState.ts`
- Modify: `src/domain/model/Player.ts`
- Modify: `src/domain/model/Event.ts`
- Create: `tests/unit/domain/relationships/specialRelationships.test.ts`

**Interfaces:**

```ts
export type SpecialRelationshipKind = "rival" | "mentor" | "partner";

export interface SpecialRelationshipTag {
  kind: SpecialRelationshipKind;
  establishedDate: GameDate;
  sourceEventId: EventId | null;
  lastReinforcedDate: GameDate;
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
```

Add to `GameState`:

```ts
playerRelationshipBonds: Record<string, PlayerRelationshipBond>;
```

Add to `GameHistory`:

```ts
relationshipLegacyHistory: RelationshipLegacyRecord[];
```

Add to `Player`:

```ts
revealedHiddenTraitIds: string[];
hiddenTraitAssignmentInitialized: boolean;
```

Add to `EventMemory`:

```ts
recentActorPairKeys: string[];
```

- [ ] **Step 1: Write failing type/behavior tests for bond helpers**

The test should import helpers that do not yet exist and assert canonical ordering and max-two behavior:

```ts
expect(createRelationshipBond(playerId("b"), playerId("a"))).toEqual({
  playerIds: [playerId("a"), playerId("b")],
  tags: [],
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run tests/unit/domain/relationships/specialRelationships.test.ts`

Expected: FAIL because relationship types/helpers do not exist.

- [ ] **Step 3: Add the types and initialize empty/default fields in new-game factories**

Update `createEmptyGameHistory()` to return `relationshipLegacyHistory: []`. Update all game creation paths/fixtures required by typecheck to initialize `playerRelationshipBonds: {}`, `recentActorPairKeys: []`, and new Player fields for freshly generated players.

- [ ] **Step 4: Set schema constant to 9**

```ts
export const CURRENT_GAME_SCHEMA_VERSION = 9;
```

Do not add character-trait assignment behavior in this task.

- [ ] **Step 5: Run typecheck and focused tests**

```bash
npx vitest run tests/unit/domain/relationships/specialRelationships.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/relationships/relationshipTypes.ts src/domain/model/GameState.ts src/domain/model/Player.ts src/domain/model/Event.ts src/domain/generation/generatePlayer.ts tests/unit/domain/relationships/specialRelationships.test.ts
git commit -m "feat: add Phase21 relationship state model"
```

### Task 2: Special relationship pure helpers and invariants

**Files:**
- Create: `src/domain/relationships/specialRelationships.ts`
- Modify: `tests/unit/domain/relationships/specialRelationships.test.ts`

**Interfaces:**

```ts
export function addSpecialRelationship(
  state: GameState,
  input: {
    leftPlayerId: PlayerId;
    rightPlayerId: PlayerId;
    tag: SpecialRelationshipTag;
  },
): GameState;

export function removeSpecialRelationship(
  state: GameState,
  input: {
    leftPlayerId: PlayerId;
    rightPlayerId: PlayerId;
    kind: SpecialRelationshipKind;
  },
): GameState;

export function getRelationshipBond(
  state: GameState,
  leftPlayerId: PlayerId,
  rightPlayerId: PlayerId,
): PlayerRelationshipBond | null;
```

Behavior contract:

- reject self-pairs;
- canonicalize pair ordering with `relationshipKey`;
- `mentor` requires mentor/protege IDs equal to the pair and distinct;
- adding same kind reinforces `lastReinforcedDate` rather than duplicating;
- adding a third distinct tag throws `relationship pair cannot exceed two special tags`;
- removal deletes the map entry when no tags remain.

- [ ] **Step 1: Add failing invariant tests**

Cover duplicate reinforcement, mentor direction validation, max-two rejection, and cleanup after last tag removal.

- [ ] **Step 2: Run RED**

Run: `npx vitest run tests/unit/domain/relationships/specialRelationships.test.ts`

Expected: new invariant cases fail.

- [ ] **Step 3: Implement pure immutable helpers**

Use `relationshipKey(left, right)` and clone only affected record/tag arrays.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/unit/domain/relationships/specialRelationships.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/relationships/specialRelationships.ts tests/unit/domain/relationships/specialRelationships.test.ts
git commit -m "feat: add special relationship helpers"
```

### Task 3: Explicit special-relationship event effects

**Files:**
- Modify: `src/domain/validation/gameDataSchema.ts`
- Modify: `src/domain/events/resolveEventChoice.ts`
- Create: `tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts`

**Interfaces:**

Add event effects:

```ts
{
  type: "special-relationship-add";
  kind: "rival" | "mentor" | "partner";
  mentorActorIndex?: 0 | 1;
}

{
  type: "special-relationship-remove";
  kind: "rival" | "mentor" | "partner";
}
```

Rules:

- effects require exactly two actor players;
- `mentor` add requires `mentorActorIndex`, and the other actor becomes protege;
- non-mentor add must reject/ignore `mentorActorIndex` at schema level by using a discriminated nested union or super-refinement;
- add stores `state.date`, current event ID as `sourceEventId`, and `lastReinforcedDate=state.date`;
- visible result codes are `特殊関係 ライバル成立`, `特殊関係 師弟成立`, `特殊関係 相棒成立`, or corresponding `解消` text.

- [ ] **Step 1: Write failing schema and resolution tests**

Example:

```ts
const effect = {
  type: "special-relationship-add",
  kind: "mentor",
  mentorActorIndex: 0,
};
expect(eventEffectSchema.parse(effect)).toEqual(effect);
```

Resolve a two-actor event and assert the bond plus visible result.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts`

- [ ] **Step 3: Extend the Zod event effect union and switch in `applyEffect`**

Use `addSpecialRelationship`/`removeSpecialRelationship`; do not embed a second implementation in `resolveEventChoice.ts`.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts tests/unit/domain/relationships/specialRelationships.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/validation/gameDataSchema.ts src/domain/events/resolveEventChoice.ts tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts
git commit -m "feat: support special relationship event effects"
```

### Task 4: Relationship score presentation and Player Hub UI

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

Sort UI rows by special-tag presence first, then absolute distance from 50 descending, then display name/ID deterministic tie-break. Only current teammates are shown.

- [ ] **Step 1: Write failing boundary tests**

```ts
expect(relationshipLabel(19)).toBe("犬猿");
expect(relationshipLabel(20)).toBe("不仲");
expect(relationshipLabel(39)).toBe("不仲");
expect(relationshipLabel(40)).toBe("普通");
expect(relationshipLabel(59)).toBe("普通");
expect(relationshipLabel(60)).toBe("好相性");
expect(relationshipLabel(79)).toBe("好相性");
expect(relationshipLabel(80)).toBe("親友");
```

Also assert absent numeric entry defaults to 50.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/relationships/relationshipPresentation.test.ts`

- [ ] **Step 3: Implement selector and labels**

Clamp presentation input to 0-100 defensively but never mutate state.

- [ ] **Step 4: Add failing Player Hub test**

Assert selected player detail includes heading `人間関係`, teammate name, `好相性`, a gauge with accessible label `関係値 74`, and `ライバル` tag when bond exists.

- [ ] **Step 5: Render relationship section in Player Hub**

Use semantic list rows and an accessible progress element or meter equivalent. Do not display all numeric relationship pairs in roster overview; only detail screen.

- [ ] **Step 6: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/relationships/relationshipPresentation.test.ts tests/unit/features/team/PlayerHubScreen.test.tsx
npm run typecheck
git add src/domain/relationships/relationshipPresentation.ts src/features/team/PlayerHubScreen.tsx src/features/team/player-hub.css tests/unit/domain/relationships/relationshipPresentation.test.ts tests/unit/features/team/PlayerHubScreen.test.tsx
git commit -m "feat: show teammate relationships in Player Hub"
```

### Task 5: Graduation archival and active-bond cleanup

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

Archive each active bond once if at least one participant graduates. Capture both display names before deleting players/rebuilding active relationships. `finalRelationshipScore` uses current numeric score or default 50. Keep newest 200 records.

- [ ] **Step 1: Write failing annual-transition test**

Prepare a user-school third-year player with an `partner` bond to a returning second-year player, advance academic year, then assert:

```ts
expect(next.playerRelationshipBonds[key]).toBeUndefined();
expect(next.history.relationshipLegacyHistory.at(-1)).toMatchObject({
  playerIds: [graduateId, returningId].sort(),
  finalRelationshipScore: 84,
});
```

Also assert two graduating players sharing one bond create only one archive record.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts`

- [ ] **Step 3: Implement archival before relationship rebuild**

Call archival after graduate IDs are known and before `rebuildRelationships`. Keep active bonds whose two players remain active.

- [ ] **Step 4: Add bounded-history test**

Seed 200 historical records plus one archived bond and assert length remains 200 and newest record is retained.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts
npm run typecheck
git add src/domain/calendar/academicYearProgression.ts tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts
git commit -m "feat: archive player relationships at graduation"
```

### Task 6: Schema v8 to v9 codec migration

**Files:**
- Modify: `src/persistence/gameStateCodec.ts`
- Create: `tests/unit/persistence/phase21GameStateMigration.test.ts`
- Modify: `tests/unit/persistence/gameStateCodec.test.ts` only when existing current-version assertions require version 9.

**Interfaces:**

v8 -> v9 defaults:

```ts
playerRelationshipBonds = {}
history.relationshipLegacyHistory = []
eventMemory.recentActorPairKeys = []
player.revealedHiddenTraitIds = []
player.hiddenTraitAssignmentInitialized = false
```

Canonical v9 must strictly validate special relationship tags and cap each bond at two tags.

- [ ] **Step 1: Write a failing v8 fixture migration test**

Take a valid encoded v8 state, delete every Phase21 field, set `schemaVersion: 8`, preserve a known numeric relationship and pending event, decode, and assert:

```ts
expect(decoded.schemaVersion).toBe(9);
expect(decoded.playerRelationshipBonds).toEqual({});
expect(decoded.history.relationshipLegacyHistory).toEqual([]);
expect(decoded.eventMemory.recentActorPairKeys).toEqual([]);
expect(decoded.players[player].revealedHiddenTraitIds).toEqual([]);
expect(decoded.players[player].hiddenTraitAssignmentInitialized).toBe(false);
expect(decoded.playerRelationships[knownKey]).toBe(knownValue);
expect(decoded.pendingEvent).toEqual(originalPendingEvent);
```

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/persistence/phase21GameStateMigration.test.ts`

- [ ] **Step 3: Add v9 Zod schemas and migration normalization**

Add explicit schemas for special tags/bonds/legacy and normalize old players/event memory/history before final `GameState` parse. Reject malformed mentor direction and bond tag arrays longer than two.

- [ ] **Step 4: Add canonical round-trip test**

Encode/decode a v9 state with rival + mentor tags and one legacy record; assert deep equality for Phase21 fields.

- [ ] **Step 5: Run persistence regression suite**

```bash
npx vitest run tests/unit/persistence/phase21GameStateMigration.test.ts tests/unit/persistence/gameStateCodec.test.ts tests/unit/persistence/phase20PracticeOfferCanonicalCodec.test.ts tests/unit/persistence/phase20PracticeOfferHistoryCodec.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/persistence/gameStateCodec.ts tests/unit/persistence/phase21GameStateMigration.test.ts tests/unit/persistence/gameStateCodec.test.ts
git commit -m "feat: migrate game state to schema v9"
```

### Task 7: PR21-2 verification gate

**Files:**
- No planned production changes.

- [ ] **Step 1: Run all Phase21-2 focused suites**

```bash
npx vitest run \
  tests/unit/domain/relationships/specialRelationships.test.ts \
  tests/unit/domain/relationships/relationshipPresentation.test.ts \
  tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts \
  tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts \
  tests/unit/persistence/phase21GameStateMigration.test.ts \
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

- [ ] **Step 4: Run branch safe gate before PR**

Temporary workflow runs focused suites plus `npm run verify`; remove workflow before PR creation. Do not open PR if branch safe gate is red.

- [ ] **Step 5: Review final diff invariants**

Confirm:

```text
schemaVersion = 9
max tags per pair = 2
legacy max = 200
no direct match-stat relationship bonus
no character-trait behavior yet
no event-cadence change
no temporary workflow files
```

- [ ] **Step 6: Commit any final regression fix only after adding its failing test first**

Use a focused commit message describing the defect rather than a generic cleanup message.
