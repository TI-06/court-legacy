# Court Legacy Project Context

This file is the durable handoff note for development sessions. Read it before continuing roadmap work.

## Repository

- GitHub: `https://github.com/TI-06/court-legacy`
- Clone URL: `https://github.com/TI-06/court-legacy.git`
- Repository full name: `TI-06/court-legacy`
- Default branch: `main`
- Always fetch the current `main` SHA before starting work. Do not treat a SHA written in a past chat or document as permanently current.

## Product

Court Legacy is a mobile-first high-school volleyball coaching simulation game.

The core product direction is:

> Build players, make coaching decisions, develop the school, choose lineups and tactics, and progress from an unknown program toward national championships.

Avoid turning the game into repetitive management chores. Decisions should matter, but routine actions should stay low-friction.

## Technical stack

- React 19
- TypeScript 5.9
- Vite 7
- Vitest 4
- Testing Library
- Playwright
- Cloudflare Worker backend
- Supabase-backed authoritative online/PvP flows where applicable
- Node version is defined by `.node-version` (currently Node 22.16.0 at the time this note was written)

## Development commands

Install:

```bash
npm ci --no-audit --fund=false
```

Full quality gate:

```bash
npm run verify
```

`npm run verify` covers formatting, lint, TypeScript, automated tests and production build.

Browser E2E:

```bash
npm run test:e2e
```

Other useful commands:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## CI

Workflow:

- `.github/workflows/ci.yml`

Required jobs:

1. `dependency-audit`
2. `quality`
3. `mobile-e2e`

A feature/fix is not complete merely because PR CI is green. After merge, verify the `main` push workflow for the merge SHA and confirm all required jobs are green there as well.

For main CI, use the Actions runs API filtered by branch and head SHA because the helper that fetches commit workflow runs may only return pull-request-triggered runs:

```text
https://api.github.com/repos/TI-06/court-legacy/actions/runs?branch=main&head_sha=<merge_sha>
```

## Mobile acceptance widths

Primary supported widths:

- 320 px
- 360 px
- 390 px
- 414 px
- 480 px

For major mobile UI changes, test all five widths. At minimum verify:

- no horizontal page overflow;
- bottom navigation is not covered;
- sticky/fixed actions do not cover content;
- primary controls remain reachable and large enough to tap;
- long Japanese school/player names degrade gracefully.

## Git / PR workflow

Normal sequence:

1. Fetch latest `main`.
2. Create a focused branch from fresh `main`.
3. Write/adjust tests first where practical and confirm RED.
4. Implement the smallest GREEN change.
5. Refactor without scope expansion.
6. Run focused tests, then full `npm run verify`.
7. Open PR (Draft while implementation is incomplete).
8. Require `dependency-audit`, `quality`, and `mobile-e2e` GREEN.
9. Inspect changed filenames for accidental files, temporary scripts/workflows, secrets, or generated artifacts.
10. Review critical diffs.
11. Mark PR ready.
12. Merge using the expected PR head SHA so a moved head cannot be merged accidentally.
13. Verify the `main` push CI for the merge SHA is fully GREEN.

Do not claim completion before step 13.

Temporary formatting/fix workflows or scripts must not remain in the final PR.

## Architecture rules

### Save compatibility

Preserve existing saves unless a roadmap feature genuinely requires a schema migration. Do not increment `GameState.schemaVersion` just for presentation/UI state.

### Server authority

Authoritative game actions stay authoritative. Do not create a client-only shortcut for match simulation, online progression, rewards, or PvP state.

### Match-only lineup

Pre-match lineup changes are temporary for that match. They must not overwrite the player's persistent regular `teamSelection` unless the user explicitly edits and saves the normal team selection elsewhere.

### PvP privacy

Do not expose private opponent player ability data. Public opponent team strength and explicitly public summaries are allowed; individual hidden attributes remain private.

### Player condition

The visible user-facing condition system is the PowerPro-like five-level condition presentation. Do not reintroduce fatigue as a recurring manual-management chore.

## Current roadmap

### Phase 13 — Home Command Center

Implemented through PR #69. Home is the weekly coaching command center with:

- week / next official objective;
- team strength, condition and cohesion;
- prioritized coaching tasks;
- recent news;
- unanswered practice-offer warning;
- dominant `今週を進める` flow;
- deep links to relevant player/school/match screens.

