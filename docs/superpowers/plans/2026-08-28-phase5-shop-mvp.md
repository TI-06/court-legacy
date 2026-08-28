# Court Legacy V2 Phase 5 Shop MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 5 server-authoritative ¥0 shop MVP with seven annual-limited items, safe inventory/use persistence, scouting/training integration, mobile UI, and regression coverage.

**Architecture:** Keep shop inventory/history/counters outside `GameState` and make Cloudflare Worker + Supabase RPC authoritative for purchase/use. Reuse existing game/scouting/training primitives, preserve `revision` and `operationId` safety, and only keep the pending next-training boost in `GameState` because it must participate in the next game action.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, Playwright, Cloudflare Worker, Supabase/PostgreSQL, Zod.

**Spec:** `docs/superpowers/specs/2026-08-28-phase5-shop-mvp-design.md`

## Global Constraints

- All seven Phase 5 items cost exactly `¥0`; no payment SDK or real checkout code is added.
- Browser code never decides price, annual limits, quantity, effect strength, hidden scouting truth, or authoritative resulting stats.
- Annual limits and inventory validity use authoritative `GameState.yearIndex`, not real calendar time.
- `shop_operations` is the canonical idempotency ledger for both purchase and use; `(user_id, operation_id)` is globally unique for shop mutations.
- Purchase/use must be atomic with all affected GameState, inventory, counters, histories, and scouting persistence.
- Exact candidate `potential`, `tier`, hidden traits, growth peak, injury resistance, candidate `Player`, and transient shop metadata never enter public/PvP DTOs.
- `training-efficiency-boost` is exactly `+20%` growth on the next successfully committed normal weekly training and is consumed exactly once.
- Existing five-tab navigation remains unchanged; Shop lives under `その他`.
- Required mobile widths remain green: 320px, 360px, 390px, 480px.
- Every asynchronous shop action exposes visible loading/success/error/unknown-result UI; no blank/full-app opaque wait state.
- Work remains on `feature/court-legacy-v2-phase5-shop-mvp`; do not merge stacked Phase 3/4/5 PRs without explicit authorization.

---

## File Structure

New focused modules:

- `src/domain/shop/shopCatalog.ts` — fixed seven-item catalog types/constants.
- `src/domain/shop/shopRules.ts` — annual-limit/current-year inventory evaluation.
- `src/domain/shop/shopEffects.ts` — pure fatigue recovery, special-coach profiles, training-camp profiles, and pending boost helpers.
- `src/domain/shop/shopContracts.ts` — browser-safe API DTOs and target discriminated unions.
- `worker/data/ShopStore.ts` — Worker persistence interface/error types.
- `worker/data/SupabaseShopStore.ts` — Supabase RPC/read implementation.
- `worker/shop/resolveShopUse.ts` — trusted item target validation/effect resolution.
- `worker/routes/shopStatus.ts`, `shopPurchase.ts`, `shopUse.ts` — authenticated Worker endpoints.
- `src/features/shop/ShopScreen.tsx`, `shop.css` — product/inventory UI.
- `supabase/migrations/202608280006_shop_mvp.sql` — tables, RLS, seed rows, atomic RPCs.

Existing files modified:

- `src/domain/model/GameState.ts`
- `src/persistence/gameStateCodec.ts`
- `src/domain/calendar/academicYearProgression.ts`
- `src/domain/training/calculateGrowth.ts`
- `src/domain/training/resolveWeeklyTraining.ts`
- `worker/game/applyGameAction.ts`
- `worker/data/ScoutingStore.ts`
- `worker/data/SupabaseScoutingStore.ts`
- `worker/scouting/serverScoutingBoard.ts`
- `worker/router.ts`
- `worker/index.ts`
- `src/services/api/GameApiClient.ts`
- `src/app/createBrowserAppDependencies.ts`
- `src/features/more/MoreScreen.tsx`
- `src/features/scouting/ScoutingScreen.tsx`
- `src/features/training/TrainingScreen.tsx`
- `src/app/GameApp.tsx`
- `tests/e2e/pvp-flow.spec.ts` and/or a new `tests/e2e/shop-flow.spec.ts`
- `README.md`

