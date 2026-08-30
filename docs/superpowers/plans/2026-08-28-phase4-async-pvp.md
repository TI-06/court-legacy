# Court Legacy V2 Phase 4 Async PvP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-authoritative asynchronous PvP where players publish a frozen team snapshot, challenge other published teams offline, and receive atomic Elo rating/results/rankings without exposing hidden game state.

**Architecture:** PvP is a separate Worker-owned subsystem. The browser receives only sanitized public summaries and match presentation data. Publishing creates append-only frozen PvP team snapshots; challenges build a temporary namespaced simulation state from the challenger authoritative save plus defender frozen snapshot, reuse the existing `simulateMatch()`, and persist match + both ratings atomically through a dedicated `PvPStore`/Supabase RPC.

**Tech Stack:** TypeScript, React, Vitest, Cloudflare Worker routes, Supabase/Postgres migrations/RPC, existing match simulator, Playwright mobile E2E.

**Spec:** `docs/superpowers/specs/2026-08-28-phase4-async-pvp-design.md`

## Global Constraints

- PvP is asynchronous; no WebSocket or simultaneous online requirement.
- Browser never sends or receives exact Player abilities, tier, potential, hidden traits, growth peak, injury resistance, exact tactics weights, or full opponent GameState.
- Browser challenge request contains only `operationId`, current challenger `revision`, and `opponentSnapshotId`.
- Worker owns snapshot creation, opponent lookup, simulation input, deterministic match seed, result, Elo delta, daily opponent limit, and persistence.
- Published defender snapshots are immutable/append-only; one user has one active snapshot pointer at a time, but historical snapshots remain valid for recorded matches.
- PvP simulation normalizes transient condition/fatigue/injury state according to the spec before simulation.
- Cross-user school/player IDs are remapped into a temporary PvP namespace before calling `simulateMatch()`.
- Current PvP season is derived from Worker time in JST `YYYY-MM`; browser cannot choose season.
- Initial seasonal rating is 1000, Elo K=32, no draws, rating floor 0.
- Match persistence and both users' rating updates must be one atomic database operation with row locking/serialization protection.
- Same challenger may play the same defender at most 3 rated matches per JST day.
- `operationId` is idempotent for publish/challenge; duplicate challenge returns the originally stored result without rating being applied twice.
- Existing five-tab bottom navigation remains; PvP lives inside the Match area.
- Every production change follows RED -> GREEN TDD.
- Final gate: `npm run verify` and mobile Playwright E2E must both pass.

---

## File Map

### Domain

- Create `src/domain/pvp/elo.ts` — pure Elo calculation.
- Create `src/domain/pvp/season.ts` — JST season/day keys.
- Create `src/domain/pvp/pvpContracts.ts` — browser-safe PvP DTOs only.
- Create `worker/pvp/buildPvpSimulationState.ts` — server-only frozen-team normalization + ID remap.
- Create `worker/pvp/simulatePvpMatch.ts` — deterministic adapter around existing `simulateMatch()`.

### Persistence / Worker

- Create `worker/data/PvPStore.ts` — storage boundary and atomic command types.
- Create `worker/data/SupabasePvPStore.ts` — Supabase implementation.
- Create `supabase/migrations/202608280004_async_pvp.sql` — append-only snapshots, ratings, matches, operation idempotency, RPCs, RLS/revokes.
- Create `worker/routes/pvpPublish.ts`.
- Create `worker/routes/pvpOpponents.ts`.
- Create `worker/routes/pvpChallenge.ts`.
- Create `worker/routes/pvpRanking.ts`.
- Create `worker/routes/pvpHistory.ts`.
- Modify `worker/router.ts` and `worker/index.ts` to inject/register PvP routes.

### Browser

- Modify `src/services/api/GameApiClient.ts` with browser-safe PvP methods.
- Create `src/features/pvp/PvpScreen.tsx` and focused child presentation helpers if needed.
- Modify existing match-screen flow to expose `通常試合 / 対人戦` without adding a sixth bottom tab.
- Modify `src/app/GameApp.tsx` to load/publish/challenge/adopt only safe PvP state; PvP does not mutate normal GameState except through the authoritative bootstrap/revision contract defined by the API.
- Update E2E static adapter using public DTO fixtures only; never import Worker PvP store/simulation modules into browser code.

