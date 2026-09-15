# Phase21 PR21-4 Social Effects, Event Weighting, and Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make visible special relationships matter lightly in training and event selection, suppress repetitive actor pairs, and prove the system remains bounded over multi-season deterministic simulations.

**Architecture:** Build social training contributions separately, collapse them to one additive-equivalent capped `relationship-social` growth modifier, and retain contribution metadata for UI transparency. Add a pure event-weight multiplier bounded to 75-150%, then apply existing recent event/category penalties and a 0.20 exact-pair repeat penalty. Update v9 `recentActorPairKeys` on resolution and finish with two-seed, three-season deterministic evidence.

**Tech Stack:** TypeScript 5.9, Vitest, existing seeded simulation, training/event systems, React training-result UI.

**Spec:** `docs/superpowers/specs/2026-09-15-phase21-player-relationships-fullscreen-events-design.md`

## Global Constraints

- `partner`: +3 percentage points to each active participant.
- `mentor`: +4 percentage points to protege only.
- `rival`: +3 percentage points only when both active rivals share `preferredPosition`.
- Injured, auto-rested, or `instruction.rest` players do not enable social bonuses.
- Raw contributions are additive; applied social growth is capped at +5 percentage points/player/week.
- Training result UI shows contributors and cap truncation.
- No negative relationship training modifier and no direct relationship match-stat modifier.
- Normal event cadence remains the existing three-week rhythm.
- Character/relationship event multiplier clamp: 75-150 before existing recent penalties.
- Recent exact-pair penalty: 0.20; recent pair history length: 6.
- Weighting never bypasses eligibility/cooldown/once-per-career/follow-up rules.
- Long-run evidence: two fixed seeds, >=156 weeks each.
- TDD + safe gate before PR.

---

## File Structure

- Create `src/domain/training/relationshipTrainingModifiers.ts`.
- Modify `src/domain/training/calculateGrowth.ts`, `resolveWeeklyTraining.ts`.
- Modify `src/domain/notifications/gameNotifications.ts`.
- Modify `src/features/home/TrainingResultNotificationSheet.tsx` and CSS.
- Create `src/domain/events/characterEventWeight.ts`.
- Modify `src/domain/events/selectEvent.ts`, `resolveEventChoice.ts`.
- Create/modify tests named below.

---

### Task 1: Pure social training contribution builder

**Files:**

- Create: `src/domain/training/relationshipTrainingModifiers.ts`
- Create: `tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts`

**Interface:**

```ts
export type SocialGrowthContributionCode =
  "relationship-partner" | "relationship-mentor" | "relationship-rival";

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

- [ ] **Step 1:** RED tests: partner+3, mentor protege+4/mentor side0, same-position rival+3/different0, inactive counterpart0, partner+mentor raw7/applied5/capped.
- [ ] **Step 2:** Run RED: `npx vitest run tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts`.
- [ ] **Step 3:** Implement immutable deterministic builder; sort by code then related ID and de-duplicate bond/kind defensively.
- [ ] **Step 4:** Run GREEN + typecheck; commit.

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

Add `"relationship-social"` to additional modifier codes and `socialGrowth: RelationshipTrainingModifierSummary` to `PlayerGrowthLog`.

Use exactly one formula modifier:

```ts
{
  code: "relationship-social",
  label: "人間関係",
  percent: 100 + social.appliedPercentPoints,
}
```

Separate 103/104 multipliers are forbidden because multiplication would violate the additive +5 contract.

- [ ] **Step 1:** RED integration test: raw7/applied5/capped and modifier percent105.
- [ ] **Step 2:** RED injury/auto-rest/`instruction.rest` counterpart cases.
- [ ] **Step 3:** Precompute active training set excluding those states before loop to avoid order dependence.
- [ ] **Step 4:** Feed one capped modifier, preserve existing modifiers unchanged.
- [ ] **Step 5:** Run GREEN + typecheck; commit.

```bash
npx vitest run tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts tests/unit/domain/training/resolveWeeklyTraining.test.ts
npm run typecheck
git add src/domain/training/calculateGrowth.ts src/domain/training/resolveWeeklyTraining.ts tests/unit/domain/training/resolveWeeklyTraining.test.ts
git commit -m "feat: apply visible capped social training growth"
```

### Task 3: Preserve/display social contributions in training results

**Files:**

- Modify: `src/domain/notifications/gameNotifications.ts`
- Modify: `src/features/home/TrainingResultNotificationSheet.tsx`
- Modify: `src/features/home/training-result-notification.css`
- Modify: `tests/unit/features/home/TrainingResultNotificationSheet.test.tsx`

`TrainingResultNotificationPlayer` gains `socialGrowth: RelationshipTrainingModifierSummary`. Notification builder copies resolution-time data; historical UI never recomputes current relationships.

- [ ] **Step 1:** RED UI test with `相棒 +3%`, `師弟 +4%`, `関係性効果は上限 +5%`.
- [ ] **Step 2:** Copy summary and render chips/cap note; render nothing when contributions empty.
- [ ] **Step 3:** Run GREEN + typecheck; commit.

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

**Interface:**

```ts
export function characterEventWeightMultiplier(
  state: GameState,
  data: GameDataRegistry,
  event: EventDefinition,
  actorPlayerIds: readonly PlayerId[],
): number;
```

Return integer percent in `[75,150]`.

Exact score before final clamp:

```text
start 100
+10 per actor if public personality tags intersect event.tags; personality tag bonus max +20
relationship/rivalry category: add round(personality.relationshipGrowth/2) per actor; combined clamp -15..+15
+15 per actor if a REVEALED character trait eventTags intersects event.tags; character tag bonus max +30
relationship/rivalry category: add revealed trait relationshipBias; combined clamp -15..+15
active two-actor bond: max +20 total when
  rival and category rivalry OR tags competition/rivalry
  mentor and tags mentor/guidance
  partner and tags pair/cooperation/coordination
