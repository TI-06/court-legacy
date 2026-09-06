# School Economy Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-ready slice of the school economy: schema v7, a server-authoritative funds ledger, new-game/annual budgets, tournament and event/facility ledger entries, and one-click ¥0 shop grants of +300/+1,000/+3,000 with annual limits.

**Architecture:** Keep school funds in the existing `School.funds` field and add a user-school `schoolManagement` block to `GameState` for ledger/history and future assistant-coach state. All game-side fund changes go through one pure domain helper; shop fund grants remain atomic inside the existing Supabase purchase transaction so revision, yearly counter, game state, ledger, and operation replay data cannot diverge. Existing v6 saves migrate to v7 without changing their balance and without receiving the current year's budget again.

**Tech Stack:** Node 22.16.0, TypeScript 5.9, React 19, Vite 7, Vitest 4, Testing Library, Playwright, Zod 4.4.3, Cloudflare Worker, Supabase/PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-06-school-economy-design.md`

## Global Constraints

- The shop remains `¥0` for all products.
- Add immediate fund grants: +300 three times per academic year, +1,000 once, +3,000 once.
- Fund grants are one-click claims and never enter inventory.
- Existing saves preserve their exact current funds and facility levels.
- A v6 -> v7 migration sets `assistantCoach: null`, `fundsHistory: []`, and `lastAnnualBudgetYearIndex` to the legacy `yearIndex`.
- New games record +300 initial activity funds and +400 first-year school budget and start with balance 700.
- Funds may never become negative.
- Keep only the newest 50 ledger entries.
- Every authoritative funds mutation implemented in this PR appends its ledger entry in the same state transition.
- Browser roles must not receive direct database access; shop grant mutation remains service-role/Worker authoritative.
- Preserve existing shop operation replay and optimistic revision semantics.
- Do not change the facility max level/cost formula in this PR; that belongs to the next facility plan.
- Do not implement assistant-coach effects or paid scouting research in this PR; only persist the future-compatible assistant-coach slot as `null`/validated data.
- Do not add or expose any secret values.

---

## File Map

### New domain files

- `src/domain/model/SchoolManagement.ts` — exact persisted types for funds ledger and future assistant-coach contract.
- `src/domain/school/schoolEconomy.ts` — annual-budget tables, alumni deterministic budget bonus, ledger append, safe fund mutation, initial management state, annual budget grant.
- `src/domain/tournament/officialTournamentRewards.ts` — pure reward calculation from authoritative tournament level/round/result.

### Existing domain/persistence files to modify

- `src/domain/model/GameState.ts` — add required `schoolManagement`, bump schema 6 -> 7.
- `src/persistence/gameStateCodec.ts` — validate v7 management data and migrate v6 saves.
- `src/domain/generation/generateWorld.ts` — start new user school at 700 and create the two initial ledger entries.
- `src/domain/calendar/academicYearProgression.ts` — grant annual budget once after annual reputation is resolved.
- `src/domain/events/resolveEventChoice.ts` — route `funds-change` through ledger helper while preserving event debit floor-at-zero behavior.
- `src/domain/school/facilityUpgrade.ts` — keep Lv.5/cost behavior unchanged but route the successful debit through ledger helper.
- `src/domain/tournament/recordOfficialMatch.ts` — append authoritative tournament rewards exactly once.

### Shop files to modify

- `src/domain/shop/shopCatalog.ts` — add three grant item IDs and helpers for immediate grant amount.
- `src/domain/shop/shopContracts.ts` — allow a typed purchase result for immediate grants.
- `worker/data/ShopStore.ts` — accept the extended canonical purchase response without changing the mutation interface.
- `worker/data/SupabaseShopStore.ts` — parse grant responses from the same purchase RPC.
- `worker/routes/shopPurchase.ts` — continue pass-through of the canonical response and test grant shape.
- `supabase/migrations/202609060009_school_economy_foundation.sql` — seed grant definitions, backfill live v6 save JSON to v7 management shape, replace `purchase_shop_item` with an immediate-grant branch that is atomic and idempotent.

### UI files to modify

- `src/features/shop/ShopScreen.tsx` — grant-specific remaining-count display and `¥0で受け取る` CTA; no inventory/use UI for grant items.
- `src/app/GameApp.tsx` — display grant result and adopt refreshed authoritative snapshot after purchase.
- `src/features/school/SchoolScreen.tsx` — make funds chip interactive and show latest ledger entries in `BottomSheet`.
- `src/features/school/school-screen.css` — accessible funds-chip and compact ledger styling.

### Tests

- `tests/unit/persistence/gameStateCodec.test.ts`
- `tests/unit/domain/generation/generateWorld.test.ts`
- Create `tests/unit/domain/school/schoolEconomy.test.ts`
- `tests/unit/domain/calendar/academicYearProgression.test.ts`
- `tests/unit/domain/events/eventResolution.test.ts`
- `tests/unit/domain/school/facilityUpgrade.test.ts`
- Create `tests/unit/domain/tournament/officialTournamentRewards.test.ts`
- `tests/unit/domain/tournament/recordOfficialMatch.test.ts`
- `tests/unit/domain/shop/shopCatalog.test.ts`
- `tests/unit/domain/shop/shopContracts.test.ts`
- `tests/unit/worker/data/SupabaseShopStore.test.ts`
- `tests/unit/worker/routes/shopPurchase.test.ts`
- Create `tests/unit/worker/schoolEconomyMigration.test.ts`
- `tests/unit/features/shop/ShopScreen.test.tsx`
- `tests/unit/features/school/SchoolScreen.test.tsx`
- `tests/e2e/shop-flow.spec.ts`
- `tests/e2e/mobile-layout-audit.spec.ts` only if the existing audit requires explicit route coverage after the UI change.

---

### Task 1: Persisted economy model, v7 migration, and new-game 700 start

**Files:**
- Create: `src/domain/model/SchoolManagement.ts`
- Modify: `src/domain/model/GameState.ts`
- Modify: `src/persistence/gameStateCodec.ts`
- Create: `src/domain/school/schoolEconomy.ts`
- Modify: `src/domain/generation/generateWorld.ts`
- Test: `tests/unit/persistence/gameStateCodec.test.ts`
- Test: `tests/unit/domain/generation/generateWorld.test.ts`
- Create: `tests/unit/domain/school/schoolEconomy.test.ts`

**Interfaces:**
- Produces `SchoolManagementState`, `FundsLedgerEntry`, `FundsLedgerKind`, `AssistantCoachContract`.
- Produces `annualSchoolBudget(reputation: SchoolReputation): number`.
- Produces `alumniAnnualBudgetBonus(level: number): number`.
- Produces `applySchoolFundsChange(state: GameState, input: SchoolFundsChangeInput): SchoolFundsChangeResult`.
- Produces `createInitialSchoolManagement(input): SchoolManagementState`.
- Produces `grantAnnualSchoolBudget(state: GameState): GameState` for Task 2.

- [ ] **Step 1: Write the v6 migration and malformed-ledger RED tests**

Add to `tests/unit/persistence/gameStateCodec.test.ts`:

```ts
it("migrates v6 funds into v7 without paying the current-year budget again", () => {
  const current = createDemoGame();
  const legacy = structuredClone(current) as typeof current & {
    schoolManagement?: typeof current.schoolManagement;
  };
  legacy.schemaVersion = 6;
  delete legacy.schoolManagement;
  legacy.schools[legacy.userSchoolId]!.funds = 777;

  const migrated = decodeGameState(JSON.stringify(legacy));

  expect(migrated.schemaVersion).toBe(7);
  expect(migrated.schools[migrated.userSchoolId]!.funds).toBe(777);
  expect(migrated.schoolManagement).toEqual({
    assistantCoach: null,
    fundsHistory: [],
    lastAnnualBudgetYearIndex: legacy.yearIndex,
  });
});

