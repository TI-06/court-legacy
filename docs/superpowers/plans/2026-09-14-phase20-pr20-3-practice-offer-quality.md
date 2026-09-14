# Phase20 PR20-3 Practice Offer Cadence & Diversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limit incoming practice-match offers to two surfaced offers per calendar month, stop the same schools from repeatedly appearing, and use rivalry/history as a bounded variety signal without limiting user-initiated outgoing requests.

**Architecture:** Add one optional bounded incoming-offer ledger to `WeeklyScheduleState`, normalize absent v8 data to `[]`, and feed that ledger into the existing deterministic `practiceMatchPlanning` selector. Append ledger entries only when a non-null incoming offer is surfaced by initial/weekly schedule creation; accepting/declining/outgoing requests never append entries.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest 4, existing seeded random, weekly scheduling, persistence codec, and soak harness patterns.

**Spec:** `docs/superpowers/specs/2026-09-14-phase20-rivalry-legacy-team-relationships-design.md`

## Global Constraints

- `CURRENT_GAME_SCHEMA_VERSION` stays 8.
- Old v8 saves with no incoming-offer ledger decode successfully and normalize to `[]`.
- Ledger retains at most 32 surfaced incoming offers.
- Maximum incoming offers: 2 per `YYYY-MM`, including later-declined offers.
- Same-school incoming offers are blocked for 56 days / eight weekly windows when an eligible alternative exists.
- Rival weighting never bypasses monthly cap or cooldown.
- User outgoing requests remain under existing weekly scheduling rules and do not write the incoming ledger.
- Official-match blocking remains unchanged.
- Deterministic under the same seed/state.
- Focused tests and typecheck must be GREEN before ordinary PR CI.

---

### Task 1: Add the optional v8-compatible incoming-offer ledger

**Files:**
- Modify: `src/domain/weekly/weeklyScheduleTypes.ts`
- Modify: `src/domain/weekly/createWeeklySchedule.ts`
- Modify: `src/persistence/gameStateCodec.ts`
- Create: `tests/unit/persistence/phase20PracticeOfferCodec.test.ts`
- Modify: `tests/unit/domain/weekly/phase12DefaultWeeklyPlan.test.ts` if initial schedule shape assertions require it

**Interfaces:**
- Produces:
```ts
export interface IncomingPracticeOfferHistoryEntry {
  schoolId: SchoolId;
  surfacedDate: GameDate;
}

export interface WeeklyScheduleState {
  // existing fields
  incomingPracticeOfferHistory?: IncomingPracticeOfferHistoryEntry[];
}
```

Codec normalized runtime contract:
```ts
state.weeklySchedule.incomingPracticeOfferHistory // always an array after decode
```

- [ ] **Step 1: Write RED codec compatibility tests**

Take a valid current v8 encoded state, delete `weeklySchedule.incomingPracticeOfferHistory`, decode it, and assert:

```ts
expect(decoded.schemaVersion).toBe(8);
expect(decoded.weeklySchedule.incomingPracticeOfferHistory).toEqual([]);
```

Add a round-trip fixture with two ledger entries and assert values survive encode/decode.

- [ ] **Step 2: Write RED bound validation**

Assert the codec rejects more than 32 entries, invalid dates, and empty school ids.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/unit/persistence/phase20PracticeOfferCodec.test.ts
```
Expected: missing field currently fails strict weekly schedule parsing or does not normalize.

- [ ] **Step 4: Implement types and Zod default**

Add:
```ts
const incomingPracticeOfferHistoryEntrySchema = z
  .object({
    schoolId: z.string().min(1),
    surfacedDate: gameDateSchema,
  })
  .strict();
```

In `weeklyScheduleSchema`:
```ts
incomingPracticeOfferHistory: z
  .array(incomingPracticeOfferHistoryEntrySchema)
  .max(32)
  .optional()
  .default([]),
