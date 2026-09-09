# Phase 14 — Player Hub 2.0 Design

## Status

Approved product direction. Phase 14 is split into three focused pull requests. This document is the durable design contract for all three; PR14-1 implements only the persistence/domain/action foundation.

## Goal

Make the player-management loop feel like a coaching game rather than a static roster viewer:

1. identify players worth developing;
2. choose explicit development priorities;
3. see real growth over time;
4. compare and sort the roster using meaningful player-development information;
5. save useful regular lineups;
6. reuse saved lineups for one-match pre-match preparation without overwriting the persistent regular lineup.

## Product principles

- Never fabricate historical growth. If an old save has no recorded history, show no historical growth until new training is recorded.
- Record growth from authoritative training results, not from UI notifications or inferred ability changes.
- Development priority is the coach's explicit intent, not an automatic stat bonus.
- Saved lineups are snapshots. If a saved player later graduates or disappears, the preset becomes invalid and requires reconfiguration; never silently substitute another player.
- Match-only lineup changes remain temporary and must not overwrite persistent `teamSelection`.
- Preserve PvP opponent privacy.
- No fatigue micromanagement is reintroduced.

## Phase split

### PR14-1 — Player Hub foundation

Scope:

- game schema v8;
- real weekly player-development history, bounded to 52 entries;
- `teamPlanning` persistence;
- explicit development-priority state, max 3 players;
- saved lineup slots, max 3;
- authoritative game actions and validation;
- migration of all v7 saves without inventing history;
- tests for migration, retention, deduplication, action validation and authoritative training recording.

Out of scope:

- new Player Hub visual layout;
- filter/sort UI;
- growth charts;
- development-priority UI controls;
- saved-lineup UI;
- pre-match saved-lineup picker.

### PR14-2 — Player Hub UI

Scope:

- mobile-first roster cards;
- filters: all / grade / position / starter / bench / priority / injured;
- sorting: power / potential / condition / 4-week growth / grade;
- player detail growth summary using persisted history;
- 4-week and 12-week growth aggregation;
- compact growth trend visualization from real data only;
- explicit priority-management UI.

### PR14-3 — Saved lineup UX

Scope:

- three named saved-lineup slots;
- save / replace / delete / apply from normal team-selection screen;
- invalid-preset state after graduation/roster changes;
- pre-match temporary loading of saved lineups;
- preserved existing generated pre-match presets;
- no persistent `teamSelection` mutation when a preset is loaded for one match.

## PR14-1 data model

### Player development history

`GameHistory` gains:

```ts
interface PlayerDevelopmentWeek {
  gameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  trainingMenuId: string;
  players: PlayerDevelopmentWeekPlayer[];
}

interface PlayerDevelopmentWeekPlayer {
  playerId: PlayerId;
  totalAbilityGrowth: number;
  abilityChanges: Partial<Record<AbilityKey, number>>;
}
```

Rules:

- source is `TrainingResult.playerLogs`;
- record the user school's resolved weekly training only;
- include real zero-growth logs as well as positive-growth logs so future selectors can distinguish "trained but no growth" from "no history";
- history identity is the tuple `(academicYearIndex, weekOfYear, gameDate)`;
- appending the same training week is idempotent;
- retain at most the newest 52 weekly entries;
- copy ability-change objects when persisting so later mutations cannot alias the training result.

### Team planning

```ts
type SavedLineupSlot = 1 | 2 | 3;

interface SavedLineupPreset {
  slot: SavedLineupSlot;
  name: string;
  selection: TeamSelection;
}

interface TeamPlanningState {
  developmentPriorityPlayerIds: PlayerId[];
  savedLineups: SavedLineupPreset[];
}
```

Default:

```ts
{
  developmentPriorityPlayerIds: [],
  savedLineups: [],
}
```

Development-priority rules:

- 0–3 IDs;
- IDs must be unique;
- every ID must currently belong to the user's school roster;
- changing priority has no hidden training multiplier in Phase 14.

Saved-lineup rules:

- slot must be 1, 2 or 3;
- one preset per slot;
- name is trimmed, non-empty, max 24 characters;
- selection must pass existing authoritative `validateTeamSelection` when saving;
- saving to an occupied slot replaces that slot;
- deleting an empty slot is idempotent;
- saved selection is deep-cloned when written.

## Authoritative actions

PR14-1 adds:

```ts
{ type: "set-development-priorities"; playerIds: PlayerId[] }
{ type: "save-lineup-preset"; slot: 1 | 2 | 3; name: string; selection: TeamSelection }
{ type: "delete-lineup-preset"; slot: 1 | 2 | 3 }
```

Validation is layered:

- request Zod schema rejects malformed shape, excessive counts, invalid slots and malformed selection payloads;
- domain/application layer validates uniqueness, user-roster membership and full team-selection legality;
- state mutations occur only on the authoritative Worker path.

## Training recording flow

`applyTraining` is the single authoritative integration point because both explicit `training` and automatic training inside `advance-week` pass through it.

Flow:

1. resolve weekly training;
2. consume one-use training boost if applicable;
3. build a persisted development-week entry from the pre-training date/year/week and `TrainingResult`;
4. append idempotently to `history.playerDevelopmentWeeks` with 52-week retention;
5. mark weekly training completed;
6. return outcome.

This ensures explicit training and automatic advance-week training produce one identical history record without duplicating logic.

## Save migration

`CURRENT_GAME_SCHEMA_VERSION` becomes 8.

v7 → v8 migration:

- preserve every existing value;
- set `history.playerDevelopmentWeeks = []`;
- set `teamPlanning = createDefaultTeamPlanning()`.

Older migrations must continue through their historical intermediate additions and then through v7 → v8. In particular, v6 must still initialize v7 school-management state before Phase14 fields are added.

No Supabase table migration is required because `game_saves.state` is stored as JSON and decoded through `gameStateCodec`. Existing separate `team_selection` storage is unchanged.

## Failure semantics

Authoritative validation failures use `GameRuleConflictError` with stable codes:

- `invalid_development_priorities`;
- `invalid_saved_lineup_name`;
- `invalid_saved_lineup`.

Malformed network request shapes remain HTTP 400 through the action schema before a game mutation is attempted.

## Acceptance criteria for PR14-1

- new games start at schema v8 with empty history and empty planning state;
- v7 saves decode to v8 with empty new state and no fabricated history;
- v6 and older supported saves still migrate successfully;
- explicit training records exactly one development week;
- automatic `advance-week` training records exactly one development week;
- stored deltas match `TrainingResult.playerLogs`;
- appending duplicate week data is idempotent;
- only newest 52 weeks are retained;
- development priorities enforce unique user-roster IDs and max 3;
- saved lineups enforce slot/name/selection constraints;
- preset replacement and deletion are deterministic;
- regular persistent `teamSelection` is unchanged by planning actions;
- full `npm run verify` passes;
- mobile E2E remains green even though PR14-1 adds no new UI;
- PR CI and post-merge main CI are fully green.