it("rejects malformed funds ledger entries", () => {
  const state = createDemoGame();

  expect(() =>
    decodeGameState(
      JSON.stringify({
        ...state,
        schoolManagement: {
          ...state.schoolManagement,
          fundsHistory: [
            {
              id: "bad-entry",
              gameDate: state.date,
              academicYearIndex: state.yearIndex,
              kind: "shop-grant",
              amount: 300,
              balanceAfter: -1,
              label: "invalid",
            },
          ],
        },
      }),
    ),
  ).toThrow("セーブデータの形式が正しくありません");
});
```

- [ ] **Step 2: Write the new-game and budget-table RED tests**

Create `tests/unit/domain/school/schoolEconomy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import {
  alumniAnnualBudgetBonus,
  annualSchoolBudget,
  applySchoolFundsChange,
} from "../../../../src/domain/school/schoolEconomy";

describe("school economy", () => {
  it("maps reputation to the approved annual budgets", () => {
    expect(annualSchoolBudget("unknown")).toBe(400);
    expect(annualSchoolBudget("district-contender")).toBe(500);
    expect(annualSchoolBudget("prefectural-power")).toBe(650);
    expect(annualSchoolBudget("national-qualifier")).toBe(850);
    expect(annualSchoolBudget("national-regular")).toBe(1100);
    expect(annualSchoolBudget("elite")).toBe(1400);
  });

  it("calculates the deterministic alumni budget contribution", () => {
    expect(alumniAnnualBudgetBonus(0)).toBe(0);
    expect(alumniAnnualBudgetBonus(5)).toBe(40);
    expect(alumniAnnualBudgetBonus(20)).toBe(260);
    expect(alumniAnnualBudgetBonus(50)).toBe(800);
  });

  it("rejects an unaffordable debit instead of creating debt", () => {
    const state = createDemoGame();
    expect(() =>
      applySchoolFundsChange(state, {
        id: "test:overspend",
        kind: "facility-upgrade",
        amount: -99999,
        label: "overspend",
      }),
    ).toThrow("insufficient school funds");
  });
});
```

Add to `tests/unit/domain/generation/generateWorld.test.ts` inside the existing initial-state test:

```ts
const school = world.schools[world.userSchoolId]!;
expect(school.funds).toBe(700);
expect(world.schoolManagement.lastAnnualBudgetYearIndex).toBe(1);
expect(world.schoolManagement.fundsHistory).toEqual([
  expect.objectContaining({
    kind: "initial-funds",
    amount: 300,
    balanceAfter: 300,
  }),
  expect.objectContaining({
    kind: "annual-budget",
    amount: 400,
    balanceAfter: 700,
  }),
]);
```

- [ ] **Step 3: Run focused tests to verify RED**

Run:

```bash
npm test -- tests/unit/persistence/gameStateCodec.test.ts tests/unit/domain/generation/generateWorld.test.ts tests/unit/domain/school/schoolEconomy.test.ts
```

Expected: FAIL because `schoolManagement`, schema v7, and economy helpers do not exist.

- [ ] **Step 4: Add the persisted types**

Create `src/domain/model/SchoolManagement.ts`:

```ts
import type { GameDate } from "./identifiers";

export type FundsLedgerKind =
  | "initial-funds"
  | "annual-budget"
  | "tournament-reward"
  | "event"
  | "shop-grant"
  | "facility-upgrade"
  | "assistant-coach"
  | "scouting-research"
  | "camp"
  | "travel";

export type AssistantCoachRank =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "master";

export type AssistantCoachSpecialty = "attack" | "defense" | "physical";

export interface AssistantCoachContract {
  rank: AssistantCoachRank;
  specialty: AssistantCoachSpecialty | null;
  contractYearIndex: number;
}

export interface FundsLedgerEntry {
  id: string;
  gameDate: GameDate;
  academicYearIndex: number;
  kind: FundsLedgerKind;
  amount: number;
  balanceAfter: number;
  label: string;
  relatedId?: string;
}

export interface SchoolManagementState {
  assistantCoach: AssistantCoachContract | null;
  fundsHistory: FundsLedgerEntry[];
  lastAnnualBudgetYearIndex: number;
}
```

Modify `GameState` to require `schoolManagement: SchoolManagementState` and set `CURRENT_GAME_SCHEMA_VERSION = 7`.

- [ ] **Step 5: Implement the economy primitives**

Create `src/domain/school/schoolEconomy.ts` with these exact public signatures:

```ts
import type { GameState } from "../model/GameState";
import type {
  FundsLedgerEntry,
  FundsLedgerKind,
  SchoolManagementState,
} from "../model/SchoolManagement";
import type { SchoolReputation } from "../model/School";
import type { GameDate } from "../model/identifiers";

export const MAX_FUNDS_HISTORY = 50;