```

Initialize new games with `incomingPracticeOfferHistory: []` before Task 3 adds initial-offer recording.

- [ ] **Step 5: Run and commit**

```bash
npx vitest run tests/unit/persistence/phase20PracticeOfferCodec.test.ts tests/unit/persistence/gameStateCodec.test.ts tests/unit/domain/weekly/phase12DefaultWeeklyPlan.test.ts
npm run typecheck
git add src/domain/weekly/weeklyScheduleTypes.ts src/domain/weekly/createWeeklySchedule.ts src/persistence/gameStateCodec.ts tests/unit/persistence tests/unit/domain/weekly/phase12DefaultWeeklyPlan.test.ts
git commit -m "feat: add bounded incoming practice offer ledger"
```

---

### Task 2: Enforce the monthly incoming-offer cap in pure planning

**Files:**
- Modify: `src/domain/weekly/practiceMatchPlanning.ts`
- Modify: `tests/unit/domain/weekly/practiceMatchPlanning.test.ts`

**Interfaces:**
- Extend `PracticePlanningSource` to expose optional ledger or pass a normalized readonly ledger into `buildPracticePlanningFromSource`.
- Add pure helpers:
```ts
export function practiceOfferMonthKey(date: GameDate): string;
export function countIncomingOffersForMonth(
  history: readonly IncomingPracticeOfferHistoryEntry[],
  date: GameDate,
): number;
```

- [ ] **Step 1: Write RED tests for month counting**

Cover month boundaries:
```ts
expect(countIncomingOffersForMonth(history, "2026-09-28" as GameDate)).toBe(2);
expect(countIncomingOffersForMonth(history, "2026-10-05" as GameDate)).toBe(0);
```

- [ ] **Step 2: Write RED planning test for the third offer**

Use a reputation/seed fixture known to produce an incoming offer, seed two prior September ledger entries, and assert:
```ts
expect(buildPracticePlanning(state).incomingOffer).toBeNull();
```

Also assert one prior ledger entry still allows the normal deterministic chance path.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/unit/domain/weekly/practiceMatchPlanning.test.ts
```

- [ ] **Step 4: Implement cap before opponent/chance work**

At the start of incoming-offer construction, normalize:
```ts
const offerHistory = state.weeklySchedule?.incomingPracticeOfferHistory ?? [];
if (countIncomingOffersForMonth(offerHistory, state.date) >= 2) return null;
```

For `buildInitialPracticePlanning`, use an empty ledger because new games have no surfaced offers yet.

Do not alter outgoing candidate construction.

- [ ] **Step 5: Run and commit**

```bash
npx vitest run tests/unit/domain/weekly/practiceMatchPlanning.test.ts
npm run typecheck
git add src/domain/weekly/practiceMatchPlanning.ts tests/unit/domain/weekly/practiceMatchPlanning.test.ts
git commit -m "feat: cap incoming practice offers by month"
```

---

### Task 3: Record surfaced incoming offers exactly once

**Files:**
- Modify: `src/domain/weekly/createWeeklySchedule.ts`
- Modify: `src/domain/calendar/academicYearProgression.ts`
- Modify: `tests/unit/domain/weekly/phase12DefaultWeeklyPlan.test.ts`
- Create: `tests/unit/domain/weekly/phase20PracticeOfferLedger.test.ts`

**Interfaces:**
- Add pure helper in `practiceMatchPlanning.ts` or a focused new `practiceOfferHistory.ts`:
```ts
export const MAX_INCOMING_PRACTICE_OFFER_HISTORY = 32;

export function appendIncomingPracticeOfferHistory(
  history: readonly IncomingPracticeOfferHistoryEntry[],
  offer: PracticeMatchOffer | null,
  surfacedDate: GameDate,
): IncomingPracticeOfferHistoryEntry[];
```

- [ ] **Step 1: Write RED helper tests**

Assert:
- null offer appends nothing,
- non-null appends `{ schoolId, surfacedDate }`,
- 33rd append retains latest 32,
- helper does not mutate input.

- [ ] **Step 2: Write RED initial-schedule test**

When `buildInitialPracticePlanning` yields a non-null offer for the deterministic fixture, assert the initial weekly schedule ledger contains exactly that one surfaced offer/date.

- [ ] **Step 3: Write RED weekly refresh test**

Advance one week from a state where planning yields a new incoming offer. Assert one ledger item is added. Advance/refresh through accept or decline paths and assert accept/decline themselves do not append another item.

- [ ] **Step 4: Run RED**

```bash
npx vitest run tests/unit/domain/weekly/phase20PracticeOfferLedger.test.ts tests/unit/domain/weekly/phase12DefaultWeeklyPlan.test.ts
```

- [ ] **Step 5: Implement initial and weekly authoritative append points**

`createInitialWeeklySchedule()`:
```ts
const incomingPracticeOfferHistory = appendIncomingPracticeOfferHistory(
  [],
  practicePlanning.incomingOffer,
  state.date,
);
```

`refreshPracticePlanning()` in `academicYearProgression.ts`:
```ts
const planning = buildPracticePlanning(state);
const incomingPracticeOfferHistory = appendIncomingPracticeOfferHistory(
  state.weeklySchedule.incomingPracticeOfferHistory ?? [],
  planning.incomingOffer,
  state.date,
);
```

Store the updated ledger beside `practiceMatch`; never append in `acceptIncomingPracticeOffer`, `declineIncomingPracticeOffer`, or `requestPracticeMatch`.

- [ ] **Step 6: Run and commit**

