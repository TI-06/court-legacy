# Phase 16 Official/PvP Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase 16 by moving official tournament matches and asynchronous rated PvP challenges onto the resumable Match Command engine with authoritative, idempotent finalization and strict PvP privacy.

**Architecture:** Official matches reuse `GameState.activeMatch` and `/api/game/action`; the server rediscovers the due bracket match from authoritative tournament state, so save schema v8 stays unchanged. Rated PvP uses a separate server-private persisted session because defender snapshot/runtime data must never enter the public game snapshot; public responses expose only sanitized challenger-visible match data. The existing `commit_pvp_rated_match` RPC remains the sole final rating/history transaction.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, Testing Library, Playwright, Cloudflare Worker, Supabase/PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-10-phase16-match-command-design.md`

## Global Constraints

- Keep `CURRENT_GAME_SCHEMA_VERSION = 8`.
- Matches, tournament progression/rewards, and PvP ratings/history remain server authoritative.
- Never precompute rallies beyond an unresolved human coach decision.
- Match-only lineup/tactics never overwrite persistent `teamSelection` or `School.tactics`.
- PvP remains asynchronous; defender does not need to be online.
- Public PvP responses never expose defender abilities, hidden traits, raw runtime, private player IDs, serve-target IDs, selections, or automatic-coach inputs.
- Duplicate accepted commands and duplicate finalization requests are idempotent.
- Rejected commands do not mutate state or advance random cursor.
- No fatigue-management UI.
- Mobile acceptance widths: 320 / 360 / 390 / 414 / 480 px.
- Final PR and merged-main CI both require `dependency-audit`, `quality`, and `mobile-e2e` GREEN.

---

### Task 1: Resumable official tournament sessions

**Files:**
- Modify: `worker/game/applyGameAction.ts`
- Modify: `tests/unit/worker/officialMatchAction.test.ts`
- Create: `tests/unit/worker/phase16OfficialMatchSession.test.ts`
- Review: `src/domain/tournament/progressOfficialTournaments.ts`

**Interfaces:**
- Consumes: `startMatch`, `applyMatchCommand`, `resumeMatch`, `findDueUserOfficialMatch`, `recordOfficialTournamentOutcome`, `advanceOfficialTournamentsThroughWeek`.
- Produces: official `PendingMatchPresentation` with `MatchStepResult`, and `match-command` routing for either scheduled practice or the authoritative due official match.

- [ ] **Step 1: Write RED tests for official start boundaries.** Start a due official through `advance-week`; assert `analysis === null`, `activeMatch.phase === "coach-decision"`, controlled school is the user, bracket/history/career stats are unchanged, and global `randomCursor` is unchanged because the official fork seed is independent.
- [ ] **Step 2: Run `npx vitest run tests/unit/worker/phase16OfficialMatchSession.test.ts tests/unit/worker/officialMatchAction.test.ts`.** Expected RED: current official path one-shot simulates and finalizes immediately.
- [ ] **Step 3: Replace one-shot official start with `startMatch(...)`.** Use `matchId(due.match.id)`, the existing deterministic fork `match:${due.stage.tournamentId}:${due.match.id}`, `controlledSchoolId: state.userSchoolId`, and existing PvE dynamics readiness. Persist `activeMatch`; do not call tournament finalization while `analysis === null`.
- [ ] **Step 4: Route `match-command` by authoritative active-match context.** First recognize the scheduled-practice context; otherwise rediscover `findDueUserOfficialMatch(state)` and require active match ID/participants to match it. Never accept tournament/round/opponent identity from the client.
- [ ] **Step 5: On official command completion only, call `recordOfficialTournamentOutcome(...)` then `advanceOfficialTournamentsThroughWeek(...)`.** Incomplete commands only update `activeMatch`. Persistent lineup/tactics remain unchanged.
- [ ] **Step 6: Add reload/idempotency assertions.** Reloading an incomplete state restores the same score/decision/cursor; completion records bracket/history/career stats once; a later command rejects rather than duplicating finalization.
- [ ] **Step 7: Run focused GREEN:** `npx vitest run tests/unit/worker/phase16OfficialMatchSession.test.ts tests/unit/worker/officialMatchAction.test.ts tests/unit/worker/phase15MatchTacticsOverride.test.ts`.
- [ ] **Step 8: Commit:** `git commit -am "feat: make official matches resumable"` plus the new test file.

---

### Task 2: Server-private resumable PvP engine and deterministic defender coaching

**Files:**
- Modify: `worker/pvp/simulatePvpMatch.ts`
- Create: `worker/pvp/pvpMatchSession.ts`
- Create: `worker/pvp/automaticDefenderCoach.ts`
- Create: `tests/unit/worker/phase16PvpMatchSession.test.ts`
- Modify: `tests/unit/worker/buildPvpSimulationState.test.ts`
- Modify: `tests/unit/worker/phase15PvpMatchTactics.test.ts`
- Modify: `src/domain/match/simulateMatch.ts` only if a narrow internal automatic-opponent boundary hook is required.

**Interfaces:**
- Produces server-only `PvpServerMatchSession` plus sanitized `PvpMatchSegment`.

- [ ] **Step 1: RED-test challenger-controlled start/resume.** Fixed seed + frozen snapshots must stop at challenger coach decisions without future rallies persisted.
- [ ] **Step 2: RED-test privacy.** Serialized public segment must not contain `abilities`, `potential`, `hiddenTraitIds`, `runtime`, `homeSelection`, `awaySelection`, `actorPlayerId`, `targetPlayerId`, or `serveTargetPlayerId`.
- [ ] **Step 3: Implement `PvpServerMatchSession`.** Store operation/user/snapshot/revision/season/day/seed IDs, server-private simulation state, raw match, and finalized flag. None of the private body is route-output data.
- [ ] **Step 4: Implement a pure deterministic defender policy.** Set break => continue. A qualifying four-point run against defender may choose timeout only if unused and a deterministic leadership/tactic threshold says so; otherwise continue. It consumes no new randomness.
- [ ] **Step 5: If needed, add the smallest internal match-engine hook that observes automatic opponent boundaries without creating a second public human decision state.** Preserve all PR16-1 determinism tests.
- [ ] **Step 6: Implement `startPvpMatchSession(...)` and `resumePvpMatchSession(...)`.** Human commands always apply as challenger school; defender commands remain server-owned.
- [ ] **Step 7: Run focused GREEN:** `npx vitest run tests/unit/worker/phase16PvpMatchSession.test.ts tests/unit/worker/buildPvpSimulationState.test.ts tests/unit/worker/phase15PvpMatchTactics.test.ts tests/unit/domain/match/phase16ResumableMatch.test.ts tests/unit/domain/match/phase16MatchCommands.test.ts tests/unit/domain/match/phase16RandomCompatibility.test.ts`.
- [ ] **Step 8: Commit:** `git commit -am "feat: add resumable PvP match sessions"` plus new files.

---

### Task 3: Atomic PvP session persistence and command idempotency

**Files:**
- Create: `supabase/migrations/202609100001_phase16_pvp_match_sessions.sql`
- Modify: `worker/data/PvPStore.ts`
- Modify: `worker/data/SupabasePvPStore.ts`
- Create: `tests/unit/worker/phase16PvpSessionStore.test.ts`
- Modify: `tests/unit/worker/supabasePvPStore.test.ts`
- Modify: `tests/unit/worker/pvpMigration.test.ts`

**Interfaces:**
- Keeps the full raw match/session server-private.
- Adds create/load session, atomic command result persistence keyed by `commandId`, and final-response persistence.

- [ ] **Step 1: RED-test a private `pvp_match_sessions` store keyed by `(challenger_user_id, operation_id)` and command receipt uniqueness keyed by `(challenger_user_id, operation_id, command_id)`.
- [ ] **Step 2: Add `PvPStore` contracts for create/load session, save-or-replay command result with expected cursor, and store/read final response.
- [ ] **Step 3: Implement Supabase table/RPC persistence.** Same `commandId` replays its stored public response; a stale different command conflicts. Avoid read-then-write races.
- [ ] **Step 4: Leave `commit_pvp_rated_match` as the final atomic rating/history authority.** Do not duplicate rating writes in session persistence.
- [ ] **Step 5: Test duplicate start, duplicate command, stale command, duplicate finalization, and that public list/history queries never select private session JSON.
- [ ] **Step 6: Run focused GREEN:** `npx vitest run tests/unit/worker/phase16PvpSessionStore.test.ts tests/unit/worker/supabasePvPStore.test.ts tests/unit/worker/pvpMigration.test.ts tests/unit/worker/pvpChallenge.test.ts`.
- [ ] **Step 7: Commit:** `git commit -am "feat: persist authoritative PvP match sessions"` plus migration/new test.

---

### Task 4: PvP start/status/command routes and strict public contracts

**Files:**
- Modify: `src/domain/pvp/pvpContracts.ts`
- Modify: `worker/routes/pvpChallenge.ts`
- Create: `worker/routes/pvpChallengeCommand.ts`
- Create: `worker/routes/pvpChallengeSession.ts`
- Modify: `worker/router.ts`
- Modify: `tests/unit/worker/pvpChallenge.test.ts`
- Create: `tests/unit/worker/phase16PvpChallengeRoutes.test.ts`
- Modify: `tests/unit/worker/router.test.ts`

**Interfaces:**
- `POST /api/pvp/challenge`: create or replay a challenge session.
- `GET /api/pvp/challenge/session?operationId=<id>`: reload current sanitized segment or canonical final response.
- `POST /api/pvp/challenge/command`: `{ operationId, commandId, command }`.
- Responses are discriminated as `status: "in-progress" | "complete"`.

- [ ] **Step 1: RED-test the three route contracts and forged-field rejection.
- [ ] **Step 2: Change new challenge start from one-shot finalization to first persisted resumable segment.** Existing completed `pvp_operations` still replays the canonical old/final response.
- [ ] **Step 3: Implement command route.** Authenticate owner, load private session, validate strict `MatchCommand`, apply as challenger only, atomically save/replay `commandId`, and on completion call existing `commitRatedMatch` exactly once.
- [ ] **Step 4: Implement status route.** Return only sanitized current segment/final response; unknown operation => 404.
- [ ] **Step 5: Test frozen defender semantics.** Once a challenge session starts, later defender republish/deactivation cannot swap the opponent snapshot mid-match.
- [ ] **Step 6: Re-run privacy suites:** `npx vitest run tests/unit/worker/pvpChallenge.test.ts tests/unit/worker/phase16PvpChallengeRoutes.test.ts tests/unit/worker/router.test.ts tests/unit/worker/pvpDynamicsLeakage.test.ts tests/unit/worker/pvpTournamentLeakage.test.ts tests/unit/worker/phase15PvpPublicTactics.test.ts`.
- [ ] **Step 7: Commit:** `git commit -am "feat: add interactive PvP challenge routes"` plus new route/tests.

---

### Task 5: Official and PvP MatchScreen client integration

**Files:**
- Modify: concrete API client/type file that currently implements `challengePvpTeam`
- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/pvp/PvpScreen.tsx` only for pending/recovery presentation
- Reuse: `src/features/match/MatchScreen.tsx`
- Reuse: `src/features/match/MatchCommandPanel.tsx`
- Create: `tests/unit/app/Phase16OfficialMatchCommand.test.tsx`
- Create: `tests/unit/app/Phase16PvpMatchCommand.test.tsx`

