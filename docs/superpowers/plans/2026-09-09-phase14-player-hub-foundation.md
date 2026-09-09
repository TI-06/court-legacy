# Phase 14 Player Hub Foundation Implementation Plan

> **Execution:** Use TDD and keep PR14-1 limited to persistence, domain, and authoritative-action foundations. Player Hub UI belongs to PR14-2 and saved-lineup UI belongs to PR14-3.

**Goal:** Persist real player growth history and coach planning state, migrate v7 saves safely to schema v8, and expose authoritative actions for development priorities and saved lineup presets.

**Architecture:** Extend `GameState` with bounded development history and `teamPlanning`, record real growth only from authoritative `TrainingResult.playerLogs`, reuse the existing team-selection validator for saved presets, and keep the existing separate persistent `teamSelection` unchanged by planning actions.

**Tech Stack:** TypeScript 5.9, Vitest 4, Zod, Cloudflare Worker, existing game-state codec and authoritative Worker action flow.

**Spec:** `docs/superpowers/specs/2026-09-09-phase14-player-hub-2-design.md`

## Baseline

- Base main SHA: `9faf7eeaa629255bf7a757a23c1b112d7ad32d86`
- Branch: `feat/phase14-player-hub-foundation`
- Current schema before this work: v7
- Training integration point: `worker/game/applyGameAction.ts::applyTraining`
- Existing selection validator: `src/domain/team/validateTeamSelection.ts`

## Task 1 — RED persistence tests

**Files:** create `tests/unit/persistence/phase14GameStateMigration.test.ts`.

- [x] Assert v7 saves migrate to v8.
- [x] Assert migration adds empty `history.playerDevelopmentWeeks`.
- [x] Assert migration adds empty `teamPlanning`.
- [x] Assert v6 school-management migration still survives the additional v8 step.
- [ ] Confirm the focused expectations fail before implementation.

## Task 2 — RED development-history tests

**Files:** create `tests/unit/domain/player/playerDevelopmentHistory.test.ts`.

- [x] Define the builder contract from authoritative training logs.
- [x] Require cloned ability deltas.
- [x] Require duplicate-week idempotency.
- [x] Require 52-week retention.
- [ ] Confirm RED before implementation.

## Task 3 — RED team-planning tests

**Files:** create `tests/unit/domain/team/teamPlanning.test.ts`.

- [x] Require an empty default planning state.
- [x] Require 0–3 unique user-roster priority IDs.
- [x] Require rejection of duplicates, excessive IDs, and non-roster IDs.
- [x] Require trimmed saved-lineup names, slot replacement, deletion, and deep cloning.
- [x] Require existing team-selection validation for saved presets.
- [ ] Confirm RED before implementation.

## Task 4 — RED authoritative integration tests

**Files:** create `tests/unit/worker/phase14PlayerHubFoundation.test.ts`.

- [x] Require direct training to record one real development week.
- [x] Require automatic advance-week training to record one pre-advance week.
- [x] Require priority changes without persistent lineup mutation.
- [x] Require saved-preset save/delete without persistent lineup mutation.
- [x] Require request-schema support and malformed-payload rejection.
- [ ] Confirm RED before implementation.

## Task 5 — Model and schema types

**Files:** modify `src/domain/model/GameState.ts`; create `src/domain/team/teamPlanningTypes.ts`.

- [ ] Set `CURRENT_GAME_SCHEMA_VERSION` to 8.
- [ ] Add development-week types and `playerDevelopmentWeeks` to `GameHistory`.
- [ ] Add required `teamPlanning` to `GameState`.
- [ ] Define saved-lineup slot, preset, and team-planning types.

## Task 6 — Development-history domain helper

**Files:** create `src/domain/player/playerDevelopmentHistory.ts`.

- [ ] Add `MAX_PLAYER_DEVELOPMENT_WEEKS = 52`.
- [ ] Build a persisted week from pre-training state and `TrainingResult`.
- [ ] Copy ability-change objects.
- [ ] Make duplicate week appends idempotent.
- [ ] Retain only the newest 52 entries.

## Task 7 — Team-planning domain helper

**Files:** create `src/domain/team/teamPlanning.ts`.

- [ ] Add `createDefaultTeamPlanning()`.
- [ ] Add development-priority validation and immutable update.
- [ ] Add saved-preset save/replace/delete helpers.
- [ ] Reuse `validateTeamSelection` for preset validity.
- [ ] Deep-clone saved selections.

## Task 8 — New-game initialization and migration

**Files:** modify `src/domain/generation/generateWorld.ts`; modify `src/persistence/gameStateCodec.ts`.

- [ ] Initialize empty `teamPlanning` for new games.
- [ ] Add strict Zod schemas for development history and team planning.
- [ ] Add explicit v7 → v8 migration.
- [ ] Preserve the v6 → v7 school-management step before v8 initialization.
- [ ] Ensure all older supported migrations end at v8.

## Task 9 — Authoritative request schema

**Files:** modify `worker/game/actionSchema.ts`.

- [ ] Add `set-development-priorities` with max three IDs.
- [ ] Add `save-lineup-preset` with slot 1–3, trimmed name max 24, and existing selection schema.
- [ ] Add `delete-lineup-preset` with slot 1–3.
- [ ] Update the `GameAction` union.

## Task 10 — Authoritative mutations and growth recording

**Files:** modify `worker/game/applyGameAction.ts`.

- [ ] Append development history after successful training resolution.
- [ ] Use the pre-training date, academic year, and week.
- [ ] Route priority and saved-preset actions through domain helpers.
- [ ] Map planning validation failures to stable `GameRuleConflictError` codes.
- [ ] Keep the returned persistent `teamSelection` unchanged for planning actions.

## Task 11 — Durable handoff context

**Files:** modify `docs/PROJECT_CONTEXT.md`.

- [ ] Record schema v8 and the PR14-1 foundation once implemented.
- [ ] Keep PR14-2 as the next unfinished Player Hub UI phase.
- [ ] Do not claim merge or CI completion until fresh evidence exists.

## Task 12 — Verification and merge

- [ ] Run `npm run format:check`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run verify`.
- [ ] Require PR `dependency-audit`, `quality`, and `mobile-e2e` GREEN.
- [ ] Inspect changed filenames and critical diffs.
- [ ] Mark PR ready and merge with expected head SHA.
- [ ] Require post-merge main `dependency-audit`, `quality`, and `mobile-e2e` GREEN.

## Scope guard

PR14-1 must not add roster filters, sorting UI, growth charts, Player Hub card redesign, priority controls, saved-lineup management UI, pre-match saved-lineup loading, tactics, match-command changes, or hidden growth bonuses for priority players.