final clamp 75..150
```

- [ ] **Step 1:** RED exact-score tests: neutral100, floor75, cap150, unrevealed ignored, revealed applied, bond matching.
- [ ] **Step 2:** Implement pure multiplier without touching eligibility.
- [ ] **Step 3:** Run GREEN + typecheck; commit.

```bash
npx vitest run tests/unit/domain/events/phase21CharacterEventWeight.test.ts
npm run typecheck
git add src/domain/events/characterEventWeight.ts tests/unit/domain/events/phase21CharacterEventWeight.test.ts
git commit -m "feat: weight events by visible character context"
```

### Task 5: Recent-pair penalty and memory

**Files:**

- Modify: `src/domain/events/selectEvent.ts`
- Modify: `src/domain/events/resolveEventChoice.ts`
- Create: `tests/unit/domain/events/phase21PairRepetition.test.ts`

**Interface:**

```ts
export function eventActorPairKey(
  actorPlayerIds: readonly PlayerId[],
): string | null;
```

Only exactly two distinct actors return canonical `relationshipKey`.

Candidate formula:

```ts
const pairPenalty =
  pairKey && state.eventMemory.recentActorPairKeys.includes(pairKey) ? 0.2 : 1;
const finalWeight = Math.max(
  1,
  Math.round(
    event.weight *
      (characterEventWeightMultiplier(state, data, event, actorPlayerIds) /
        100) *
      recentEventPenalty *
      recentCategoryPenalty *
      pairPenalty,
  ),
);
```

Resolution appends pair key with existing `pushLimited(...,6)` pattern.

- [ ] **Step 1:** RED tests: canonical pair, seventh evicts oldest, one-actor no append, exact 0.20 recent-pair factor, unchanged eligibility.
- [ ] **Step 2:** Integrate multiplier/penalty after eligibility; keep follow-up priority and recent-primary-actor two-pass behavior.
- [ ] **Step 3:** Run all event tests + typecheck; commit.

```bash
npx vitest run tests/unit/domain/events
npm run typecheck
git add src/domain/events/selectEvent.ts src/domain/events/resolveEventChoice.ts tests/unit/domain/events/phase21PairRepetition.test.ts
git commit -m "feat: diversify relationship event actor pairs"
```

### Task 6: Multi-season deterministic balance audit

**Files:**

- Create: `tests/unit/domain/events/phase21RelationshipLongRun.test.ts`

**Metrics:**

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

Simulate two fixed seeds for 156 weeks each through canonical week/event/training progression; resolve surfaced events using first available choice for deterministic harness behavior.

Hard assertions:

```text
simulatedWeeks >= 156
maxObservedSocialBonus <= 5
invalidBondReferences == 0
all active bonds tags.length <=2
all revealedHiddenTraitIds belong to hiddenTraitIds
normal non-follow-up events <= available three-week cadence slots
if relationshipEvents >=8: uniqueActorPairs >=4
if relationshipEvents >=10: maxPairShare <=0.40
same seed rerun => identical metrics
```

Failure messages include seed/date/yearIndex/weekOfYear/metric.

- [ ] **Step 1:** Write harness + one compact `console.info` line per completed seed.
- [ ] **Step 2:** Run twice; metrics must match exactly. If hard bound fails, fix production balance rather than weakening assertion without evidence.
- [ ] **Step 3:** Commit.

```bash
npx vitest run tests/unit/domain/events/phase21RelationshipLongRun.test.ts --reporter=verbose
npx vitest run tests/unit/domain/events/phase21RelationshipLongRun.test.ts --reporter=verbose
git add tests/unit/domain/events/phase21RelationshipLongRun.test.ts
git commit -m "test: audit Phase21 relationship balance long term"
```

### Task 7: PR21-4 final Phase21 verification and evidence

- [ ] **Step 1: PR21-4 focused suites**

```bash
npx vitest run \
  tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts \
  tests/unit/domain/training/resolveWeeklyTraining.test.ts \
  tests/unit/domain/events/phase21CharacterEventWeight.test.ts \
  tests/unit/domain/events/phase21PairRepetition.test.ts \
  tests/unit/domain/events/phase21RelationshipLongRun.test.ts \
  tests/unit/features/home/TrainingResultNotificationSheet.test.tsx
