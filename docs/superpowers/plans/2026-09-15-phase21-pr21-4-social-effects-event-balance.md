# Phase21 PR21-4 Social Effects, Event Weighting, and Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make visible special relationships matter lightly in training and event selection, suppress repetitive actor pairs, and prove the system remains bounded over multi-season deterministic simulations.

**Architecture:** Keep the normal training formula intact and feed one capped social-growth modifier into its existing `additionalGrowthModifiers` path while separately logging the contributing relationships for UI transparency. Add a pure character/relationship event-weight multiplier bounded to 0.75x-1.50x, then apply the existing recent event/category penalties and a 0.20x recent-pair penalty. Extend event memory updates with the v9 `recentActorPairKeys` field created in PR21-2. Finish with deterministic multi-season evidence using two fixed seeds.

**Tech Stack:** TypeScript 5.9, Vitest, existing seeded simulation, existing training and event systems, React training-result notification UI.

**Spec:** `docs/superpowers/specs/2026-09-15-phase21-player-relationships-fullscreen-events-design.md`

## Global Constraints

- `partner` contributes +3 percentage points to each participating player.
- `mentor` contributes +4 percentage points to the protege only.
- `rival` contributes +3 percentage points only when both rivals have the same preferred position.
- Both players in the relevant bond must be active in that week's training; injured or auto-rested players cannot enable a social bonus.
- Raw social contributions are additive but the applied weekly social growth bonus is capped at +5 percentage points per player.
- Social growth effects are visible in training results; no relationship-derived growth modifier is hidden.
- Low affinity/non-friendship never directly applies a training-growth penalty in Phase21.
- No direct hidden match-stat bonus is added.
- Normal event cadence remains the existing three-week rhythm; Phase21 changes candidate weights, not cadence.
- Character/relationship event weighting multiplier is clamped to 0.75x-1.50x before existing recent event/category penalties.
- Exact two-actor pairs in `recentActorPairKeys` receive a 0.20x repeat penalty; history length is 6.
- Existing eligibility, cooldown, once-per-career, and scheduled-follow-up rules are never bypassed by Phase21 weighting.
- Long-run evidence uses at least two fixed seeds and multiple seasons.
- Use TDD and a branch safe gate before PR creation.

---

## File Structure

- Create `src/domain/training/relationshipTrainingModifiers.ts`: build social contributions and one capped growth modifier.
- Modify `src/domain/training/calculateGrowth.ts`: allow `relationship-social` additional modifier code.
- Modify `src/domain/training/resolveWeeklyTraining.ts`: compute active participant set, feed capped social modifier, record contribution metadata.
- Modify `src/domain/notifications/gameNotifications.ts`: preserve social contribution details in training notifications.
- Modify `src/features/home/TrainingResultNotificationSheet.tsx`: display contribution chips and +5% cap note.
- Modify `src/features/home/training-result-notification.css`.
- Create `src/domain/events/characterEventWeight.ts`: pure bounded multiplier.
- Modify `src/domain/events/selectEvent.ts`: apply character multiplier and exact-pair repeat penalty.
- Modify `src/domain/events/resolveEventChoice.ts`: append pair keys to bounded recent pair memory.
- Create `tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts`.
- Modify `tests/unit/domain/training/resolveWeeklyTraining.test.ts` or the repository's canonical training-resolution test file.
- Modify `tests/unit/features/home/TrainingResultNotificationSheet.test.tsx`.
- Create `tests/unit/domain/events/phase21CharacterEventWeight.test.ts`.
- Create `tests/unit/domain/events/phase21PairRepetition.test.ts`.
- Create `tests/unit/domain/events/phase21RelationshipLongRun.test.ts`.

---

### Task 1: Pure social training contribution builder

**Files:**
- Create: `src/domain/training/relationshipTrainingModifiers.ts`
- Create: `tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts`

**Interfaces:**

```ts
export type SocialGrowthContributionCode =
  | "relationship-partner"
  | "relationship-mentor"
  | "relationship-rival";

export interface SocialGrowthContribution {
  code: SocialGrowthContributionCode;
  label: string;
  percentPoints: 3 | 4;
  relatedPlayerId: PlayerId;
}

export interface RelationshipTrainingModifierSummary {
  contributions: SocialGrowthContribution[];
  rawPercentPoints: number;
  appliedPercentPoints: number;
  capped: boolean;
}

export function calculateRelationshipTrainingModifier(
  state: GameState,
  playerId: PlayerId,
  activeTrainingPlayerIds: ReadonlySet<PlayerId>,
): RelationshipTrainingModifierSummary;
```