```bash
npx vitest run tests/unit/domain/weekly/phase20PracticeOfferLedger.test.ts tests/unit/domain/weekly/practiceMatchPlanning.test.ts tests/unit/domain/weekly/phase12DefaultWeeklyPlan.test.ts
npm run typecheck
git add src/domain/weekly/createWeeklySchedule.ts src/domain/weekly/practiceMatchPlanning.ts src/domain/calendar/academicYearProgression.ts tests/unit/domain/weekly
git commit -m "feat: record surfaced incoming practice offers"
```

---

### Task 4: Add the eight-week repeat guard and stronger diversity ranking

**Files:**
- Modify: `src/domain/weekly/practiceMatchPlanning.ts`
- Modify: `tests/unit/domain/weekly/practiceMatchPlanning.test.ts`

**Interfaces:**
- Add pure date helper:
```ts
export function wasIncomingOfferRecentlySurfaced(
  history: readonly IncomingPracticeOfferHistoryEntry[],
  schoolId: SchoolId,
  currentDate: GameDate,
  cooldownDays?: number,
): boolean;
```
Default `cooldownDays = 56`.

- [ ] **Step 1: Write RED cooldown boundary tests**

Assert an offer 49 days ago is recent, 56 days ago is still blocked, 57 days ago is eligible.

Use UTC date arithmetic based on parsed `GameDate`, not `weekOfYear`, so year/academic-year boundaries work.

- [ ] **Step 2: Write RED alternative-pool tests**

Fixture with three eligible schools where the strength-closest school was offered last week. Assert that school is excluded while alternatives exist.

Fixture with only one valid opponent and recent same-school offer. Assert the guard relaxes and planning can still pick that school if chance succeeds.

- [ ] **Step 3: Write RED diversity-priority tests**

Construct opponents with similar strength and verify the ranking prefers:
1. not recently offered,
2. not recently played,
3. never/rarely played,
before minor strength-target differences.

Do not assert private numeric coefficients; assert selected ordering/result.

- [ ] **Step 4: Run RED**

```bash
npx vitest run tests/unit/domain/weekly/practiceMatchPlanning.test.ts
```

- [ ] **Step 5: Implement eligible pool + scoring**

Build a hard-guard pool by filtering recent-offer schools. If that pool is empty, fall back to all opponents.

Then sort/score by bounded components:
- recent-offer penalty dominant,
- recent completed-practice penalty stronger than current `0.035 * meetingCount`,
- strength target remains a meaningful but secondary term,
- deterministic school-id tie-break remains.

Continue deterministic `SeededRandom(...).fork(...)` selection from a small top pool; do not introduce unseeded randomness.

- [ ] **Step 6: Run and commit**

```bash
npx vitest run tests/unit/domain/weekly/practiceMatchPlanning.test.ts
npm run typecheck
git add src/domain/weekly/practiceMatchPlanning.ts tests/unit/domain/weekly/practiceMatchPlanning.test.ts
git commit -m "feat: diversify incoming practice opponents"
```

---

### Task 5: Add bounded rival-aware offer weighting

**Files:**
- Modify: `src/domain/weekly/practiceMatchPlanning.ts`
- Modify: `tests/unit/domain/weekly/practiceMatchPlanning.test.ts`
- Read/Reuse: `src/domain/world/rivalWorldProgression.ts`

**Interfaces:**
- `PracticePlanningSource` must include the minimal `world.rivalryScores` / `destinyRivalSchoolId` data necessary to score eligible opponents.
- Reuse `rivalryKey()`.

- [ ] **Step 1: Write RED rival eligibility tests**

Create two equally strong, equally fresh opponents where one has high rivalry score. With a deterministic seed fixture, assert the rival can move into the preferred/top selection pool after cooldown.

- [ ] **Step 2: Write RED guard precedence tests**