**Interfaces:**
- Existing `/api/game/action` command handler supports official presentation as well as practice.
- PvP API adds start/status/command methods returning sanitized public segments.

- [ ] **Step 1: RED-test official GameApp flow:** advance-week -> official decision segment -> command -> next authoritative segment -> completed result -> only then next week progression.
- [ ] **Step 2: RED-test PvP GameApp flow:** opponent -> pre-match -> challenge start -> MatchScreen -> command round trip -> final rating result -> PvP hub.
- [ ] **Step 3: Update `issueMatchCommand` to accept both practice and official `PendingMatchPresentation` kinds.
- [ ] **Step 4: Add strict PvP API parsers and methods for start/status/command.** Do not use unsafe raw session casting.
- [ ] **Step 5: Reuse MatchScreen for PvP with a public presentation adapter.** Browser receives own-player data needed for substitution plus public score/events/opponent summaries only; it never receives defender raw selection/runtime/private player IDs.
- [ ] **Step 6: Implement retry recovery.** Reuse the same `commandId` until a canonical response is received; after network ambiguity call status endpoint before generating a new command.
- [ ] **Step 7: Run focused GREEN:** `npx vitest run tests/unit/app/Phase16OfficialMatchCommand.test.tsx tests/unit/app/Phase16PvpMatchCommand.test.tsx tests/unit/app/Phase16GameAppMatchCommand.test.tsx tests/unit/features/match/Phase16MatchCommandUx.test.tsx tests/unit/features/match/Phase16MatchScreenPlayback.test.tsx`.
- [ ] **Step 8: Commit:** `git commit -am "feat: connect official and PvP match commands"` plus new tests.