Behavior:

- inspect only bonds containing `playerId`;
- counterpart must be in `activeTrainingPlayerIds`;
- current player must also be active;
- `partner`: +3 to current player;
- `mentor`: +4 only when current player equals `protegePlayerId`;
- `rival`: +3 only when counterpart and current player share `preferredPosition`;
- same kind from duplicate/corrupt data is de-duplicated by bond/kind defensively;
- `appliedPercentPoints = min(5, rawPercentPoints)`;
- sort contributions by code then related player ID for deterministic logs.

- [ ] **Step 1: Write failing contribution tests**

Cover partner, mentor mentor-side no-bonus, mentor protege +4, same-position rival +3, different-position rival 0, inactive counterpart 0, and partner+mentor raw7/applied5/capped true.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts`

- [ ] **Step 3: Implement pure builder**

The helper must not mutate state and must not inspect event history.

- [ ] **Step 4: Run GREEN**

```bash
npx vitest run tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/training/relationshipTrainingModifiers.ts tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts
git commit -m "feat: calculate relationship training bonuses"
```

### Task 2: Integrate capped social growth into weekly training

**Files:**
- Modify: `src/domain/training/calculateGrowth.ts`
- Modify: `src/domain/training/resolveWeeklyTraining.ts`
- Modify: canonical weekly training test file.

**Interfaces:**

Extend additional growth codes with:

```ts
| "relationship-social"
```

Extend `PlayerGrowthLog`:

```ts
socialGrowth: RelationshipTrainingModifierSummary;
```

Actual calculation modifier:

```ts
const socialModifier: AdditionalGrowthModifier | null =
  social.appliedPercentPoints > 0
    ? {
        code: "relationship-social",
        label: "人間関係",
        percent: 100 + social.appliedPercentPoints,
      }
    : null;
```

Do not pass separate 103/104 modifiers for each bond because multiplicative stacking would violate the additive +5 percentage-point contract.

- [ ] **Step 1: Write failing integration test**

Create partner+mentor contributions with raw7 and resolve training. Assert:

```ts
expect(log.socialGrowth.rawPercentPoints).toBe(7);
expect(log.socialGrowth.appliedPercentPoints).toBe(5);
expect(log.socialGrowth.capped).toBe(true);
expect(log.modifiers).toContainEqual(
  expect.objectContaining({ code: "relationship-social", percent: 105 }),
);
```

- [ ] **Step 2: Add injured/auto-rest counterpart regression**

If the related player is injured before resolution or present in `restingPlayerIds`, the counterpart is removed from the active training set and contributes zero.

- [ ] **Step 3: Run RED**

Run the canonical training test file plus `phase21RelationshipTrainingModifiers.test.ts`.

- [ ] **Step 4: Build active set before player loop**

```ts
const activeTrainingPlayerIds = new Set(
  validated.school.playerIds.filter((id) => {
    const player = input.state.players[id];
    return Boolean(player && !player.injury && !input.restingPlayerIds?.has(id));
  }),
);
```

For `instruction.rest`, remove that player from bonus participation as well before social summaries are calculated. To avoid order dependence, precompute a second set excluding players assigned `instruction.rest`.

- [ ] **Step 5: Add one capped modifier plus contribution log**

Preserve existing assistant-coach, morale, trust, and shop modifiers unchanged.

- [ ] **Step 6: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts <training-resolution-test-path>
npm run typecheck
git add src/domain/training/calculateGrowth.ts src/domain/training/resolveWeeklyTraining.ts <training-resolution-test-path>
git commit -m "feat: apply visible capped social training growth"
```

### Task 3: Show social effects in training result notification

**Files:**
- Modify: `src/domain/notifications/gameNotifications.ts`
- Modify: `src/features/home/TrainingResultNotificationSheet.tsx`
- Modify: `src/features/home/training-result-notification.css`
- Modify: `tests/unit/features/home/TrainingResultNotificationSheet.test.tsx`

**Interfaces:**

Extend notification player payload:

```ts
socialGrowth: {
  contributions: Array<{
    code: SocialGrowthContributionCode;
    label: string;
    percentPoints: number;
    relatedPlayerId: PlayerId;
  }>;
  rawPercentPoints: number;
  appliedPercentPoints: number;
  capped: boolean;
};
```

- [ ] **Step 1: Write failing notification UI test**