const ANNUAL_BUDGETS: Record<SchoolReputation, number> = {
  unknown: 400,
  "district-contender": 500,
  "prefectural-power": 650,
  "national-qualifier": 850,
  "national-regular": 1100,
  elite: 1400,
};

export interface SchoolFundsChangeInput {
  id: string;
  kind: FundsLedgerKind;
  amount: number;
  label: string;
  relatedId?: string;
  allowPartialDebit?: boolean;
}

export interface SchoolFundsChangeResult {
  state: GameState;
  appliedAmount: number;
}

export function annualSchoolBudget(reputation: SchoolReputation): number {
  return ANNUAL_BUDGETS[reputation];
}

export function alumniAnnualBudgetBonus(level: number): number {
  if (!Number.isInteger(level) || level < 0 || level > 50) {
    throw new Error("invalid alumni association level");
  }
  return level * 8 + (level >= 20 ? 100 : 0) + (level >= 50 ? 300 : 0);
}

export function applySchoolFundsChange(
  state: GameState,
  input: SchoolFundsChangeInput,
): SchoolFundsChangeResult {
  if (!Number.isSafeInteger(input.amount) || input.amount === 0) {
    throw new Error("funds change must be a non-zero safe integer");
  }
  const school = state.schools[state.userSchoolId];
  if (!school) throw new Error("user school is missing");

  const requestedBalance = school.funds + input.amount;
  if (requestedBalance < 0 && !input.allowPartialDebit) {
    throw new Error("insufficient school funds");
  }
  const appliedAmount =
    requestedBalance < 0 ? -school.funds : input.amount;
  if (appliedAmount === 0) return { state, appliedAmount: 0 };
  const balanceAfter = school.funds + appliedAmount;
  const entry: FundsLedgerEntry = {
    id: input.id,
    gameDate: state.date,
    academicYearIndex: state.yearIndex,
    kind: input.kind,
    amount: appliedAmount,
    balanceAfter,
    label: input.label,
    ...(input.relatedId ? { relatedId: input.relatedId } : {}),
  };

  return {
    appliedAmount,
    state: {
      ...state,
      schools: {
        ...state.schools,
        [school.id]: { ...school, funds: balanceAfter },
      },
      schoolManagement: {
        ...state.schoolManagement,
        fundsHistory: [...state.schoolManagement.fundsHistory, entry].slice(
          -MAX_FUNDS_HISTORY,
        ),
      },
    },
  };
}

export function createInitialSchoolManagement(input: {
  gameDate: GameDate;
  academicYearIndex: number;
  initialFunds: number;
  annualBudget: number;
}): SchoolManagementState {
  return {
    assistantCoach: null,
    lastAnnualBudgetYearIndex: input.academicYearIndex,
    fundsHistory: [
      {
        id: `initial-funds:year-${input.academicYearIndex}`,
        gameDate: input.gameDate,
        academicYearIndex: input.academicYearIndex,
        kind: "initial-funds",
        amount: input.initialFunds,
        balanceAfter: input.initialFunds,
        label: "初期活動資金",
      },
      {
        id: `annual-budget:year-${input.academicYearIndex}`,
        gameDate: input.gameDate,
        academicYearIndex: input.academicYearIndex,
        kind: "annual-budget",
        amount: input.annualBudget,
        balanceAfter: input.initialFunds + input.annualBudget,
        label: "初年度学校予算",
      },
    ],
  };
}
```

Also declare `grantAnnualSchoolBudget` in this file in Task 2; do not call it yet.

- [ ] **Step 6: Add strict v7 codec validation and v6 migration**

In `gameStateCodec.ts`, add strict schemas for assistant coach and ledger. The ledger schema must require integer amounts, nonnegative integer `balanceAfter`, positive `academicYearIndex`, one of the exact ledger kinds, and `max(50)` entries.

Implement:

```ts
function migrateVersionSix(legacy: Record<string, unknown>): unknown {
  const yearIndex =
    typeof legacy.yearIndex === "number" && Number.isInteger(legacy.yearIndex)
      ? legacy.yearIndex
      : 1;
  return {
    ...legacy,
    schemaVersion: CURRENT_GAME_SCHEMA_VERSION,
    schoolManagement: {
      assistantCoach: null,
      fundsHistory: [],
      lastAnnualBudgetYearIndex: yearIndex,
    },
  };
}
```

Change the prior v5 migration so it produces schema 6 and then calls `migrateVersionSix`, and add the explicit `version === 6` branch.

- [ ] **Step 7: Initialize new worlds at 700**

In `generateWorld.ts`, after all schools exist and before `baseState`, read the generated user school's existing `funds` (expected 300), calculate `annualSchoolBudget(userSchool.reputation)`, replace only the user-school funds with `initialFunds + firstBudget`, and add `schoolManagement: createInitialSchoolManagement(...)` to `baseState`.

Do not change rival-school funds.

- [ ] **Step 8: Run focused tests to verify GREEN**

Run the same focused command from Step 3.

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/domain/model/SchoolManagement.ts src/domain/model/GameState.ts src/domain/school/schoolEconomy.ts src/domain/generation/generateWorld.ts src/persistence/gameStateCodec.ts tests/unit/persistence/gameStateCodec.test.ts tests/unit/domain/generation/generateWorld.test.ts tests/unit/domain/school/schoolEconomy.test.ts
git commit -m "feat: add school economy state and ledger"
```

---

### Task 2: Annual budget rollover plus ledger coverage for existing event and facility fund mutations

**Files:**
- Modify: `src/domain/school/schoolEconomy.ts`
- Modify: `src/domain/calendar/academicYearProgression.ts`
- Modify: `src/domain/events/resolveEventChoice.ts`
- Modify: `src/domain/school/facilityUpgrade.ts`
- Test: `tests/unit/domain/calendar/academicYearProgression.test.ts`
- Test: `tests/unit/domain/events/eventResolution.test.ts`
- Test: `tests/unit/domain/school/facilityUpgrade.test.ts`

**Interfaces:**
- Consumes `applySchoolFundsChange`, `annualSchoolBudget`, `alumniAnnualBudgetBonus` from Task 1.
- Produces `grantAnnualSchoolBudget(state: GameState): GameState`.

- [ ] **Step 1: Write RED assertions for one-time annual budget**

In `academicYearProgression.test.ts`, capture funds before `advanceAcademicYear`. After rollover assert:

```ts
const userSchool = result.state.schools[result.state.userSchoolId]!;
const expectedBudget =
  annualSchoolBudget(userSchool.reputation) +
  alumniAnnualBudgetBonus(userSchool.facilities.alumniAssociation);
expect(userSchool.funds).toBe(fundsBefore + expectedBudget);
expect(result.state.schoolManagement.lastAnnualBudgetYearIndex).toBe(
  result.state.yearIndex,
);
expect(result.state.schoolManagement.fundsHistory.at(-1)).toMatchObject({
  kind: "annual-budget",
  amount: expectedBudget,
  balanceAfter: userSchool.funds,
});
expect(grantAnnualSchoolBudget(result.state)).toBe(result.state);
```

- [ ] **Step 2: Write RED ledger assertions for events and facilities**

In `eventResolution.test.ts`, after the existing +20 event assertion add:

```ts
expect(result.state.schoolManagement.fundsHistory.at(-1)).toMatchObject({
  kind: "event",
  amount: 20,
  balanceAfter: fundsBefore + 20,
  relatedId: effectEvent.id,
});
```

Add a debit fixture with a cost greater than available funds and assert the existing event behavior remains floor-at-zero while the ledger stores the actual applied debit rather than the requested amount.

In `facilityUpgrade.test.ts`, after the successful training-room upgrade add:

```ts
expect(result.schoolManagement.fundsHistory.at(-1)).toMatchObject({
  kind: "facility-upgrade",
  amount: -70,
  balanceAfter: 230,
  relatedId: "trainingRoom",
});
```

- [ ] **Step 3: Run focused tests and confirm RED**

```bash
npm test -- tests/unit/domain/calendar/academicYearProgression.test.ts tests/unit/domain/events/eventResolution.test.ts tests/unit/domain/school/facilityUpgrade.test.ts
```

Expected: ledger and annual-budget assertions fail.

- [ ] **Step 4: Implement annual budget helper**

Add to `schoolEconomy.ts`:

```ts
export function grantAnnualSchoolBudget(state: GameState): GameState {
  if (state.schoolManagement.lastAnnualBudgetYearIndex >= state.yearIndex) {
    return state;
  }
  const school = state.schools[state.userSchoolId];
  if (!school) throw new Error("user school is missing");
  const amount =
    annualSchoolBudget(school.reputation) +
    alumniAnnualBudgetBonus(school.facilities.alumniAssociation);
  const funded = applySchoolFundsChange(state, {
    id: `annual-budget:year-${state.yearIndex}`,
    kind: "annual-budget",
    amount,
    label: "年度学校予算",
    relatedId: `year-${state.yearIndex}`,
  }).state;
  return {
    ...funded,
    schoolManagement: {
      ...funded.schoolManagement,
      lastAnnualBudgetYearIndex: funded.yearIndex,
    },
  };
}
```

Call it once near the end of `advanceAcademicYear`, after reputation has been resolved/restored and after `yearIndex` has incremented, before returning the state.

- [ ] **Step 5: Route event `funds-change` through the helper**

Pass the choice/effect index into the effect application so each ledger entry gets a stable semantic ID:

```ts
const changed = applySchoolFundsChange(state, {
  id: `event:${event.id}:${state.date}:${choiceId}:${effectIndex}`,
  kind: "event",
  amount: effect.amount,
  label: event.title,
  relatedId: event.id,
  allowPartialDebit: true,
});
return {
  state: changed.state,
  visibleResult: `資金 ${signed(changed.appliedAmount)}`,
};
```

Do not change any other event effect behavior.

- [ ] **Step 6: Route successful facility debit through the helper without changing facility rules**

After `evaluateFacilityUpgrade` approves, call:

```ts
const funded = applySchoolFundsChange(state, {
  id: `facility:${schoolId}:${key}:lv-${evaluation.nextLevel}`,
  kind: "facility-upgrade",
  amount: -evaluation.cost,
  label: `${getDefinition(key).name} Lv.${evaluation.nextLevel}強化`,
  relatedId: key,
}).state;
```

Then update the facility on `funded`. Keep current max Lv.5 and current `baseCost * (level + 1)` formula unchanged in this task.

- [ ] **Step 7: Run focused tests to verify GREEN**

Run Step 3 command. Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/domain/school/schoolEconomy.ts src/domain/calendar/academicYearProgression.ts src/domain/events/resolveEventChoice.ts src/domain/school/facilityUpgrade.ts tests/unit/domain/calendar/academicYearProgression.test.ts tests/unit/domain/events/eventResolution.test.ts tests/unit/domain/school/facilityUpgrade.test.ts
git commit -m "feat: record annual and operating fund changes"
```

---

### Task 3: Authoritative tournament rewards

**Files:**
- Create: `src/domain/tournament/officialTournamentRewards.ts`
- Modify: `src/domain/tournament/recordOfficialMatch.ts`
- Create: `tests/unit/domain/tournament/officialTournamentRewards.test.ts`
- Modify: `tests/unit/domain/tournament/recordOfficialMatch.test.ts`

**Interfaces:**
- Produces `officialTournamentFundRewards(input): OfficialTournamentFundReward[]`.
- Consumes `applySchoolFundsChange` from Task 1.

- [ ] **Step 1: Write the pure reward-table RED test**

Create `officialTournamentRewards.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { officialTournamentFundRewards } from "../../../../src/domain/tournament/officialTournamentRewards";

const total = (items: ReturnType<typeof officialTournamentFundRewards>) =>
  items.reduce((sum, item) => sum + item.amount, 0);

describe("official tournament fund rewards", () => {
  it("rewards prefectural progression", () => {
    expect(total(officialTournamentFundRewards({ level: "prefectural", round: "round-of-16", won: true }))).toBe(75);
    expect(total(officialTournamentFundRewards({ level: "prefectural", round: "quarterfinal", won: true }))).toBe(105);
    expect(total(officialTournamentFundRewards({ level: "prefectural", round: "final", won: false }))).toBe(120);
    expect(total(officialTournamentFundRewards({ level: "prefectural", round: "final", won: true }))).toBe(625);
  });

  it("rewards national progression", () => {
    expect(total(officialTournamentFundRewards({ level: "national", round: "round-of-16", won: true }))).toBe(260);
    expect(total(officialTournamentFundRewards({ level: "national", round: "quarterfinal", won: true }))).toBe(410);
    expect(total(officialTournamentFundRewards({ level: "national", round: "final", won: false }))).toBe(600);
    expect(total(officialTournamentFundRewards({ level: "national", round: "final", won: true }))).toBe(1060);
  });
});
```

The prefectural-final win total is `+25 win +250 champion +250 national qualification +100 national Best16`. The national round-of-16 win total is `+60 win +200 Best8`; the +100 Best16 reward was already paid at qualification.

- [ ] **Step 2: Run the test and confirm RED**

```bash
npm test -- tests/unit/domain/tournament/officialTournamentRewards.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure reward calculator**

