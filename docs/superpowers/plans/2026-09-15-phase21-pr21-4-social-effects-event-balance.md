# Phase21 PR21-4 Social Effects, Event Weighting, and Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make visible special relationships matter lightly in training and event selection, suppress repetitive actor pairs, and prove the system remains bounded over multi-season deterministic simulations.

**Architecture:** Build social training contributions separately, collapse them to one additive-equivalent capped `relationship-social` growth modifier, and retain contribution metadata for UI transparency. Add a pure event-weight multiplier bounded to 75-150%, then apply existing recent event/category penalties and a 0.20 exact-pair repeat penalty. Update the v9 `recentActorPairKeys` memory on resolution and finish with two-seed, three-season deterministic evidence.

**Tech Stack:** TypeScript 5.9, Vitest, existing seeded simulation, existing training/event systems, React training-result notification UI.

**Spec:** `docs/superpowers/specs/2026-09-15-phase21-player-relationships-fullscreen-events-design.md`

## Global Constraints

- `partner`: +3 percentage points to each active participant.
- `mentor`: +4 percentage points to the protege only.
- `rival`: +3 percentage points only when both active rivals share `preferredPosition`.
- Injured, auto-rested, or `instruction.rest` players do not enable social bonuses for themselves or partners.
- Raw social contributions are additive; applied social growth is capped at +5 percentage points/player/week.
- Training result UI must show contributing relationships and explain when the +5 cap truncates raw total.
- No negative relationship training modifier and no direct relationship match-stat modifier in Phase21.
- Normal event cadence remains the existing three-week rhythm.
- Character/relationship event multiplier is clamped to 75-150 before existing recent penalties.
- Recent exact two-actor pair penalty is 0.20; recent pair history length is 6.
- Weighting never bypasses eligibility, cooldown, once-per-career, or scheduled-follow-up rules.
- Long-run evidence uses two fixed seeds for at least 156 weeks each.
- Use TDD and a branch safe gate before opening PR21-4.

---

## File Structure

- Create `src/domain/training/relationshipTrainingModifiers.ts`.
- Modify `src/domain/training/calculateGrowth.ts` and `resolveWeeklyTraining.ts`.
- Modify `src/domain/notifications/gameNotifications.ts`.
- Modify `src/features/home/TrainingResultNotificationSheet.tsx` and CSS.
- Create `src/domain/events/characterEventWeight.ts`.
- Modify `src/domain/events/selectEvent.ts` and `resolveEventChoice.ts`.
- Create `tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts`.
- Modify `tests/unit/domain/training/resolveWeeklyTraining.test.ts`.
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

- [ ] **Step 1: Write failing tests**

Cover partner +3, mentor protege +4, mentor side 0, same-position rival +3, different-position rival 0, inactive counterpart 0, and partner+mentor raw7/applied5/capped true.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts`

- [ ] **Step 3: Implement immutable deterministic calculation**

Sort contributions by code then relatedPlayerId and de-duplicate same bond/kind defensively.

- [ ] **Step 4: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts
npm run typecheck
git add src/domain/training/relationshipTrainingModifiers.ts tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts
git commit -m "feat: calculate relationship training bonuses"
```

### Task 2: Integrate capped social growth into weekly training

**Files:**
- Modify: `src/domain/training/calculateGrowth.ts`
- Modify: `src/domain/training/resolveWeeklyTraining.ts`
- Modify: `tests/unit/domain/training/resolveWeeklyTraining.test.ts`

**Interfaces:**

Add `"relationship-social"` to `AdditionalGrowthModifier` codes. Extend `PlayerGrowthLog`:

```ts
socialGrowth: RelationshipTrainingModifierSummary;
```

Actual formula input is one modifier only:

```ts
{
  code: "relationship-social",
  label: "人間関係",
  percent: 100 + social.appliedPercentPoints,
}
```

Do not pass separate 103/104 modifiers because multiplicative stacking would exceed the additive cap contract.

- [ ] **Step 1: Write failing integration test in `resolveWeeklyTraining.test.ts`**

```ts
expect(log.socialGrowth.rawPercentPoints).toBe(7);
expect(log.socialGrowth.appliedPercentPoints).toBe(5);
expect(log.modifiers).toContainEqual(
  expect.objectContaining({ code: "relationship-social", percent: 105 }),
);
```

- [ ] **Step 2: Add injury/auto-rest/rest-instruction cases**