---

### Task 1: Fixed Catalog and Annual-Limit Domain Rules

**Files:**
- Create: `src/domain/shop/shopCatalog.ts`
- Create: `src/domain/shop/shopRules.ts`
- Create: `tests/unit/domain/shop/shopCatalog.test.ts`
- Create: `tests/unit/domain/shop/shopRules.test.ts`

**Interfaces:**
- Produces `ShopItemId`, `ShopTargetKind`, `ShopItemDefinition`, `PHASE5_SHOP_ITEMS`, `getShopItemDefinition(itemId)`.
- Produces `ShopYearCounters`, `ShopItemStatus`, `evaluateShopItemStatus(definition, counters, quantityOwned)`, `isCurrentYearInventory(input)`.

- [ ] **Step 1: Write catalog tests first**

```ts
import { describe, expect, it } from "vitest";
import { PHASE5_SHOP_ITEMS, getShopItemDefinition } from "../../../../src/domain/shop/shopCatalog";

describe("Phase 5 shop catalog", () => {
  it("contains exactly the seven approved ¥0 items with equal annual purchase/use limits", () => {
    expect(PHASE5_SHOP_ITEMS).toHaveLength(7);
    expect(PHASE5_SHOP_ITEMS.every((item) => item.priceYen === 0)).toBe(true);
    expect(PHASE5_SHOP_ITEMS.every((item) => item.annualPurchaseLimit === item.annualUseLimit)).toBe(true);
  });

  it("defines fatigue recovery with player target and 3/year limit", () => {
    expect(getShopItemDefinition("fatigue-recovery")).toMatchObject({
      targetKind: "player",
      annualPurchaseLimit: 3,
      annualUseLimit: 3,
      priceYen: 0,
    });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/unit/domain/shop/shopCatalog.test.ts`

Expected: FAIL because the Phase 5 catalog module/exports do not yet exist.

- [ ] **Step 3: Implement the minimal catalog**

```ts
export const SHOP_ITEM_IDS = [
  "extra-scout-candidate",
  "scout-research",
  "potential-appraisal",
  "training-camp",
  "fatigue-recovery",
  "special-coach",
  "training-efficiency-boost",
] as const;

export type ShopItemId = (typeof SHOP_ITEM_IDS)[number];
export type ShopTargetKind = "none" | "team" | "player" | "scouting-candidate" | "special-coach" | "next-training";

export interface ShopItemDefinition {
  itemId: ShopItemId;
  displayName: string;
  description: string;
  priceYen: 0;
  annualPurchaseLimit: number;
  annualUseLimit: number;
  targetKind: ShopTargetKind;
  sortOrder: number;
}
```

Populate the seven rows exactly from the spec and throw for an unknown id in `getShopItemDefinition`.

- [ ] **Step 4: Write annual-rule tests before rule implementation**

```ts
it("blocks purchase and use independently at their annual limits", () => {
  const definition = getShopItemDefinition("fatigue-recovery");
  expect(evaluateShopItemStatus(definition, { purchasedCount: 3, usedCount: 2 }, 1)).toMatchObject({
    canPurchase: false,
    canUse: true,
    purchaseBlockedReason: "purchase_limit_reached",
  });
});

it("treats prior-year inventory as inactive", () => {
  expect(isCurrentYearInventory({ inventoryYearIndex: 8, currentYearIndex: 9, quantityRemaining: 2 })).toBe(false);
});
```

- [ ] **Step 5: Run rule tests and confirm RED**

Run: `npm test -- tests/unit/domain/shop/shopRules.test.ts`

Expected: FAIL because rule helpers do not exist.

- [ ] **Step 6: Implement minimal rule helpers**