Use this exact output shape:

```ts
import type { TournamentLevel, TournamentRound } from "./tournamentTypes";

export interface OfficialTournamentFundReward {
  code: string;
  amount: number;
  label: string;
}

export function officialTournamentFundRewards(input: {
  level: TournamentLevel;
  round: TournamentRound;
  won: boolean;
}): OfficialTournamentFundReward[] {
  const rewards: OfficialTournamentFundReward[] = [];

  if (input.level === "prefectural") {
    if (input.won) rewards.push({ code: "win", amount: 25, label: "県大会勝利" });
    if (input.round === "round-of-16" && input.won) rewards.push({ code: "best-8", amount: 50, label: "県大会ベスト8" });
    if (input.round === "quarterfinal" && input.won) rewards.push({ code: "best-4", amount: 80, label: "県大会ベスト4" });
    if (input.round === "final" && !input.won) rewards.push({ code: "runner-up", amount: 120, label: "県大会準優勝" });
    if (input.round === "final" && input.won) {
      rewards.push({ code: "champion", amount: 250, label: "県大会優勝" });
      rewards.push({ code: "national-qualification", amount: 250, label: "全国大会出場" });
      rewards.push({ code: "national-best-16", amount: 100, label: "全国大会ベスト16" });
    }
    return rewards;
  }

  if (input.won) rewards.push({ code: "win", amount: 60, label: "全国大会勝利" });
  if (input.round === "round-of-16" && input.won) rewards.push({ code: "best-8", amount: 200, label: "全国大会ベスト8" });
  if (input.round === "quarterfinal" && input.won) rewards.push({ code: "best-4", amount: 350, label: "全国大会ベスト4" });
  if (input.round === "final" && !input.won) rewards.push({ code: "runner-up", amount: 600, label: "全国大会準優勝" });
  if (input.round === "final" && input.won) rewards.push({ code: "champion", amount: 1000, label: "全国大会優勝" });
  return rewards;
}
```

- [ ] **Step 4: Add integration assertions to `recordOfficialMatch.test.ts`**

For an authoritative user match, compute `rewards` from the due match's level/round and actual result, and assert funds increased by `sum(rewards)` and that the newest ledger entries are `kind: "tournament-reward"` with the expected amounts. Also call `recordOfficialTournamentOutcome` again on the already-recorded resulting state and assert the returned state is unchanged, proving no duplicate reward on replay.

- [ ] **Step 5: Apply rewards in `recordOfficialTournamentOutcome`**

After `completeTournamentMatch(...)` succeeds, fold the reward list through `applySchoolFundsChange` using IDs:

```ts
`tournament:${stage.tournamentId}:${input.bracketMatchId}:${reward.code}`
```

and `relatedId: stage.tournamentId`. Apply no reward when `userWon` is false except final runner-up. Keep the existing history guard at the top untouched.

- [ ] **Step 6: Run focused tournament tests to verify GREEN**

```bash
npm test -- tests/unit/domain/tournament/officialTournamentRewards.test.ts tests/unit/domain/tournament/recordOfficialMatch.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/domain/tournament/officialTournamentRewards.ts src/domain/tournament/recordOfficialMatch.ts tests/unit/domain/tournament/officialTournamentRewards.test.ts tests/unit/domain/tournament/recordOfficialMatch.test.ts
git commit -m "feat: award funds for official tournaments"
```

---

### Task 4: Add the three immediate grant products to the typed shop model and UI

**Files:**
- Modify: `src/domain/shop/shopCatalog.ts`
- Modify: `src/domain/shop/shopContracts.ts`
- Modify: `src/features/shop/ShopScreen.tsx`
- Test: `tests/unit/domain/shop/shopCatalog.test.ts`
- Test: `tests/unit/domain/shop/shopContracts.test.ts`
- Test: `tests/unit/features/shop/ShopScreen.test.tsx`

**Interfaces:**
- Produces `shopFundsGrantAmount(itemId: ShopItemId): 300 | 1000 | 3000 | null`.
- Extends `ShopPurchaseResponse` with optional `result?: { fundsGranted: number; balanceAfter: number }`.

- [ ] **Step 1: Write RED catalog and screen tests**

Update the catalog expectation to contain 10 items and assert:

```ts
expect(getShopItemDefinition("funds-grant-300")).toMatchObject({
  displayName: "資金 +300",
  priceYen: 0,
  annualPurchaseLimit: 3,
  targetKind: "none",
});
expect(shopFundsGrantAmount("funds-grant-300")).toBe(300);
expect(shopFundsGrantAmount("funds-grant-1000")).toBe(1000);
expect(shopFundsGrantAmount("funds-grant-3000")).toBe(3000);
expect(shopFundsGrantAmount("fatigue-recovery")).toBeNull();
```

In `ShopScreen.test.tsx`, add a grant status row with `purchasedCount: 1`, `quantityOwned: 0`, then assert:

```ts
expect(screen.getByText("年度残り 2 / 3")).toBeVisible();
const button = screen.getByRole("button", { name: "資金 +300を受け取る" });
expect(button).toHaveTextContent("¥0で受け取る");
fireEvent.click(button);
expect(props.onPurchase).toHaveBeenCalledWith("funds-grant-300");
```

Switch to inventory and assert `資金 +300` is absent.

- [ ] **Step 2: Run focused shop tests and confirm RED**

```bash
npm test -- tests/unit/domain/shop/shopCatalog.test.ts tests/unit/domain/shop/shopContracts.test.ts tests/unit/features/shop/ShopScreen.test.tsx
```

Expected: FAIL on missing grant IDs/helpers/UI.

- [ ] **Step 3: Extend catalog**

Add IDs after the existing seven items, with stable sort orders 80/90/100:

```ts
{
  itemId: "funds-grant-300",
  displayName: "資金 +300",
  description: "学校運営資金を300受け取ります。",
  priceYen: 0,
  annualPurchaseLimit: 3,
  annualUseLimit: 3,
  targetKind: "none",
  sortOrder: 80,
},
{
  itemId: "funds-grant-1000",
  displayName: "資金 +1,000",
  description: "学校運営資金を1,000受け取ります。",
  priceYen: 0,
  annualPurchaseLimit: 1,
  annualUseLimit: 1,
  targetKind: "none",
  sortOrder: 90,
},
{
  itemId: "funds-grant-3000",
  displayName: "資金 +3,000",
  description: "学校運営資金を3,000受け取ります。",
  priceYen: 0,
  annualPurchaseLimit: 1,
  annualUseLimit: 1,
  targetKind: "none",
  sortOrder: 100,
},
```

Implement `shopFundsGrantAmount` with an exhaustive `switch` for these three IDs and `null` otherwise.

- [ ] **Step 4: Extend purchase response contract**

Keep ordinary purchase responses unchanged and add:

```ts
export interface ShopFundsGrantResult {
  fundsGranted: number;
  balanceAfter: number;
}

export interface ShopPurchaseResponse extends ShopMutationResponseBase {
  operationType: "purchase";
  result?: ShopFundsGrantResult;
}
```

Add schema/contract tests that reject nonnumeric `fundsGranted`/negative `balanceAfter` if the file currently validates response payloads; if it only defines TS request schemas, test the request item enum accepts all three new IDs and leave response runtime validation to `SupabaseShopStore` in Task 5.

- [ ] **Step 5: Render immediate-grant cards**

In `ProductCard`, derive `const grantAmount = shopFundsGrantAmount(item.itemId)`. For a grant:

- show `年度残り ${annualPurchaseLimit - purchasedCount} / ${annualPurchaseLimit}` instead of purchase/use/inventory chips;
- button accessible name `${displayName}を受け取る`;
- button text `¥0で受け取る`;
- retain `canPurchase` and pending/limit disabling;
- never add grant items to inventory because server quantity remains zero.

- [ ] **Step 6: Run focused shop tests to verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/domain/shop/shopCatalog.ts src/domain/shop/shopContracts.ts src/features/shop/ShopScreen.tsx tests/unit/domain/shop/shopCatalog.test.ts tests/unit/domain/shop/shopContracts.test.ts tests/unit/features/shop/ShopScreen.test.tsx
git commit -m "feat: add zero-yen fund grant products"
```

---

### Task 5: Make shop fund grants atomic in Supabase and preserve replay/revision guarantees

**Files:**
- Create: `supabase/migrations/202609060009_school_economy_foundation.sql`
- Modify: `worker/data/SupabaseShopStore.ts`
- Test: `tests/unit/worker/data/SupabaseShopStore.test.ts`
- Test: `tests/unit/worker/routes/shopPurchase.test.ts`
- Create: `tests/unit/worker/schoolEconomyMigration.test.ts`

**Interfaces:**
- Existing `purchase_shop_item(p_user_id, p_operation_id, p_request_fingerprint, p_expected_revision, p_item_id)` signature remains unchanged.
- Grant purchase canonical response adds `result: { fundsGranted, balanceAfter }`.
- Grant mutation returns `quantity_owned = 0` and does not insert/update `shop_inventory`.

- [ ] **Step 1: Write RED migration text assertions**

Create `schoolEconomyMigration.test.ts` that reads only migration 009 and asserts it contains all of these exact invariants:

```ts
expect(sql).toContain("'funds-grant-300'");
expect(sql).toContain("'funds-grant-1000'");
expect(sql).toContain("'funds-grant-3000'");
expect(sql).toContain("price_yen");
expect(sql).toContain("jsonb_set");
expect(sql).toContain("schoolManagement");
expect(sql).toContain("fundsHistory");
expect(sql).toContain("lastAnnualBudgetYearIndex");
expect(sql).toContain("for update");
expect(sql).toContain("purchase_limit_reached");
expect(sql).toContain("shop-grant");
expect(sql).toContain("fundsGranted");
expect(sql).toContain("balanceAfter");
```

Also assert no SQL grants are added for `anon` or `authenticated`.

- [ ] **Step 2: Write RED store/route response tests**

In `SupabaseShopStore.test.ts`, add a purchase RPC row:

```ts
const grantMutationRow = {
  ...mutationRow,
  item_id: "funds-grant-300",
  quantity_owned: 0,
  response: {
    operationId: "shop-grant-001",
    operationType: "purchase",
    revision: 8,
    academicYearIndex: 4,
    itemId: "funds-grant-300",
    quantityOwned: 0,
    purchasedCount: 1,
    usedCount: 0,
    result: { fundsGranted: 300, balanceAfter: 1000 },
  },
};
```

Assert `store.purchase()` preserves that exact canonical response. In route test, use the same shape and assert JSON response includes `result` unchanged.

- [ ] **Step 3: Run focused worker tests and confirm RED**

```bash
npm test -- tests/unit/worker/schoolEconomyMigration.test.ts tests/unit/worker/data/SupabaseShopStore.test.ts tests/unit/worker/routes/shopPurchase.test.ts
```

Expected: migration file missing / grant shape not yet covered.

- [ ] **Step 4: Create migration 009 with v6 save backfill**

The migration must first seed the three definitions using `insert ... on conflict (item_id) do update` while preserving `price_yen = 0`.

Backfill current production v6 rows only:

```sql
update public.game_saves as save
set state = jsonb_set(
  jsonb_set(save.state, '{schemaVersion}', '7'::jsonb, true),
  '{schoolManagement}',
  jsonb_build_object(
    'assistantCoach', null,
    'fundsHistory', '[]'::jsonb,
    'lastAnnualBudgetYearIndex', (save.state ->> 'yearIndex')::integer
  ),
  true
)
where (save.state ->> 'schemaVersion')::integer = 6
  and not (save.state ? 'schoolManagement');
```

Do not modify existing funds or facilities in this backfill.

- [ ] **Step 5: Replace `purchase_shop_item` with a grant branch inside the existing transaction**

Keep all existing validation, operation replay, revision check, item lock, yearly counter lock, transaction record, revision increment, and operation-response persistence behavior.

After annual-limit validation, derive:

```sql
v_funds_granted := case v_item.item_id
  when 'funds-grant-300' then 300
  when 'funds-grant-1000' then 1000
  when 'funds-grant-3000' then 3000
  else 0