### Tests

- Create `tests/unit/domain/pvp/elo.test.ts`.
- Create `tests/unit/domain/pvp/season.test.ts`.
- Create `tests/unit/worker/buildPvpSimulationState.test.ts`.
- Create `tests/unit/worker/pvpPublish.test.ts`.
- Create `tests/unit/worker/pvpChallenge.test.ts`.
- Create `tests/unit/worker/pvpQueries.test.ts`.
- Create `tests/unit/worker/pvpMigration.test.ts`.
- Create `tests/unit/services/GameApiClient.pvp.test.ts`.
- Create `tests/unit/features/pvp/PvpScreen.test.tsx`.
- Create `tests/unit/app/GameApp.pvp.test.tsx`.
- Extend existing Playwright mobile E2E with publish -> opponent list -> challenge -> result -> ranking/history flow.

---

### Task 1: Pure Elo and JST season/day keys

**Files:**

- Create: `src/domain/pvp/elo.ts`
- Create: `src/domain/pvp/season.ts`
- Test: `tests/unit/domain/pvp/elo.test.ts`
- Test: `tests/unit/domain/pvp/season.test.ts`

**Interfaces:**

- Produces `calculateEloUpdate({ challengerRating, defenderRating, challengerWon }): { challengerDelta, defenderDelta, challengerRating, defenderRating }`.
- Produces `pvpSeasonId(date: Date): string` and `pvpJstDayKey(date: Date): string`.

- [ ] **Step 1: Write failing Elo tests**
  - Equal 1000 vs 1000: winner gains 16, loser loses 16.
  - Upset has larger positive delta than favorite win.
  - Ratings never become negative.
  - Deltas are exactly zero-sum before floor handling.
- [ ] **Step 2: Run `npx vitest run tests/unit/domain/pvp/elo.test.ts` and verify RED because module/functions do not exist.**
- [ ] **Step 3: Implement minimal K=32 Elo function with expected-score formula and rating floor 0.**
- [ ] **Step 4: Write failing JST tests** for UTC instants straddling JST month/day boundaries.
- [ ] **Step 5: Run `npx vitest run tests/unit/domain/pvp/season.test.ts` and verify RED.**
- [ ] **Step 6: Implement season/day keys using `Intl.DateTimeFormat` with `Asia/Tokyo`.**
- [ ] **Step 7: Run both test files and then `npm run verify`.**
- [ ] **Step 8: Commit `feat: add PvP Elo and JST season keys`.**

### Task 2: Frozen PvP team snapshot model and namespaced simulation state

**Files:**

- Create: `worker/data/PvPStore.ts`
- Create: `worker/pvp/buildPvpSimulationState.ts`
- Test: `tests/unit/worker/buildPvpSimulationState.test.ts`

**Interfaces:**

- `PublishedPvpTeamSnapshot` contains only server-side frozen match inputs plus a `PvpOpponentSummary` public projection.
- `buildPvpSimulationState({ challenger, defender }): { state, challengerSchoolId, defenderSchoolId, challengerSelection, defenderSelection }`.

- [ ] **Step 1: Write RED tests** proving identical original school/player IDs on both users do not collide after remap.
- [ ] **Step 2: Add RED tests** proving selection, school player IDs, serving order, libero, and tactic player references are remapped consistently.
- [ ] **Step 3: Add RED tests** proving PvP normalization removes transient fatigue/condition/injury advantage according to the spec while preserving stable abilities/tactics needed for match simulation.
- [ ] **Step 4: Implement minimal server-only snapshot types and namespaced builder.**
- [ ] **Step 5: Run focused tests then `npm run verify`.**
- [ ] **Step 6: Commit `feat: add frozen PvP simulation snapshots`.**

### Task 3: Supabase PvP schema and atomic persistence boundary

**Files:**