Set the rival school's last offer within 56 days and assert it remains excluded while a non-rival alternative exists. Seed two offers in the current month and assert no rival offer appears at all.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/unit/domain/weekly/practiceMatchPlanning.test.ts
```

- [ ] **Step 4: Implement a bounded rivalry bonus**

Rival bonus is a ranking term only. It cannot bypass cap/cooldown. Prefer destiny rival and high rivalry score modestly, but keep novelty penalties dominant.

Do not mutate `world.rivalryScores` from practice planning.

- [ ] **Step 5: Run and commit**

```bash
npx vitest run tests/unit/domain/weekly/practiceMatchPlanning.test.ts tests/unit/domain/world/rivalWorldProgression.test.ts
npm run typecheck
git add src/domain/weekly/practiceMatchPlanning.ts tests/unit/domain/weekly/practiceMatchPlanning.test.ts
git commit -m "feat: make practice offers rivalry aware"
```

---

### Task 6: Prove outgoing requests remain uncapped and do not pollute the ledger

**Files:**
- Modify: existing scheduling tests for `src/domain/weekly/practiceMatchScheduling.ts`
- Create if needed: `tests/unit/domain/weekly/practiceMatchScheduling.test.ts`

**Interfaces:**
- No production interface changes expected.

- [ ] **Step 1: Add regression tests**

Start from a state whose incoming ledger already has two offers for the current month. Assert `requestPracticeMatch(state, schoolId)` still evaluates the outgoing candidate normally.

If accepted, assert:
```ts
expect(result.state.weeklySchedule.practiceMatch.scheduledBy).toBe("outgoing");
expect(result.state.weeklySchedule.incomingPracticeOfferHistory).toEqual(beforeLedger);
```

If declined or incoming offer is declined, assert ledger is also unchanged because surfacing was recorded earlier.

- [ ] **Step 2: Run regression**

```bash
npx vitest run tests/unit/domain/weekly/practiceMatchScheduling.test.ts tests/unit/domain/weekly/practiceMatchPlanning.test.ts
```

- [ ] **Step 3: Make only necessary compatibility fixes and commit**

```bash
git add tests/unit/domain/weekly src/domain/weekly/practiceMatchScheduling.ts
git commit -m "test: preserve outgoing practice request behavior"
```

Do not change outgoing acceptance percentages unless a test exposes a Phase20 regression.

---

### Task 7: Add deterministic long-run cadence/diversity evidence

**Files:**
- Create: `tests/unit/domain/weekly/phase20PracticeOfferLongRun.test.ts`
- Create: `docs/superpowers/reports/2026-09-14-phase20-pr20-3-practice-offer-results.md` after final numbers are measured

**Interfaces:**
- Test harness repeatedly advances calendar dates/planning and appends surfaced ledger entries through the same helper used by production.

- [ ] **Step 1: Write a deterministic 24-month simulation test**

For at least two fixed seeds, collect surfaced incoming offers and assert hard invariants:

```ts
for (const count of monthlyOfferCounts.values()) {
  expect(count).toBeLessThanOrEqual(2);
}
expect(repeatCooldownViolationsWithAlternatives).toBe(0);
```

- [ ] **Step 2: Record diversity metrics without overfitting**

Collect:
- total surfaced offers,
- unique opponent count,
- maximum single-school share,
- back-to-back same-school count,
- rival-offer count,
- monthly cap violations.

Choose acceptance thresholds only after running the deterministic fixture once. The invariant thresholds are fixed now: monthly violations `0`, guarded cooldown violations `0`. For soft diversity, require a materially distributed result such as at least 6 unique opponents over a sufficiently large surfaced sample and no one school above 35%, but adjust only if world-size fixture makes that impossible; document the measured rationale.

- [ ] **Step 3: Run the focused long-run test**

```bash
npx vitest run tests/unit/domain/weekly/phase20PracticeOfferLongRun.test.ts
```

- [ ] **Step 4: Write the measured report**

The report must include exact seeds, number of months/weeks, monthly max, unique opponents, max share, cooldown violations, rival offer count, and confirmation that outgoing behavior was excluded from incoming counts.

- [ ] **Step 5: Commit evidence**

```bash
git add tests/unit/domain/weekly/phase20PracticeOfferLongRun.test.ts docs/superpowers/reports/2026-09-14-phase20-pr20-3-practice-offer-results.md
git commit -m "test: prove Phase20 practice offer cadence"
```

---

### Task 8: Final regression and PR gate

**Files:**
- Modify only for approved-scope verification fixes.

- [ ] **Step 1: Run focused weekly/persistence tests**

```bash
npx vitest run tests/unit/domain/weekly tests/unit/persistence/gameStateCodec.test.ts tests/unit/persistence/phase20PracticeOfferCodec.test.ts
npm run typecheck
```
Expected: GREEN.

- [ ] **Step 2: Run full repository verification before opening PR**

```bash
npm run verify
npm run release:check
npm run soak:smoke
```
Expected: GREEN.

- [ ] **Step 3: Review boundaries**

Confirm:
- `CURRENT_GAME_SCHEMA_VERSION === 8`,
- old v8 missing-ledger test is GREEN,
- ledger <=32,
- <=2 incoming surfaced offers per calendar month,
- declined offers count via earlier surface ledger,
- same-school cooldown works when alternatives exist,
- outgoing requests are not capped and do not write ledger,
- PvP files unchanged.

- [ ] **Step 4: Open PR only after GREEN**

PR title:
```text
feat: improve practice offer cadence and variety
```

PR body must include exact long-run evidence and candidate SHA.

- [ ] **Step 5: Require official PR CI GREEN, squash merge, and exact merge-SHA main CI GREEN**