A follow-up Home CTA layout polish is handled by PR #70 (`fix/phase13-home-cta-polish`).

### Phase 14 — Player Hub 2.0

PR14-1 foundation is on `main`. The current save schema is v8 and the foundation provides:

- v7 and older-save migration into schema v8 without inventing historical growth;
- up to 52 real weekly player-development records derived from authoritative training results;
- explicit coach development priorities for up to three current-roster players;
- three saved lineup slots with authoritative team-selection validation;
- server-authoritative actions for setting priorities and saving/deleting lineup presets;
- no hidden growth bonus merely for marking a player as a development priority.

PR14-2 Player Hub UI adds:

- mobile-first player roster cards with grade / position / starter / bench / priority / injured filters;
- deterministic sorting by power / potential / condition / real 4-week growth / grade;
- real 4-week and 12-week growth aggregation from persisted schema-v8 development history;
- compact growth trends that render only persisted player logs and keep no-history distinct from real zero growth;
- explicit max-three development-priority controls persisted through the authoritative `set-development-priorities` game action;
- Player Hub mobile coverage at 320 / 360 / 390 / 414 / 480 px with horizontal-overflow and bottom-navigation collision checks;
- existing lineup, team-dynamics and individual-training controls preserved.

PR14-3 saved-lineup UX completes the Phase 14 Player Hub slice with:

- three visible named lineup slots in the normal Player Hub lineup screen;
- authoritative save, overwrite and delete through the existing `save-lineup-preset` / `delete-lineup-preset` game actions;
- applying a valid saved lineup to the normal team through the existing authoritative `team-selection` action;
- explicit `再設定が必要` handling when a saved snapshot becomes invalid after roster changes, with no silent player replacement;
- invalid snapshots kept visible so they can be overwritten or deleted, while apply remains disabled;
- a compact pre-match saved-lineup picker alongside the existing generated `ベスト / 1年中心 / 2年中心 / 3年中心 / 調子優先` presets;
- pre-match saved-lineup loading cloned only into match-local selection, never overwriting persistent `teamSelection`;
- existing `元に戻す` semantics preserved so it always restores the normal base lineup;
- PvP opponent privacy unchanged;
- full saved-lineup user-flow coverage at 320 / 360 / 390 / 414 / 480 px, including horizontal-overflow checks.

Phase 14 does not fabricate player history, add fatigue-management chores, leak private PvP opponent abilities, silently repair stale saved lineups, or persist match-only lineup changes.

**Phase 15 — Team Tactics is the next roadmap slice.**

### Phase 15 — Team Tactics

Simple meaningful volleyball tactics, with opponent matchup trade-offs and no single dominant strategy.

### Phase 16 — Match Command

Limited high-value in-match coaching decisions rather than per-point micromanagement.

### Phase 17 — Season Goals & Rankings

Year goals plus prefectural/national ranking progression. Do not invent rankings before this phase.

### Phase 18 — School Development 2.0

Facility milestone bonuses and staff identities/specialties.

### Phase 19 — Scouting & Recruitment 2.0

Partial-information scouting and stronger new-year recruitment loop.

### Phase 20 — Rivalry / Legacy / Coach Career

Rival history, alumni careers/events, coach profile and achievements.

### Phase 21 — PvP Seasons

Seasonal PvP ranking/endgame layer without pay-to-win progression.

## Key design and implementation documents

### Phase 13

- `docs/superpowers/specs/2026-09-08-phase13-home-command-center-design.md`
- `docs/superpowers/plans/2026-09-08-phase13-home-command-center.md`

### Phase 14

- `docs/superpowers/specs/2026-09-09-phase14-player-hub-2-design.md`
- `docs/superpowers/plans/2026-09-09-phase14-player-hub-foundation.md`
- `docs/superpowers/plans/2026-09-09-phase14-player-hub-ui.md`
- `docs/superpowers/plans/2026-09-09-phase14-saved-lineup-ux.md`

## Handoff rule

When a future chat says to continue Court Legacy development:

1. read this file;
2. fetch current `main` and recent relevant PR status from GitHub;
3. do not rely on a stale SHA from chat history;
4. continue from the first unfinished roadmap phase or explicitly requested fix.