`evaluateShopItemStatus` must compare counters and quantity only; it must not know about database state or current time. `isCurrentYearInventory` returns true only when years match and quantity is positive.

- [ ] **Step 7: Run focused tests and full unit suite**

Run:
- `npm test -- tests/unit/domain/shop/shopCatalog.test.ts tests/unit/domain/shop/shopRules.test.ts`
- `npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/shop tests/unit/domain/shop
git commit -m "feat: add Phase 5 shop catalog rules"
```

---

### Task 2: GameState Pending Training Boost and Reused Training Primitives

**Files:**
- Create: `src/domain/shop/shopEffects.ts`
- Create: `tests/unit/domain/shop/shopEffects.test.ts`
- Modify: `src/domain/model/GameState.ts`
- Modify: `src/persistence/gameStateCodec.ts`
- Modify: `tests/unit/persistence/gameStateCodec.test.ts`
- Modify: `src/domain/training/calculateGrowth.ts`
- Modify: `src/domain/training/resolveWeeklyTraining.ts`
- Modify: `tests/unit/domain/training/resolveWeeklyTraining.test.ts`
- Modify: `src/domain/calendar/academicYearProgression.ts`
- Modify: corresponding academic-year tests
- Modify: `worker/game/applyGameAction.ts`

**Interfaces:**
- Produces `ShopGameEffects` with exact one-use `nextTrainingGrowthBoost`.
- `calculateGrowth(input)` accepts optional explicit additional growth modifier(s), including `{ code: "shop-training-boost", label: "練習効率アップ", percent: 120 }`.
- `resolveWeeklyTraining` applies and reports the modifier but does not independently persist it.
- `applyGameAction(training)` clears the pending boost only in the successful returned GameState.

- [ ] Write failing codec tests proving `shopEffects` round-trips while schema-v2 saves without it still decode.
- [ ] Run focused codec test and confirm RED.
- [ ] Add the optional `shopEffects` type/schema without changing inventory placement.
- [ ] Write failing training test proving a pending +20% boost increases growth, appears as `shop-training-boost`, and disappears from returned GameState after one successful normal training.
- [ ] Run focused training test and confirm RED.
- [ ] Refactor/extract growth modifier support with minimal changes to existing training math; the multiplier affects growth only.
- [ ] Write failing academic-year test proving an unused pending boost is removed on year transition.
- [ ] Implement transition cleanup and run focused tests.
- [ ] Run `npm test` and `npm run typecheck`.
- [ ] Commit: `feat: add one-use shop training boost`.

---

### Task 3: Deterministic Shop Training Effects and Scouting Precision

**Files:**
- Modify: `src/domain/shop/shopEffects.ts`
- Create: `tests/unit/domain/shop/shopTrainingEffects.test.ts`
- Modify: `src/domain/scouting/scoutReport.ts`
- Modify: `tests/unit/domain/scouting/scoutReport.test.ts`
- Modify: `worker/scouting/serverScoutingBoard.ts`
- Modify: `worker/data/ScoutingStore.ts`
- Modify: `worker/data/SupabaseScoutingStore.ts`
- Create: `tests/unit/worker/scouting/serverScoutingBoard.test.ts`

**Interfaces:**
- Produces pure `applyFatigueRecovery(player)` returning before/after public values plus updated player.
- Produces exact `SPECIAL_COACH_FOCUS_ABILITIES` and server-owned activity constants (`baseGrowth=8`, `fatigue=6`, `injuryRisk=4`, `trustGrowth=3`).
- Produces exact training-camp activity constants (`baseGrowth=3`, `fatigue=12`, `injuryRisk=5`, `trustGrowth=2`) and preferred-position ability map.
- `ScoutingStore` adds `listCandidateInsights(...)` and atomic persistence hooks required by Task 5.
- `buildServerScoutReports(state, pool, insights)` produces stable report ranges from candidate/cycle/precision state.
- Extract `generateServerScoutingCandidateAtIndex(state, index, excludedNames)` so the existing six use indexes 1..6 and item 7 appends index 7 without rerolling existing candidates.

