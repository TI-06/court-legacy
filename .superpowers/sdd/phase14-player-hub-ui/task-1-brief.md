# Task 1 brief — Player Hub roster selectors

Implement Task 1 from `docs/superpowers/plans/2026-09-09-phase14-player-hub-ui.md`.

Requirements:
- Create `src/features/team/playerHubRoster.ts`.
- Export `PlayerHubFilter`, `PlayerHubSort`, `PlayerGrowthTrendPoint`, `PlayerGrowthSummary`, `PlayerHubRosterItem`, `SelectPlayerHubRosterInput`, `summarizePlayerGrowth`, `selectPlayerHubRoster` exactly as planned.
- Growth windows are newest 4/12 persisted weeks; absent log = null, real zero log = 0; trend uses only real logs oldest→newest.
- Filters: all, grade1/2/3, OH/MB/OP/S/L, starter, bench, priority, injured.
- Sorts: power, potential(null last), condition, growth4w(null last), grade 3→1.
- Secondary tie-breaker display power desc except power itself; final player ID ascending.
- No persistence, Worker, fatigue, saved-lineup or PvP changes.
- Tests are in `tests/unit/features/team/playerHubRoster.test.ts` and must remain behavior-focused.

Report contract: implementation summary, files changed, test command/result, self-review concerns. No subagents.