For raw7/applied5, assert visible text contains contributor labels such as `相棒 +3%`, `師弟 +4%`, and `関係性効果は上限 +5%`.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/features/home/TrainingResultNotificationSheet.test.tsx`

- [ ] **Step 3: Copy social log into notification builder**

Do not recompute relationships when displaying a historical notification; copy the resolution-time contribution data.

- [ ] **Step 4: Render chips/cap note under the affected player**

No social block is rendered when `contributions.length===0`.

- [ ] **Step 5: Run GREEN and commit**

```bash
npx vitest run tests/unit/features/home/TrainingResultNotificationSheet.test.tsx
npm run typecheck
git add src/domain/notifications/gameNotifications.ts src/features/home/TrainingResultNotificationSheet.tsx src/features/home/training-result-notification.css tests/unit/features/home/TrainingResultNotificationSheet.test.tsx
git commit -m "feat: show relationship effects in training results"
```

### Task 4: Bounded character/relationship event weighting

**Files:**
- Create: `src/domain/events/characterEventWeight.ts`
- Create: `tests/unit/domain/events/phase21CharacterEventWeight.test.ts`

**Interfaces:**

```ts
export function characterEventWeightMultiplier(
  state: GameState,
  data: GameDataRegistry,
  event: EventDefinition,
  actorPlayerIds: readonly PlayerId[],
): number;
```

Return an integer percentage in `[75, 150]`, where `100` means 1.0x.

Exact scoring contract before clamp:

1. Start `percent = 100`.
2. For each actor, if any public personality tag intersects `event.tags`, add 10; combined personality-tag bonus capped at +20.
3. For `relationship` or `rivalry` event categories, add `round(personality.relationshipGrowth / 2)` for each actor; combined personality relationship adjustment clamped to -15..+15.
4. For each actor's **revealed** character trait, if any `trait.eventTags` intersects `event.tags`, add 15; combined character-tag bonus capped at +30.
5. For `relationship` or `rivalry` categories, add each revealed trait's `relationshipBias`; combined character relationship adjustment clamped to -15..+15.
6. For a two-actor bond: add +20 for `rival` when category is `rivalry` or tags include `competition`/`rivalry`; add +20 for `mentor` when tags include `mentor`/`guidance`; add +20 for `partner` when tags include `pair`/`cooperation`/`coordination`. Special-relationship contribution is capped at +20 total, not +20 per tag.
7. Clamp final percent to 75..150.

No weighting term is allowed to change eligibility.

- [ ] **Step 1: Write failing exact-scoring tests**

Test neutral=100, negative relationship growth floor >=75, stacked positive cap=150, hidden unrevealed trait ignored, revealed trait applied, and rival bonus applied only to matching event tags/category.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/events/phase21CharacterEventWeight.test.ts`

- [ ] **Step 3: Implement pure multiplier**

Use registry lookups defensively; unresolved IDs contribute zero.

- [ ] **Step 4: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/events/phase21CharacterEventWeight.test.ts
npm run typecheck
git add src/domain/events/characterEventWeight.ts tests/unit/domain/events/phase21CharacterEventWeight.test.ts
git commit -m "feat: weight events by visible character context"
```

### Task 5: Pair repetition memory and candidate integration

**Files:**
- Modify: `src/domain/events/selectEvent.ts`
- Modify: `src/domain/events/resolveEventChoice.ts`
- Create: `tests/unit/domain/events/phase21PairRepetition.test.ts`

**Interfaces:**

```ts
export function eventActorPairKey(actorPlayerIds: readonly PlayerId[]): string | null;
```

Returns `relationshipKey(a,b)` only for exactly two distinct actors; otherwise null.

Candidate formula:

```ts
const characterPercent = characterEventWeightMultiplier(...);
const pairKey = eventActorPairKey(actorPlayerIds);
const pairPenalty = pairKey && state.eventMemory.recentActorPairKeys.includes(pairKey)
  ? 0.2
  : 1;
const finalWeight = Math.max(
  1,
  Math.round(
    event.weight *
      (characterPercent / 100) *
      recentEventPenalty *
      recentCategoryPenalty *
      pairPenalty,
  ),
);
```

Keep the existing recent-primary-actor avoidance pass/fallback unchanged.

On resolution, append exact two-actor pair key to `recentActorPairKeys` with limit 6.

- [ ] **Step 1: Write failing pair-memory tests**

Assert two-actor resolution appends canonical key, seventh key evicts oldest, one-actor event does not append, and exact recent pair receives 0.20x candidate penalty.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/events/phase21PairRepetition.test.ts`

- [ ] **Step 3: Integrate multiplier and pair penalty after eligibility**

Do not modify `isEventEligibleForActors`, cooldown logic, follow-up priority, or event cadence.