- [ ] Write RED tests for fatigue clamp/no-op eligibility, special-coach mappings, and fixed camp profiles.
- [ ] Implement pure effect definitions/helpers; reuse existing training primitives rather than a new growth formula.
- [ ] Write RED scouting tests proving researched confidence is high, appraised potential half-width <=2, refreshes are stable, and no exact hidden fields appear.
- [ ] Implement precision-aware report generation with deterministic precision-state seed.
- [ ] Write RED candidate-index test proving existing six remain byte-equivalent and index 7 is deterministic.
- [ ] Extract candidate-at-index primitive and keep current board behavior green.
- [ ] Run scouting/training/shop tests and full `npm test`.
- [ ] Commit: `feat: add shop training and scouting effects`.

---

### Task 4: Supabase Shop Schema, RLS, Canonical Idempotency, and Store

**Files:**
- Create: `supabase/migrations/202608280006_shop_mvp.sql`
- Create: `worker/data/ShopStore.ts`
- Create: `worker/data/SupabaseShopStore.ts`
- Create: `tests/unit/worker/data/SupabaseShopStore.test.ts`
- Modify: migration/security source tests if present

**Interfaces:**
- `ShopStore.getStatus(userId, currentYearIndex)` returns authoritative item definitions + counters + current-year quantity.
- `ShopStore.purchase(input)` invokes a single purchase RPC.
- `ShopStore.use(input)` invokes a single use RPC/transaction boundary and maps stable error codes.
- Canonical `shop_operations(user_id, operation_id)` stores `operation_type`, fingerprint, public-safe response and rejects semantic reuse.

SQL creates/seeds:

- `shop_item_definitions`
- `shop_inventory`
- `shop_operations`
- `shop_transactions`
- `shop_item_uses`
- `shop_yearly_counters`
- `scouting_candidate_insights`
- atomic purchase/use RPC functions needed by Worker.

RLS requirements:

```sql
alter table ... enable row level security;
revoke all on ... from anon, authenticated;
revoke execute on function ... from public, anon, authenticated;
grant execute on function ... to service_role;
```

- [ ] Write store/RPC mapping tests first for replay, operation-id semantic reuse, revision conflict, limit errors, and response decoding.
- [ ] Confirm RED.
- [ ] Add migration tables/constraints/RLS/seed rows and store interface.
- [ ] Implement Supabase store wrappers with strict Zod decoding.
- [ ] Add source-level tests asserting browser roles cannot execute mutation RPCs and seven seed rows are ¥0.
- [ ] Run focused store/security tests and `npm run typecheck`.
- [ ] Commit: `feat: add server-authoritative shop persistence`.

---

### Task 5: Trusted Item-Use Resolver and Worker APIs

**Files:**
- Create: `src/domain/shop/shopContracts.ts`
- Create: `worker/shop/resolveShopUse.ts`
- Create: `worker/routes/shopStatus.ts`
- Create: `worker/routes/shopPurchase.ts`
- Create: `worker/routes/shopUse.ts`
- Modify: `worker/router.ts`
- Modify: `worker/index.ts`
- Create: `tests/unit/worker/routes/shopStatus.test.ts`
- Create: `tests/unit/worker/routes/shopPurchase.test.ts`
- Create: `tests/unit/worker/routes/shopUse.test.ts`
- Create: `tests/unit/worker/shop/resolveShopUse.test.ts`

**Interfaces:**
- Public requests exactly match spec: purchase `{ operationId, revision, itemId }`; use with discriminated safe target.
- `GET /api/shop`, `POST /api/shop/purchase`, `POST /api/shop/use`.
- Resolver owns target validation and all effect constants; browser never supplies effect values.