- Create: `supabase/migrations/202608280004_async_pvp.sql`
- Create: `worker/data/SupabasePvPStore.ts`
- Test: `tests/unit/worker/pvpMigration.test.ts`
- Test: `tests/unit/worker/supabasePvPStore.test.ts`

**Interfaces:**

- `PvPStore.publishSnapshot(...)` appends a new snapshot and deactivates prior active snapshot atomically.
- `PvPStore.findChallengeOperation(userId, operationId)` returns an existing persisted response.
- `PvPStore.commitRatedMatch(command)` atomically inserts match and locks/updates both rating rows.
- Query methods return sanitized public DTOs/history/ranking only.

- [ ] **Step 1: Write migration RED tests** requiring append-only snapshots, one active snapshot/user, ratings PK `(season_id,user_id)`, matches unique `(challenger_user_id,operation_id)`, RLS/revokes, and service-role-only RPC execution.
- [ ] **Step 2: Write store RED tests** for publish, duplicate operation lookup, atomic match response mapping, opponent/ranking/history mapping.
- [ ] **Step 3: Implement migration tables/indexes/RPCs. `commit_pvp_rated_match` must lock both user rating rows in deterministic user-id order before updates.**
- [ ] **Step 4: Implement `SupabasePvPStore` decoding/validation; invalid DB payloads throw a dedicated data error.**
- [ ] **Step 5: Run focused migration/store tests then `npm run verify`.**
- [ ] **Step 6: Commit `feat: persist async PvP snapshots ratings and matches`.**

### Task 4: Publish and public query Worker APIs

**Files:**

- Create: `worker/routes/pvpPublish.ts`
- Create: `worker/routes/pvpOpponents.ts`
- Create: `worker/routes/pvpRanking.ts`
- Create: `worker/routes/pvpHistory.ts`
- Modify: `worker/router.ts`
- Modify: `worker/index.ts`
- Test: `tests/unit/worker/pvpPublish.test.ts`
- Test: `tests/unit/worker/pvpQueries.test.ts`

**Interfaces:**

- `POST /api/pvp/team/publish {operationId,revision}`.
- `GET /api/pvp/opponents?cursor=&limit=` max 30, self excluded.
- `GET /api/pvp/ranking?cursor=&limit=` current Worker-derived JST season.
- `GET /api/pvp/history?cursor=&limit=` current authenticated user only.

- [ ] **Step 1: RED publish tests** for strict request shape, stale revision 409, idempotent operation replay, immutable new snapshot creation, and sanitized response.
- [ ] **Step 2: RED query tests** for self exclusion, active snapshots only, max limit, current season, stable ordering/pagination, user-scoped history, and no hidden fields.
- [ ] **Step 3: Implement handlers and dependency injection minimally.**
- [ ] **Step 4: Run focused tests and router tests, then `npm run verify`.**
- [ ] **Step 5: Commit `feat: add PvP publish and query APIs`.**

### Task 5: Server-authoritative rated challenge

**Files:**

- Create: `worker/pvp/simulatePvpMatch.ts`
- Create: `worker/routes/pvpChallenge.ts`
- Modify: `worker/router.ts`
- Test: `tests/unit/worker/pvpChallenge.test.ts`

**Interfaces:**

- `POST /api/pvp/challenge { operationId, revision, opponentSnapshotId }`.
- Server response contains sanitized match/result/rating presentation only, never opponent frozen Player internals.

- [ ] **Step 1: Write RED happy-path test**: authoritative challenger save + active defender snapshot -> namespaced simulation -> atomic store command -> sanitized result.
- [ ] **Step 2: RED idempotency test**: same `operationId` returns stored response and never re-simulates/re-rates.
- [ ] **Step 3: RED validation tests**: stale revision, self match, missing/inactive snapshot, forged extra fields, daily 4th same-opponent challenge.
- [ ] **Step 4: RED concurrency/store-contract test** ensuring route performs no separate non-atomic rating writes.
- [ ] **Step 5: Implement deterministic match adapter using existing `simulateMatch()`, server-derived/persisted seed, Elo Task 1, and `commitRatedMatch`.**
- [ ] **Step 6: Run focused tests then `npm run verify`.**
- [ ] **Step 7: Commit `feat: add server-authoritative PvP challenges`.**