A counterpart in any of those states contributes zero.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts tests/unit/domain/training/resolveWeeklyTraining.test.ts
```

- [ ] **Step 4: Precompute active-training IDs before player resolution**

Exclude pre-existing injuries, `restingPlayerIds`, and players assigned `instruction.rest`; this avoids loop-order dependence.

- [ ] **Step 5: Feed one capped modifier into existing growth path and persist summary in log**

Preserve assistant-coach, morale, trust, condition, and shop modifiers unchanged.

- [ ] **Step 6: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts tests/unit/domain/training/resolveWeeklyTraining.test.ts
npm run typecheck
git add src/domain/training/calculateGrowth.ts src/domain/training/resolveWeeklyTraining.ts tests/unit/domain/training/resolveWeeklyTraining.test.ts
git commit -m "feat: apply visible capped social training growth"
```

### Task 3: Preserve and display social contributions in training results

**Files:**
- Modify: `src/domain/notifications/gameNotifications.ts`
- Modify: `src/features/home/TrainingResultNotificationSheet.tsx`
- Modify: `src/features/home/training-result-notification.css`
- Modify: `tests/unit/features/home/TrainingResultNotificationSheet.test.tsx`

**Interfaces:**

Add to `TrainingResultNotificationPlayer`:

```ts
socialGrowth: RelationshipTrainingModifierSummary;
```

Notification builder copies the resolution-time summary; UI never recomputes historical relationships.

- [ ] **Step 1: Write failing UI test**

For raw7/applied5 assert `相棒 +3%`, `師弟 +4%`, and `関係性効果は上限 +5%` are visible.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/features/home/TrainingResultNotificationSheet.test.tsx`

- [ ] **Step 3: Copy social summary into notification payload and render contributor chips**

No social section when contributions are empty.

- [ ] **Step 4: Run GREEN and commit**

```bash
npx vitest run tests/unit/features/home/TrainingResultNotificationSheet.test.tsx
npm run typecheck
git add src/domain/notifications/gameNotifications.ts src/features/home/TrainingResultNotificationSheet.tsx src/features/home/training-result-notification.css tests/unit/features/home/TrainingResultNotificationSheet.test.tsx
git commit -m "feat: show relationship effects in training results"
```

### Task 4: Pure bounded event-weight multiplier

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

Return integer percentage in `[75, 150]`.

Exact score before clamp:

```text
start = 100
+10 per actor when public personality tags intersect event.tags; total personality-tag bonus max +20
for relationship/rivalry categories: add round(personality.relationshipGrowth / 2) per actor; combined clamp -15..+15
+15 per actor when a revealed character trait eventTags intersects event.tags; total character-tag bonus max +30
for relationship/rivalry categories: add each revealed trait relationshipBias; combined clamp -15..+15
for two-actor active bond: at most +20 total when
  rival and category=rivalry or tags include competition/rivalry
  mentor and tags include mentor/guidance
  partner and tags include pair/cooperation/coordination
final clamp 75..150
```

- [ ] **Step 1: Write failing exact-score tests**

Cover neutral 100, negative floor 75, positive cap 150, unrevealed trait ignored, revealed trait included, and bond-tag matching.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/events/phase21CharacterEventWeight.test.ts`

- [ ] **Step 3: Implement pure multiplier without changing eligibility**

Unresolved personality/trait IDs contribute zero defensively.

- [ ] **Step 4: Run GREEN and commit**

```bash
npx vitest run tests/unit/domain/events/phase21CharacterEventWeight.test.ts
npm run typecheck
git add src/domain/events/characterEventWeight.ts tests/unit/domain/events/phase21CharacterEventWeight.test.ts
git commit -m "feat: weight events by visible character context"
```

### Task 5: Recent-pair penalty and memory update

**Files:**
- Modify: `src/domain/events/selectEvent.ts`
- Modify: `src/domain/events/resolveEventChoice.ts`
- Create: `tests/unit/domain/events/phase21PairRepetition.test.ts`

**Interfaces:**

```ts
export function eventActorPairKey(
  actorPlayerIds: readonly PlayerId[],
): string | null;
```

Only exactly two distinct actors produce a sorted `relationshipKey`; all other actor counts return null.

Candidate weight formula:

```ts
const pairPenalty = pairKey && state.eventMemory.recentActorPairKeys.includes(pairKey)
  ? 0.2
  : 1;
const finalWeight = Math.max(
  1,
  Math.round(
    event.weight *
      (characterEventWeightMultiplier(state, data, event, actorPlayerIds) / 100) *
      recentEventPenalty *
      recentCategoryPenalty *
      pairPenalty,
  ),
);
```