- [ ] Write RED contract/route tests for invalid target shapes and absent client-controlled effect fields.
- [ ] Implement strict Zod contracts and GET status route.
- [ ] Write RED purchase route tests for replay, 409 revision conflict, purchase-limit response.
- [ ] Implement purchase route using `ShopStore` only.
- [ ] Write RED use tests for each target class, inventory empty, annual limit, pending-boost duplicate, and public-safe results.
- [ ] Implement trusted resolver + use route, integrating GameStore/ScoutingStore as required without a second authoritative write path.
- [ ] Wire `ShopStore` lazily in Worker `index.ts` and routes in `router.ts`.
- [ ] Run focused Worker tests, `npm test`, `npm run typecheck`.
- [ ] Commit: `feat: expose Phase 5 shop APIs`.

---

### Task 6: Browser-Safe API Client and E2E Harness

**Files:**
- Modify: `src/services/api/GameApiClient.ts`
- Modify: `tests/unit/services/api/GameApiClient.test.ts`
- Modify: `src/app/createBrowserAppDependencies.ts`
- Modify: relevant browser-boundary tests

**Interfaces:**
- Add optional `getShop`, `purchaseShopItem`, `useShopItem` methods to `GameApiClient` and concrete HTTP implementation.
- E2E `StaticGameApiClient` keeps an in-memory current-year shop state with identical operation replay semantics sufficient for deterministic UI tests.

- [ ] Write RED client tests asserting exact method/path/body and `ApiError` mapping.
- [ ] Add public contract imports from `src/domain/shop/shopContracts.ts` only; do not import Worker ShopStore types into browser code.
- [ ] Write RED E2E harness unit tests for one-grant replay and annual limits.
- [ ] Implement deterministic harness shop state and safe shop methods.
- [ ] Extend browser source-boundary test to reject `worker/data/ShopStore`, `SupabaseShopStore`, and `worker/shop/*` imports.
- [ ] Run client/harness tests and full unit suite.
- [ ] Commit: `feat: add browser-safe shop client`.

---

### Task 7: Shop and Inventory UI Under More

**Files:**
- Create: `src/features/shop/ShopScreen.tsx`
- Create: `src/features/shop/shop.css`
- Create: `tests/unit/features/shop/ShopScreen.test.tsx`
- Modify: `src/features/more/MoreScreen.tsx`
- Modify: `tests/unit/features/more/MoreScreen.test.tsx`
- Modify: `src/app/GameApp.tsx`
- Modify: `tests/unit/app/GameApp.test.tsx` or existing app integration tests

**Interfaces:**
- `MoreView` becomes `"menu" | "school" | "shop"`.
- Shop screen has local `商品` / `所持品` views.
- Only the active operation button is disabled; global navigation remains usable.
- Unknown network result offers same-operation retry/status refresh; confirmed 409 offers latest-snapshot reload.

- [ ] Write RED MoreScreen test for visible Shop menu entry and callback.
- [ ] Implement menu navigation.
- [ ] Write RED ShopScreen tests for loading, seven product cards, ¥0, limits, owned quantity, inventory-only rows, blocked reasons, and visible result states.
- [ ] Implement ShopScreen/CSS mobile-first without portraits or horizontal scrolling.
- [ ] Write RED GameApp integration tests for load/purchase/use state transitions and latest snapshot adoption after revision changes.
- [ ] Implement GameApp handlers using `crypto.randomUUID()` and stable retry operation IDs for unknown results.
- [ ] Run feature/app tests and full unit suite.
- [ ] Commit: `feat: add Phase 5 shop interface`.

---

### Task 8: Target Selection, Scouting Card Actions, and Training Result UX

**Files:**
- Modify: `src/features/shop/ShopScreen.tsx`
- Modify: `src/features/scouting/ScoutingScreen.tsx`
- Modify: `src/features/training/TrainingScreen.tsx`
- Modify: `src/app/GameApp.tsx`
- Add/modify corresponding unit tests

