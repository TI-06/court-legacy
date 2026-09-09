# Phase 14 Player Hub Foundation — Implementation Plan

> Execute with TDD. Keep PR14-1 limited to persistence/domain/action foundations; do not add Player Hub or saved-lineup UI in this PR.

## Goal

Persist real player growth history and coach planning state, migrate v7 saves safely to schema v8, and expose authoritative actions for development priorities and saved lineup presets.

## Baseline

- Base main SHA: `9faf7eeaa629255bf7a757a23c1b112d7ad32d86`
- Feature branch: `feat/phase14-player-hub-foundation`
- Current schema version before this work: 7
- Existing authoritative training integration: `worker/game/applyGameAction.ts::applyTraining`
- Existing team-selection validator: `src/domain/team/validateTeamSelection.ts`

## Task 1 — Add RED persistence tests for schema v8

**Modify:** `tests/unit/persistence/gameStateCodec.test.ts`

Add tests that assert:

1. a v7 save migrates to v8;
2. migration adds `history.playerDevelopmentWeeks = []`;
3. migration adds empty `teamPlanning`;
4. roundtrip preserves valid development history and saved lineup data;
5. malformed planning/history payloads are rejected.

Run focused test and confirm RED because schema v8 fields do not exist yet.

## Task 2 — Add RED domain tests for growth-history retention

**Create:** `tests/unit/domain/player/playerDevelopmentHistory.test.ts`

Test a pure helper contract:

- builds a persisted week from real `TrainingResult.playerLogs`;
- clones ability changes;
- duplicate week append is idempotent;
- 53rd append drops only the oldest record;
- final order stays chronological/insertion order.

Run focused test and confirm RED because helper/module does not exist yet.

## Task 3 — Add RED domain tests for team planning

**Create:** `tests/unit/domain/team/teamPlanning.test.ts`

Test pure state helpers:

- default state is empty;
- valid 1–3 development-priority roster IDs accepted;
- duplicates rejected;
- >3 rejected;
- non-roster IDs rejected;
- valid preset saved to slots 1–3;
- occupied slot is replaced;
- names are trimmed and constrained;
- invalid team selection rejected;
- deletion is idempotent;
- saved selection is deep-cloned.

Run focused test and confirm RED.

## Task 4 — Add RED authoritative action tests

**Modify:** `tests/unit/worker/applyGameAction.test.ts`

Add tests:

- direct `training` records one development week matching returned `TrainingResult`;
- automatic `advance-week` training records one development week using the pre-advance date/week;
- `set-development-priorities` updates planning without changing `teamSelection`;
- invalid priorities throw `GameRuleConflictError`;
- `save-lineup-preset` stores a valid selection without changing regular `teamSelection`;
- invalid saved selection throws;
- `delete-lineup-preset` removes only the requested slot.

Run focused test and confirm RED.

## Task 5 — Add RED request-contract tests

**Modify:** `tests/unit/worker/gameAction.test.ts`

Add route-level validation tests for:

- max three priority IDs;
- valid preset save request;
- invalid slot/name or extra client-computed fields rejected before mutation.

Run focused test and confirm RED.

## Task 6 — Implement schema/model types

**Modify:** `src/domain/model/GameState.ts`

- set `CURRENT_GAME_SCHEMA_VERSION = 8`;
- add `PlayerDevelopmentWeek` / per-player entry types to `GameHistory`;
- initialize `playerDevelopmentWeeks` in `createEmptyGameHistory()`;
- add required `teamPlanning: TeamPlanningState` to `GameState`.

**Create:** `src/domain/team/teamPlanningTypes.ts`

- `SavedLineupSlot`;
- `SavedLineupPreset`;
- `TeamPlanningState`.

## Task 7 — Implement pure growth-history domain helper

**Create:** `src/domain/player/playerDevelopmentHistory.ts`

Implement:

- `MAX_PLAYER_DEVELOPMENT_WEEKS = 52`;
- builder from pre-training state + `TrainingResult`;
- append helper with `(year, week, date)` idempotency;
- immutable copies and 52-entry retention.

Run Task 2 tests GREEN.

## Task 8 — Implement pure team-planning domain helpers

**Create:** `src/domain/team/teamPlanning.ts`

Implement:

- `createDefaultTeamPlanning()`;
- `setDevelopmentPriorities(...)`;
- `saveLineupPreset(...)`;
- `deleteLineupPreset(...)`;
- validation error type/codes as needed.

Reuse `validateTeamSelection`; validate IDs against the user's school roster; deep clone saved selections.

Run Task 3 tests GREEN.

## Task 9 — Initialize new games and migrate saves

**Modify:** `src/domain/generation/generateWorld.ts`

- initialize `teamPlanning` using `createDefaultTeamPlanning()`.

**Modify:** `src/persistence/gameStateCodec.ts`

- add strict Zod schemas for development weeks and team planning;
- add `migrateVersionSeven()`;
- ensure v6 migration first builds v7 school-management state, then flows through v7 → v8;
- ensure all earlier migrations eventually reach v8.

Run Task 1 tests GREEN plus all persistence tests.

## Task 10 — Add authoritative action schemas

**Modify:** `worker/game/actionSchema.ts`

Add strict actions:

- `set-development-priorities` with `playerIds` max 3;
- `save-lineup-preset` with slot 1|2|3, trimmed name min1 max24, and existing team-selection schema;
- `delete-lineup-preset` with slot 1|2|3.

Update `GameAction` union.

Run Task 5 focused tests; schema-level cases should turn GREEN after this task.

## Task 11 — Integrate authoritative mutations and growth recording

**Modify:** `worker/game/applyGameAction.ts`

- in `applyTraining`, build and append player-development history after successful training resolution and before weekly completion is returned;
- preserve the pre-training date/year/week when building the entry;
- implement authoritative priority action using team-planning helper;
- implement save/delete preset actions;
- map domain validation failures to `GameRuleConflictError` stable codes;
- do not modify returned persistent `teamSelection` for planning actions.

Run Task 4 tests GREEN.

## Task 12 — Update durable project context

**Modify:** `docs/PROJECT_CONTEXT.md`

Record that Phase14 PR14-1 foundation now includes:

- schema v8;
- 52-week real development history;
- development priorities;
- saved lineup persistence/actions;
- PR14-2 remains the next UI phase.

Do not state CI/merge completion until verified.

## Task 13 — Full verification

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run verify
```

Then push/open Draft PR and require:

- dependency-audit GREEN;
- quality GREEN;
- mobile-e2e GREEN.

Inspect changed filenames and critical diffs for accidental files, secrets, generated artifacts or UI scope creep.

Mark ready, merge with expected head SHA, then verify the `main` push workflow for the merge SHA has all three required jobs GREEN.

## Scope guard

Do not implement in PR14-1:

- roster filters or sorting UI;
- growth charts;
- Player Hub card redesign;
- priority toggle UI;
- saved-lineup management UI;
- pre-match saved-lineup picker;
- tactics or match-command changes;
- hidden growth bonuses for priority players.