On resolution append pair key to `recentActorPairKeys` using existing `pushLimited(..., 6)` pattern.

- [ ] **Step 1: Write failing tests**

Assert canonical key, 7th entry evicts oldest, one-actor events do not append, and recent pair gets exact 0.20 factor while eligibility remains unchanged.

- [ ] **Step 2: Run RED**

`npx vitest run tests/unit/domain/events/phase21PairRepetition.test.ts`

- [ ] **Step 3: Integrate multiplier/penalty after eligibility checks**

Keep follow-up priority and recent-primary-actor two-pass behavior unchanged.

- [ ] **Step 4: Run event regression suite and commit**

```bash
npx vitest run tests/unit/domain/events
npm run typecheck
git add src/domain/events/selectEvent.ts src/domain/events/resolveEventChoice.ts tests/unit/domain/events/phase21PairRepetition.test.ts
git commit -m "feat: diversify relationship event actor pairs"
```

### Task 6: Multi-season deterministic balance audit

**Files:**
- Create: `tests/unit/domain/events/phase21RelationshipLongRun.test.ts`

**Interfaces:**

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

Simulate two fixed seeds for 156 weeks each through canonical week/event/training progression. Resolve a surfaced event with the first available choice ID to keep the harness deterministic.

Hard assertions per seed:

```text
simulatedWeeks >= 156
maxObservedSocialBonus <= 5
invalidBondReferences == 0
every active pair has <= 2 tags
every revealed hidden trait is assigned
normal non-follow-up event count never exceeds available three-week cadence slots
when relationshipEvents >= 8: uniqueActorPairs >= 4
when relationshipEvents >= 10: maxPairShare <= 0.40
same seed rerun => identical metrics
```

Failure messages include seed/date/yearIndex/weekOfYear and metric name.

- [ ] **Step 1: Write the long-run test and compact metric logging**

Use `console.info` once per completed seed; do not snapshot full game state.

- [ ] **Step 2: Run the test twice**

```bash
npx vitest run tests/unit/domain/events/phase21RelationshipLongRun.test.ts --reporter=verbose
npx vitest run tests/unit/domain/events/phase21RelationshipLongRun.test.ts --reporter=verbose
```

Both must pass with identical metrics. If a hard bound fails, fix production balance rather than weakening the assertion without evidence.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/domain/events/phase21RelationshipLongRun.test.ts
git commit -m "test: audit Phase21 relationship balance long term"
```

### Task 7: PR21-4 final verification and evidence

**Files:**
- No planned production changes.

- [ ] **Step 1: Run PR21-4 focused suites**

```bash
npx vitest run \
  tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts \
  tests/unit/domain/training/resolveWeeklyTraining.test.ts \
  tests/unit/domain/events/phase21CharacterEventWeight.test.ts \
  tests/unit/domain/events/phase21PairRepetition.test.ts \
  tests/unit/domain/events/phase21RelationshipLongRun.test.ts \
  tests/unit/features/home/TrainingResultNotificationSheet.test.tsx
```

- [ ] **Step 2: Run all Phase21 tests plus critical UI regressions**

```bash
npx vitest run --testNamePattern="Phase21|phase21"
npx vitest run tests/unit/features/home/EventDialog.test.tsx tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/features/home/TrainingResultNotificationSheet.test.tsx
```

If Vitest pattern matching does not select file-name-only tests, run the explicit Phase21 file list instead of changing tests.

- [ ] **Step 3: Run static/full checks**

```bash
npm run typecheck
npm run lint
npm run format:check
npm run verify
npm run soak:smoke
```

- [ ] **Step 4: Run branch safe gate before PR and delete temporary workflow**

Safe gate includes focused Phase21 tests, `npm run verify`, and `npm run soak:smoke`. Never open the PR while this gate is red.

- [ ] **Step 5: Record PR evidence**

PR body includes both seed metrics, max observed social bonus, normal-event cadence proof, pair-distribution proof, and exact safe-gate run ID.

- [ ] **Step 6: Final diff invariants**

```text
no direct relationship match-stat bonus
no negative social training modifier
character weight clamp = 75..150
pair repeat penalty = 0.20
recent pair history max = 6
social applied bonus max = +5 percentage points
schema remains v9
no temporary workflow file remains
```