**Interfaces:**
- Fatigue recovery selector sorts eligible players by fatigue descending.
- Special coach selects one non-injured player then one of six fixed focus values.
- `scout-research` and `potential-appraisal` are used directly on candidate cards when inventory allows.
- Training screen shows persistent `次回練習 成長効率 +20%` badge until one successful training consumes it.
- Results show before/after or summary metrics rather than generic success text only.

- [ ] Write RED UI tests for fatigue ordering, special-coach focus, scouting direct buttons, and pending training badge.
- [ ] Implement selectors/actions with explicit pending labels (`効果を反映中…`, `保存中…`).
- [ ] Write RED result tests for fatigue before/after, scouting old/new range/confidence, camp summary, coach ability changes, and boost consumption.
- [ ] Implement item-specific result panels.
- [ ] Run affected feature/app tests and `npm test`.
- [ ] Commit: `feat: connect shop items to game UI`.

---

### Task 9: Security, Atomicity, Concurrency, and PvP Leakage Regression

**Files:**
- Create/modify: `tests/unit/domain/pvp/*` snapshot-contract tests
- Create/modify: `tests/unit/worker/data/*Shop*.test.ts`
- Modify: source-boundary verification tests/scripts
- Modify: `worker/pvp/createPvpSnapshot.ts` only if a failing test exposes accidental transient-field serialization

**Interfaces:**
- Published PvP/public results never expose inventory, operation ledger, counters, scouting insights, or `shopEffects`.
- Permanent ability changes already committed to base player state remain legitimate PvP inputs.

- [ ] Write RED serialization/source tests that explicitly reject transient shop keys and server-only imports.
- [ ] Add/verify concurrent annual-limit tests showing two parallel purchase/use attempts cannot exceed the configured cap.
- [ ] Add rollback tests showing simulated failure leaves inventory, counters, GameState, scouting mutation, and histories unchanged.
- [ ] Make only minimal production changes required by the failing tests.
- [ ] Run all unit tests, `npm run lint`, `npm run typecheck`.
- [ ] Commit: `test: harden Phase 5 shop authority boundaries`.

---

### Task 10: Mobile E2E, Docs, Progress, Final Verification, Draft PR

**Files:**
- Create: `tests/e2e/shop-flow.spec.ts`
- Modify: existing mobile layout audit tests if Shop needs inclusion
- Modify: `README.md`
- Create: `docs/superpowers/implementation-progress/2026-08-28-phase5-shop-mvp.md`

**Required E2E scenarios:**

1. `その他 → ショップ → 疲労回復 ¥0購入 → visible pending → owned +1`.
2. `所持品 → 疲労回復 → player target → visible pending → fatigue decreases → owned -1`.
3. duplicate purchase operation grants once.
4. annual limit blocks next use without mutation.
5. stale revision conflict does not consume inventory and exposes reload action.
6. year transition invalidates prior-year inventory and fresh limits are visible.
7. research/appraisal tighten public scouting reports without hidden truth.
8. training boost shows pending, applies once, then disappears.
9. PvP flow remains green and public PvP DTOs contain no transient shop metadata.
10. 320/360/390/480px layout remains free of horizontal overflow.

- [ ] Write E2E tests and run the focused Shop spec until green.
- [ ] Run existing PvP/scouting mobile E2E and repair regressions without weakening assertions.
- [ ] Update README with migration order including `202608280006_shop_mvp.sql`, server-authority notes, and no-real-payment warning.
- [ ] Add progress file marking Task 1–10 status and exact verification counts.
- [ ] Run fresh `npm run verify`.
- [ ] Run fresh `npm run test:e2e`.
- [ ] Review final diff for hidden-data leakage, direct browser Supabase shop writes, duplicate effect-write paths, `operationId` reuse gaps, and server-only imports.
- [ ] Open/update a Draft PR from `feature/court-legacy-v2-phase5-shop-mvp` to `feature/court-legacy-v2-phase4-async-pvp` with exact final head, workflow run, test counts, migration, and remaining stacked-PR note.
- [ ] Leave the PR Draft/unmerged until explicit integration authorization.