end;
```

For `v_funds_granted > 0`:

1. Read `v_school_id := v_state ->> 'userSchoolId'`.
2. Read integer current balance from `v_state #>> array['schools', v_school_id, 'funds']` and fail `invalid_game_state` if missing/noninteger.
3. Set the school funds to `v_balance_after := v_balance_before + v_funds_granted` using `jsonb_set`.
4. Build a ledger object:

```sql
jsonb_build_object(
  'id', 'shop-grant:' || btrim(p_operation_id),
  'gameDate', v_state ->> 'date',
  'academicYearIndex', v_year_index,
  'kind', 'shop-grant',
  'amount', v_funds_granted,
  'balanceAfter', v_balance_after,
  'label', v_item.display_name,
  'relatedId', v_item.item_id
)
```

5. Append it to `schoolManagement.fundsHistory` and keep only the newest 50. Use `jsonb_array_elements` with ordinality or array slicing logic inside SQL; the stored JSON must remain an array even when previously empty.
6. Increment `shop_yearly_counters.purchased_count`.
7. Do **not** create/update `shop_inventory`; set returned `v_quantity := 0`.
8. Update `game_saves.state` with the changed state and revision exactly once.
9. Build canonical response containing:

```json
{
  "operationType": "purchase",
  "itemId": "funds-grant-300",
  "quantityOwned": 0,
  "result": { "fundsGranted": 300, "balanceAfter": 1000 }
}
```

For ordinary items, preserve the previous inventory path byte-for-byte where practical.

Replay of the same `operation_id` must return the stored response without applying another grant or incrementing the counter again.

- [ ] **Step 6: Tighten Supabase response parsing**

In `SupabaseShopStore.ts`, extend the canonical response schema used for purchase mutation to allow optional strict `result`:

```ts
result: z
  .object({
    fundsGranted: z.number().int().positive(),
    balanceAfter: z.number().int().nonnegative(),
  })
  .strict()
  .optional(),
```

Reject malformed grant results as `ShopStoreDataError`.

- [ ] **Step 7: Run worker tests to verify GREEN**

Run Step 3 command. Expected: PASS.

- [ ] **Step 8: SQL dry-run against the connected Supabase project before applying migration**

Using the Supabase connector, execute a transaction that rolls back:

```sql
begin;
-- apply the replacement function body in-session if needed for the probe,
-- call purchase_shop_item for a dedicated test user/save only if such a fixture exists,
-- otherwise validate function compilation and JSON expressions with a synthetic jsonb value.
rollback;
```

Do not mutate a real user's funds for the dry-run. Required evidence before moving on: migration compiles, v6 backfill expression yields schema 7 with unchanged `schools.*.funds`, and the grant JSON append retains at most 50 ledger entries.

- [ ] **Step 9: Commit Task 5**

```bash
git add supabase/migrations/202609060009_school_economy_foundation.sql worker/data/SupabaseShopStore.ts tests/unit/worker/schoolEconomyMigration.test.ts tests/unit/worker/data/SupabaseShopStore.test.ts tests/unit/worker/routes/shopPurchase.test.ts
git commit -m "feat: make shop fund grants atomic"
```

---

### Task 6: Show the immediate grant result and funds ledger in the browser

**Files:**
- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/school/SchoolScreen.tsx`
- Modify: `src/features/school/school-screen.css`
- Test: `tests/unit/features/school/SchoolScreen.test.tsx`
- Test: `tests/unit/features/shop/ShopScreen.test.tsx`

**Interfaces:**
- Consumes `ShopPurchaseResponse.result` from Task 4/5.
- Consumes `state.schoolManagement.fundsHistory` from Task 1.

- [ ] **Step 1: Write RED school funds-ledger UI test**

In `SchoolScreen.test.tsx`, construct state with two ledger entries and assert:

```ts
fireEvent.click(screen.getByRole("button", { name: /資金 700/ }));
expect(screen.getByRole("heading", { name: "資金履歴" })).toBeVisible();
expect(screen.getByText("初年度学校予算")).toBeVisible();
expect(screen.getByText("+400")).toBeVisible();
expect(screen.getByText("初期活動資金")).toBeVisible();
expect(screen.getByText("+300")).toBeVisible();
```

Also verify order is newest-first in the rendered ledger even though persisted history is oldest-to-newest.

- [ ] **Step 2: Run focused UI test and confirm RED**

```bash
npm test -- tests/unit/features/school/SchoolScreen.test.tsx tests/unit/features/shop/ShopScreen.test.tsx
```

Expected: funds is not yet a button / ledger sheet missing.

- [ ] **Step 3: Make the funds chip an accessible button and add ledger `BottomSheet`**

Add local state `fundsHistoryOpen`. Replace the hero `<strong>` with:

```tsx
<button
  aria-label={`資金 ${school.funds}・履歴を表示`}
  className="school-funds-button"
  onClick={() => setFundsHistoryOpen(true)}
  type="button"
>
  資金 {school.funds}
</button>
```

Render `BottomSheet title="資金履歴"` and map `[...state.schoolManagement.fundsHistory].reverse()`. Format amount with explicit `+` for positive values, use the entry's `gameDate` and `label`, and display `残高 ${entry.balanceAfter}`. If history is empty for a migrated save, show `資金履歴はまだありません`.

- [ ] **Step 4: Style without changing the current compact mobile header footprint**

Add `.school-funds-button`, `.funds-ledger`, `.funds-ledger__entry`, positive/negative amount classes. Reuse the current chip dimensions and colors; do not increase header height at 360px viewport.

- [ ] **Step 5: Show grant result in `GameApp.executeShopPurchase`**

After successful purchase and authoritative bootstrap refresh:

```ts
if (response.result) {
  setShopResultMessage(
    `資金 +${response.result.fundsGranted.toLocaleString("ja-JP")} / 残高 ${response.result.balanceAfter.toLocaleString("ja-JP")}`,
  );
} else {
  setShopResultMessage("購入しました ✓");
}
```

Do not optimistically mutate local funds before `refreshShopAfterMutation`; the refreshed server snapshot remains authoritative.

- [ ] **Step 6: Run focused UI tests to verify GREEN**

Run Step 2 command. Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add src/app/GameApp.tsx src/features/school/SchoolScreen.tsx src/features/school/school-screen.css tests/unit/features/school/SchoolScreen.test.tsx tests/unit/features/shop/ShopScreen.test.tsx
git commit -m "feat: show school fund history and grant results"
```

