# Phase 15 Tactics Foundation Implementation Plan

> **For implementation:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, with superpowers:test-driven-development for every behavior change.

**Goal:** Add the authoritative, simulation, normal-match, and PvP foundation for Phase 15 team tactics while keeping save schema v8 and leaving the major tactics UI to PR15-2.

**Architecture:** Keep `School.tactics` as the only persisted tactics source. Add a categorical `MatchTacticPlan` projection plus pure conversion/matchup helpers. Normal tactics change only through the authoritative `set-team-tactics` game action. Match-only overrides are validated at request boundaries, cloned onto isolated simulation state, and never persisted. PvP defender tactics remain frozen in the existing published `School` snapshot; only categorical summary data is public.

**Tech Stack:** TypeScript 5.9, Zod, Vitest 4, seeded match simulation, Cloudflare Worker routes/store, GitHub Actions CI.

---

## Task 1: Categorical tactics domain model and compatibility mapping

**Files:**

- Create: `src/domain/team/matchTactics.ts`
- Create: `tests/unit/domain/team/matchTactics.test.ts`
- Reference: `src/domain/model/School.ts`

**RED first:** exact serve thresholds, attack/block mapping, canonical 25/50/75 serve values, all three 100-point attack distributions, preservation of `serveTargetPlayerId`/`defenseBias`, the complete 3×3 attack-vs-block matrix, and public matchup summary.

**GREEN:** implement `ServePlan`, `AttackPlan`, `BlockPlan`, `MatchTacticPlan`, `PublicTacticSummary`, `deriveMatchTacticPlan`, `applyMatchTacticPlan`, runtime guards, matrix lookup, and `TacticMatchupSummary`.

## Task 2: Authoritative normal-tactics action

**Status:** RED verified; GREEN implementation committed. Full CI verification pending a user-authored trigger because the bot formatting commit requires Actions approval.

**Files:**

- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Add/modify existing worker game-action tests.

**RED first:** valid `set-team-tactics` parses; invalid enums reject; action changes only user-school tactics; compatibility fields, other schools, and team selection stay unchanged; missing user school conflicts safely.

**GREEN:** add strict Zod plan schema, extend `GameAction`, add `applyTeamTactics`, and route it through the action switch. No new persisted plan field and no schema bump.

## Task 3: Match simulation tactical trade-offs

**Files:**

- Modify: `src/domain/match/simulateMatch.ts`
- Modify: `tests/unit/domain/match/simulateMatch.test.ts`

**RED first:** seeded aggregate tests for quick/read vs quick/commit, side/commit vs side/read, removal of unconditional `read > mixed > commit`, removal of defense-bias flat bonus, safe serve lower error/pressure, aggressive serve higher error/upside, and no source-state mutation.

**GREEN:** replace flat `blockSystemBonus` with matchup-dependent adjustment; remove `defenseBiasBonus`; apply the serve profile exactly once within existing clamps. Keep player/coach/condition/lineup/random effects primary.

**BALANCE GUARD:** favorable tactics must be visible but must not routinely exceed the approved approximate 60/40 equal-strength bound purely from tactics.

## Task 4: Normal match-only tactics override

**Files:**

- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify request/client typing only as needed for compilation; no major UI.
- Add/modify focused action/integration tests.

**RED first:** optional `matchTactics` is independent of `matchSelection`; override affects only the simulation user side; returned persistent `School.tactics` remains baseline; omission keeps existing behavior.

**GREEN:** validate optional `matchTactics`; clone/apply it to simulation input at the existing server-owned practice/official match boundary; never persist it.

## Task 5: PvP challenger override and public tactic summary

**Files:**

- Modify: `src/domain/pvp/pvpContracts.ts`
- Modify: `worker/data/PvPStore.ts`
- Modify: `worker/routes/pvpPublish.ts`
- Modify: `worker/routes/pvpOpponents.ts`
- Modify: `worker/routes/pvpChallenge.ts`
- Modify: `worker/pvp/buildPvpSimulationState.ts`
- Modify if needed: `worker/pvp/simulatePvpMatch.ts`
- Add/modify corresponding PvP tests.

**RED first:** publish derives categorical summary; defender snapshot keeps publication-time full tactics; later live edits do not mutate snapshot; public contracts contain only serve/attack/block categories; challenge accepts optional `matchTactics`; override touches only isolated challenger school; defender uses snapshot tactics; missing old summary is non-fatal and not guessed.

**GREEN:** add backward-compatible optional public summary fields, derive at publication/list boundaries, validate challenge override, and apply override only after isolated PvP state construction.

## Task 6: Regression, privacy, and exact-head verification

Verify focused tests after every RED/GREEN cycle, then `npm run verify`, then exact-head PR CI requiring `dependency-audit`, `quality`, and `mobile-e2e` green.

Review invariants:

- schema remains v8;
- no second persisted tactic source;
- no globally strongest block/defense option;
- serve profile not double-counted;
- match-only override never persists;
- PvP defender tactics frozen at publication;
- no public player target IDs or hidden abilities;
- Phase14 lineup/saved-lineup behavior untouched;
- no temporary workflow/debug artifacts.

After independent diff review and exact-head CI green, merge PR15-1 with expected head SHA and require all three main push CI jobs green before PR15-2.