### Task 6: Browser-safe PvP API client

**Files:**

- Create: `src/domain/pvp/pvpContracts.ts`
- Modify: `src/services/api/GameApiClient.ts`
- Test: `tests/unit/services/GameApiClient.pvp.test.ts`

**Interfaces:**

- `publishPvpTeam(accessToken, request, signal?)`
- `getPvpOpponents(accessToken, query?, signal?)`
- `challengePvpTeam(accessToken, request, signal?)`
- `getPvpRanking(accessToken, query?, signal?)`
- `getPvpHistory(accessToken, query?, signal?)`

- [ ] **Step 1: Write RED HTTP contract tests** for all paths, auth header, query encoding, POST JSON, AbortSignal, and structured `ApiError` propagation.
- [ ] **Step 2: Implement browser-safe DTOs and client methods using existing shared request helper.**
- [ ] **Step 3: Add source-boundary regression test forbidding browser imports of `worker/data/PvPStore`, `SupabasePvPStore`, or `worker/pvp/*`.**
- [ ] **Step 4: Run focused tests then `npm run verify`.**
- [ ] **Step 5: Commit `feat: connect PvP browser API client`.**

### Task 7: Match-area PvP UI and GameApp flow

**Files:**

- Create: `src/features/pvp/PvpScreen.tsx`
- Modify: existing match hub/screen component used by `GameApp`.
- Modify: `src/app/GameApp.tsx`
- Modify: E2E `StaticGameApiClient` in `src/app/createBrowserAppDependencies.ts` using public fixtures only.
- Test: `tests/unit/features/pvp/PvpScreen.test.tsx`
- Test: `tests/unit/app/GameApp.pvp.test.tsx`

**Interfaces:**

- Match area exposes `通常試合` and `対人戦` modes while bottom nav remains five tabs.
- PvP screen sections: status/publish, opponents, result, ranking, history.

- [ ] **Step 1: RED presentation tests** for rating/record, publish status, opponent cards, loading, error/retry, challenge pending, match result, ranking/history, and no hidden labels/data.
- [ ] **Step 2: RED GameApp flow tests**: enter match -> PvP -> publish -> load opponents -> challenge -> result -> ranking/history refresh.
- [ ] **Step 3: RED conflict/error tests** for 409 stale revision/bootstrap recovery and daily-limit Japanese message.
- [ ] **Step 4: Implement mobile-first UI with immediate visible progress states; no blank screen while any request is pending.**
- [ ] **Step 5: Implement public-fixture E2E adapter; browser module must not import server-only PvP code or hidden opponent Player truth.**
- [ ] **Step 6: Run focused tests then `npm run verify`.**
- [ ] **Step 7: Commit `feat: add playable async PvP screen`.**

### Task 8: Mobile E2E, long-run rating safeguards, and documentation

**Files:**

- Extend: existing Playwright mobile spec(s).
- Create/extend: PvP long-run/domain tests if needed.
- Modify: `README.md` migration/feature documentation.
- Modify: PR description only after fresh final verification.

- [ ] **Step 1: Add 360px E2E**: Match -> PvP -> publish -> opponent list -> challenge -> visible pending -> result -> ranking/history -> revisit screen state.
- [ ] **Step 2: Keep existing 320/360/390/480px overflow/layout audit green.**
- [ ] **Step 3: Add deterministic Elo stress test** over many matches asserting non-negative ratings, wins+losses=matches, streak bounds, and no duplicate operation application.
- [ ] **Step 4: Update README with migration `202608280004_async_pvp.sql`, server authority, and deployment order.**
- [ ] **Step 5: Run fresh `npm run verify`. Expected: Formatting/Lint/Typecheck/structure/audit/all Unit/build PASS.**
- [ ] **Step 6: Run fresh `npm run test:e2e`. Expected: all Playwright tests PASS.**
- [ ] **Step 7: Review PR diff for hidden-data leakage, direct browser Supabase PvP access, duplicate rating paths, and server-only imports.**
- [ ] **Step 8: Update PR body with exact final head/run/test counts and leave unmerged unless explicitly authorized.**