- [ ] **Step 4: Run event regression suite**

```bash
npx vitest run tests/unit/domain/events
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/events/selectEvent.ts src/domain/events/resolveEventChoice.ts tests/unit/domain/events/phase21PairRepetition.test.ts
git commit -m "feat: diversify relationship event actor pairs"
```

### Task 6: Multi-season deterministic balance audit

**Files:**
- Create: `tests/unit/domain/events/phase21RelationshipLongRun.test.ts`

**Interfaces:**

Create an in-test simulation helper:

```ts
interface Phase21LongRunMetrics {
  seed: string;
  simulatedWeeks: number;
  normalEvents: number;
  followUpEvents: number;
  relationshipEvents: number;
  uniqueActorPairs: number;
  maxPairShare: number;
  activeBondCount: number;
  legacyBondCount: number;
  discoveredTraitCount: number;
  maxObservedSocialBonus: number;
  invalidBondReferences: number;
}
```

Run two fixed seeds for at least 156 weeks each (3 seasons). Resolve every surfaced event with a deterministic choice rule: first eligible choice ID, no user-dependent randomness. Continue ordinary weekly/training progression through the canonical domain path.

Hard assertions per seed:

```text
simulatedWeeks >= 156
maxObservedSocialBonus <= 5
invalidBondReferences == 0
every active pair tags.length <= 2
every revealedHiddenTraitId is present in hiddenTraitIds
normal event cadence is not greater than one normal event per three-week eligible slot
uniqueActorPairs >= 4 when relationshipEvents >= 8
maxPairShare <= 0.40 when relationshipEvents >= 10
```

Also assert rerunning the same seed produces identical metrics.

- [ ] **Step 1: Write long-run test with metrics logging**

Log one compact line per seed using `console.info` only when the test completes; do not snapshot random full state.

- [ ] **Step 2: Run RED or first baseline**

`npx vitest run tests/unit/domain/events/phase21RelationshipLongRun.test.ts --reporter=verbose`

If a hard assertion fails, treat it as balance RED and fix production weighting/caps rather than relaxing the assertion without evidence.

- [ ] **Step 3: Add any required deterministic invariant metadata to thrown assertions**

Failure messages must include `seed`, `date`, `yearIndex`, `weekOfYear`, and the violated metric so CI failures are diagnosable without rerunning blindly.

- [ ] **Step 4: Run twice and compare outputs**

```bash
npx vitest run tests/unit/domain/events/phase21RelationshipLongRun.test.ts --reporter=verbose
npx vitest run tests/unit/domain/events/phase21RelationshipLongRun.test.ts --reporter=verbose
```

Expected: both PASS and metric lines identical per seed.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/domain/events/phase21RelationshipLongRun.test.ts
git commit -m "test: audit Phase21 relationship balance long term"
```

### Task 7: PR21-4 final verification and evidence

**Files:**
- No planned production changes unless a failing test exposes a defect.

- [ ] **Step 1: Run Phase21-4 focused suites**

```bash
npx vitest run \
  tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts \
  tests/unit/domain/events/phase21CharacterEventWeight.test.ts \
  tests/unit/domain/events/phase21PairRepetition.test.ts \
  tests/unit/domain/events/phase21RelationshipLongRun.test.ts \
  tests/unit/features/home/TrainingResultNotificationSheet.test.tsx
```

- [ ] **Step 2: Run all Phase21 focused suites across PR21-1..4**

Run all tests whose filenames contain `phase21`, plus `EventDialog.test.tsx`, `PlayerHubScreen.test.tsx`, and `TrainingResultNotificationSheet.test.tsx`.

- [ ] **Step 3: Run static checks and full verification**

```bash
npm run typecheck
npm run lint
npm run format:check
npm run verify
npm run soak:smoke
```

- [ ] **Step 4: Run branch safe gate in GitHub Actions before PR**

Safe gate includes Phase21 focused suites, `npm run verify`, and `npm run soak:smoke`. Delete temporary workflow before opening PR. Do not knowingly open a red PR.

- [ ] **Step 5: Record PR evidence**

PR body must include the two-seed long-run metrics, confirmation that social bonus max is 5, confirmation that normal event cadence did not increase, and exact safe-gate run ID.

- [ ] **Step 6: Final diff review**

Confirm:

```text
no direct match-stat relationship bonus
no negative social training modifier
character weight clamp = 75..150
pair repeat penalty = 0.20
recent pair history max = 6
social applied bonus max = +5 percentage points
schema remains v9
no temporary workflow file
```
