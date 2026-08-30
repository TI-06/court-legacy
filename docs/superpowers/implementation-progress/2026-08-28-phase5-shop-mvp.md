# Phase 5 Shop MVP Progress

- Branch: `feature/court-legacy-v2-phase5-shop-mvp`
- Base: `feature/court-legacy-v2-phase4-async-pvp`
- Spec: `docs/superpowers/specs/2026-08-28-phase5-shop-mvp-design.md`
- Plan: `docs/superpowers/plans/2026-08-28-phase5-shop-mvp.md`
- Migration: `supabase/migrations/202608280006_shop_mvp.sql`

## Status

- [x] Task 1: Fixed Catalog and Annual-Limit Domain Rules
- [x] Task 2: GameState Pending Training Boost and Reused Training Primitives
- [x] Task 3: Deterministic Shop Training Effects and Scouting Precision
- [x] Task 4: Supabase Shop Schema, RLS, Canonical Idempotency, and Store
- [x] Task 5: Trusted Item-Use Resolver and Worker APIs
- [x] Task 6: Browser-Safe API Client and E2E Harness
- [x] Task 7: Shop and Inventory UI Under More
- [x] Task 8: Target Selection, Scouting Card Actions, and Training Result UX
- [x] Task 9: Security, Atomicity, Concurrency, and PvP Leakage Regression
- [x] Task 10: Mobile E2E, Docs, Progress, Final Verification, Draft PR

## Phase 5 Result

Phase 5 adds a server-authoritative, zero-yen test shop under `その他` without changing the five primary navigation tabs. The seven approved items use annual purchase/use limits and safe target DTOs. Inventory, counters, operation history, prices, limits, effect constants, hidden scouting truth, and trusted mutation decisions remain outside browser authority.

The only transient shop effect stored in `GameState` is the one-use next-training growth boost because it must participate in the next committed training action. Ranked PvP simulation explicitly removes `shopEffects`, recruiting state, pending events, active matches, and relationship state before simulation. Permanent player changes already committed to the base player state remain valid PvP inputs.

Phase 5 does not implement real-money billing. Every current catalog item is fixed at `¥0`; no card, wallet, checkout provider, or payment SDK is connected.

## Security and Consistency Checks

- Browser shop calls go through Worker HTTP endpoints and public shop contracts; browser code does not import `ShopStore`, `SupabaseShopStore`, or `worker/shop/*` authority.
- `shop_operations(user_id, operation_id)` is the canonical shop idempotency ledger. Unknown network results retry the same request/operation ID rather than minting a new mutation.
- Purchase/use persistence is bounded by authoritative game revision, current `yearIndex`, annual counters, inventory, and server-owned target/effect validation.
- Shop mutation SQL/RPC boundaries use service-role access, RLS/revokes, row locking, atomic counters/inventory updates, and replay-safe operation responses.
- Other-school player targets and scouting candidates outside the authenticated user's active pool are rejected.
- Scouting appraisal/research public results expose precision/public report changes only and do not expose exact player truth, potential, hidden traits, growth peak, injury resistance, or appearance seed.
- Ranked PvP simulation removes transient `shopEffects`; regression tests verify `training-efficiency-boost` cannot leak into ranked state.
- Mobile Shop layout is explicitly audited at 320px, 360px, 390px, and 480px with no horizontal overflow.

## Verification Evidence

Verification before this progress snapshot:

- `npm run verify`: PASS in CI run `33239405205` (Formatting, Lint, Type check, V2 structure, production dependency audit, Unit tests, Production build).
- Raw unit suite count: `119` test files / `482` tests PASS in workflow run `33239525361`.
- `npm run test:e2e`: `25 / 25` PASS in CI run `33239362544`; the same code plus README documentation also passed Quality in `33239405205`.
- E2E coverage includes Shop purchase/use, visible pending states, retry with the same operation ID after an unknown result, stale revision recovery without inventory loss, annual limits, year rollover, scouting research/appraisal, one-shot training boost consumption, existing PvP flow, and 320/360/390/480px Shop overflow checks.
- `npm ci` continues to report `7 vulnerabilities (3 moderate / 4 high)` across all dependencies. The production-only `npm audit --omit=dev --audit-level=high` gate in `npm run verify` is PASS.

The final branch HEAD must receive one more fresh CI run after this progress file is committed. The Draft PR records that final HEAD and final workflow run. The branch remains unmerged until explicit integration authorization.