```

- [ ] **Step 2: Explicit Phase21 cross-PR regression set**

```bash
npx vitest run \
  tests/unit/domain/player/playerPersonalityPresentation.test.ts \
  tests/unit/domain/relationships/specialRelationships.test.ts \
  tests/unit/domain/relationships/phase21RelationshipDegradation.test.ts \
  tests/unit/domain/relationships/relationshipPresentation.test.ts \
  tests/unit/domain/events/phase21SpecialRelationshipEffects.test.ts \
  tests/unit/domain/events/phase21RelationshipEventData.test.ts \
  tests/unit/domain/calendar/phase21RelationshipLegacy.test.ts \
  tests/unit/notifications/phase21RelationshipNotifications.test.ts \
  tests/unit/persistence/phase21GameStateMigration.test.ts \
  tests/unit/data/phase21CharacterTraits.test.ts \
  tests/unit/domain/player/characterTraitAssignment.test.ts \
  tests/unit/domain/player/characterTraitDiscovery.test.ts \
  tests/unit/domain/events/phase21CharacterTraitEventDiscovery.test.ts \
  tests/unit/notifications/phase21CharacterTraitNotifications.test.ts \
  tests/unit/domain/training/phase21RelationshipTrainingModifiers.test.ts \
  tests/unit/domain/events/phase21CharacterEventWeight.test.ts \
  tests/unit/domain/events/phase21PairRepetition.test.ts \
  tests/unit/domain/events/phase21RelationshipLongRun.test.ts \
  tests/unit/worker/applyGameAction.test.ts \
  tests/unit/worker/gameAction.test.ts \
  tests/unit/worker/academicYearRecruitment.test.ts \
  tests/unit/features/home/EventDialog.test.tsx \
  tests/unit/features/home/HomeScreen.test.tsx \
  tests/unit/features/home/TrainingResultNotificationSheet.test.tsx \
  tests/unit/features/team/PlayerHubScreen.test.tsx
```

- [ ] **Step 3: Static/full checks**

```bash
npm run typecheck
npm run lint
npm run format:check
npm run verify
npm run soak:smoke
```

- [ ] **Step 4: Branch safe gate before PR; delete temporary workflow.** Safe gate runs explicit Phase21 regression set, `npm run verify`, and `npm run soak:smoke`; never open red PR.
- [ ] **Step 5: PR evidence:** include both long-run seed metrics, max observed social bonus, normal cadence proof, pair distribution proof, exact safe-gate run ID.
- [ ] **Step 6: Final invariants:**

```text
no direct relationship match-stat bonus
no negative social training modifier
character weight clamp=75..150
pair repeat penalty=0.20
recent pair history max=6
social applied bonus max=+5 percentage points
schema remains v9
no temporary workflow
```