---

### Task 6: Five-width E2E, final privacy review, and Phase 16 completion

**Files:**
- Create or modify: `tests/e2e/phase16-official-pvp.spec.ts`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts` only if new state coverage is required
- Modify: `docs/PROJECT_CONTEXT.md`
- Modify: this plan to mark completed steps

**Interfaces:**
- Final acceptance across official/PvP UI, server persistence, privacy, and CI.

- [ ] **Step 1: Add official E2E at 320/360/390/414/480.** Verify pre-match, bounded playback, decision, command, final result, bracket progression after completion, and no horizontal overflow.
- [ ] **Step 2: Add PvP E2E at all five widths using deterministic test fixtures.** Verify start, decision, command, status recovery, final rated result, and no overflow. Do not weaken production trigger rules for E2E.
- [ ] **Step 3: Run privacy/migration regression:** `npx vitest run tests/unit/worker/pvpChallenge.test.ts tests/unit/worker/pvpDynamicsLeakage.test.ts tests/unit/worker/pvpTournamentLeakage.test.ts tests/unit/worker/pvpMigration.test.ts tests/unit/worker/supabasePvPStore.test.ts`.
- [ ] **Step 4: Run `npm run verify` and `npm run test:e2e`; require zero failures.
- [ ] **Step 5: Update `docs/PROJECT_CONTEXT.md`.** Record Phase16 complete through PR16-3, save schema v8 unchanged, official/PvP authoritative resumable flow, deterministic defender coaching, idempotent PvP commands/final rating commit, privacy boundary, and Phase17 as next.
- [ ] **Step 6: Final diff review.** No temporary workflows/debug files; no schema bump; no raw PvP session/runtime public output; no defender private fields; final rating/history still commits only through `commit_pvp_rated_match`; official bracket/history only finalize after match complete.
- [ ] **Step 7: Require exact-tree PR CI GREEN for `dependency-audit`, `quality`, `mobile-e2e`.
- [ ] **Step 8: Mark ready, merge with expected current head SHA, then verify the exact merged-main push CI is GREEN before declaring Phase16 complete.