---

### Task 7: End-to-end grant behavior, regression verification, PR, and safe deployment order

**Files:**
- Modify: `tests/e2e/shop-flow.spec.ts`
- Possibly modify: `tests/e2e/mobile-layout-audit.spec.ts` only if the existing audit needs an explicit selector for the now-clickable funds chip.

**Interfaces:**
- Validates the whole path: Shop UI -> Worker purchase -> authoritative server snapshot -> school funds UI.

- [ ] **Step 1: Write the E2E grant test**

Add to `shop-flow.spec.ts`:

```ts
test("mobile shop fund grant is immediate, capped yearly, and appears in the school ledger", async ({ page }) => {
  await enableVisibleActionDelay(page, 300);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await openShop(page);

  const grant = shopCard(page, "資金 +300");
  await expect(grant).toContainText("年度残り 3 / 3");
  await grant.getByRole("button", { name: "資金 +300を受け取る" }).click();
  await expect(page.getByText(/資金 \+300 \/ 残高/)).toBeVisible({ timeout: 2_500 });
  await expect(grant).toContainText("年度残り 2 / 3");

  await page.getByRole("button", { name: "所持品", exact: true }).click();
  await expect(page.getByRole("heading", { name: "資金 +300" })).toHaveCount(0);

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await page.getByRole("button", { name: /資金 .*履歴を表示/ }).click();
  await expect(page.getByRole("heading", { name: "資金履歴" })).toBeVisible();
  await expect(page.getByText("資金 +300")).toBeVisible();
  await expect(page.getByText("+300")).toBeVisible();

  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(360);
});
```

Then extend the same test or add a second one that claims +300 three times and asserts the fourth claim button is disabled and the displayed remaining count is `0 / 3`.

- [ ] **Step 2: Run the focused E2E test**

```bash
npm run test:e2e -- tests/e2e/shop-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run full local verification**

Run in this order and stop at the first failure:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Expected: all commands exit 0. `npm run test:e2e` must retain the existing mobile shop, scouting, tournament, and layout flows.

- [ ] **Step 4: Review the diff specifically for scope leakage**

The implementation diff must not contain:

- facility max-level changes to 50;
- the new facility cost formula;
- assistant-coach training modifiers or staff tab;
- paid scouting research tiers;
- secrets or `.env*` files.

If any appears, remove it from this PR and leave it for its dedicated follow-up plan.

- [ ] **Step 5: Push implementation branch and open a PR**

Use a branch such as `feature/school-economy-foundation`. PR body must list:

- schema v7 migration behavior;
- annual/tournament/event/facility ledger coverage;
- +300/+1000/+3000 yearly limits;
- migration 009 atomicity/replay guarantees;
- focused and full test evidence.

- [ ] **Step 6: Wait for exact-head CI GREEN before merge**

Required checks from `.github/workflows/ci.yml`:

- `dependency-audit` green;
- `quality` green (`npm run verify`);
- `mobile-e2e` green.

Do not merge on a stale earlier commit's checks.

- [ ] **Step 7: Merge code before applying migration 009 to production**

Deployment order is deliberate: old code does not know the three new item IDs, so applying migration first could make `/api/shop` reject newly returned rows. Merge/deploy the code that recognizes the new IDs first. Before database migration, the shop simply continues returning the existing seven DB items, which is safe.

- [ ] **Step 8: Verify production code deployment, then apply migration 009**

Confirm the production Worker serves the merged code revision. Then apply `202609060009_school_economy_foundation.sql` through the connected Supabase project.

Immediately verify with SQL:

```sql
select item_id, price_yen, annual_purchase_limit
from public.shop_item_definitions
where item_id in ('funds-grant-300', 'funds-grant-1000', 'funds-grant-3000')
order by sort_order;
```

Expected rows:

- `funds-grant-300`, `0`, `3`
- `funds-grant-1000`, `0`, `1`
- `funds-grant-3000`, `0`, `1`

Also verify current game saves have `schemaVersion = 7`, `schoolManagement` exists, and pre-migration funds are unchanged for a sampled user. Do not print any authentication secret during verification.

- [ ] **Step 9: Perform a production grant smoke test**

Using the user's normal UI, claim the +300 grant once and confirm all four observations:

1. the shop result says `資金 +300` and shows the new balance;
2. the grant does not appear under `所持品`;
3. the yearly remaining count decreases exactly once;
4. the school funds ledger has exactly one new `shop-grant` entry for that operation.

If the HTTP response is lost/retried, retrying the same operation ID must not grant another +300; verify operation replay before declaring production complete.

---

## Self-Review Result

### Spec coverage for this plan

Covered from the approved design:

- new game 700 start;
- v6 -> v7 compatibility without retroactive current-year budget;
- funds ledger and 50-entry cap;
- annual budgets by reputation plus deterministic alumni contribution;
- authoritative tournament rewards including national qualification/Best16 timing;
- existing event/facility fund changes entering the ledger;
- three ¥0 immediate shop grants with 3/1/1 annual limits;
- no grant inventory/use step;
- atomic shop revision/counter/state/ledger/operation replay;
- funds history UI;
- server authority and production-safe code-before-migration order.

Intentionally deferred to separate plans because they are independent subsystems in the approved design:

- facility Lv.50 effects/costs/milestones;
- assistant-coach contracting and training modifiers;
- paid scouting research tiers.

### Placeholder scan

No `TBD`, `TODO`, "implement later", generic "add error handling", or unspecified "write tests" steps remain. Each code-bearing task gives concrete signatures, values, assertions, and commands.

### Type consistency

- `SchoolManagementState`, `FundsLedgerEntry`, and assistant-coach persistence types are defined in Task 1 and reused unchanged later.
- `applySchoolFundsChange` returns `{ state, appliedAmount }`; event code uses `appliedAmount`, all other callers use `.state`.
- Shop grant IDs are exactly `funds-grant-300`, `funds-grant-1000`, `funds-grant-3000` across TS, SQL, UI, and tests.
- Purchase grant result is consistently `{ fundsGranted: number; balanceAfter: number }`.
- Database purchase RPC signature remains unchanged, preserving current Worker route/store contracts.
