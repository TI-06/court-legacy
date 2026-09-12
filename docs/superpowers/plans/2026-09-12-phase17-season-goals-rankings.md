# Phase 17 — Season Goals & Rankings

## Goal

Make each academic year feel like a campaign with a clear school expectation and an authoritative school ranking. Phase 17 must reuse the existing school reputation and official-tournament history instead of introducing a second progression currency.

## Design rules

- `School.reputationPoints` remains the primary long-term school-strength/reputation signal.
- Rankings are deterministic. Equal reputation points are resolved by official achievement and then stable school ID ordering.
- Regional ranking is scoped by `regionId`; national ranking considers all persisted world schools. The current generated world may have one region, but the selector must remain future-compatible with multiple regions.
- Season goals measure deltas from a season-start baseline so cumulative school-history counters do not over-credit later seasons.
- An active season goal belongs to one `yearIndex` / academic year only.
- Year transition evaluates the completed goal before creating the next goal.
- Phase 17 additions are backward-compatible with schema v8. Existing v8 saves that lack Phase 17 fields must continue to decode and play.
- No PvP rating data is used for PvE school rankings.

## PR17-1 — Domain foundation

### Task 1: Deterministic school rankings

Files:
- `src/domain/season/schoolRankings.ts`
- `tests/unit/domain/season/schoolRankings.test.ts`

Requirements:
- Build national and region-scoped ranking rows.
- Sort by reputation points descending.
- Tie-break by national titles, national appearances, prefectural titles, official wins, fewer official losses, then school ID.
- Expose the user school's regional and national rank without mutating game state.
- Return stable results regardless of object insertion order.

### Task 2: Season goal model and lifecycle

Files:
- `src/domain/season/seasonGoals.ts`
- `src/domain/model/GameState.ts`
- `tests/unit/domain/season/seasonGoals.test.ts`

Requirements:
- Generate an expectation appropriate to the user school's season-start ranking/reputation.
- Store season-start baselines for official wins, prefectural titles, national appearances and national titles.
- Track targets using persisted, deterministic values rather than hidden randomness.
- Evaluate the completed season from final rankings and history deltas.
- Record a compact completion summary in game history.
- Missing Phase 17 state from an old v8 save must be handled safely.

### Task 3: New game + annual transition integration

Files:
- `src/domain/generation/generateWorld.ts`
- `src/domain/calendar/academicYearProgression.ts`
- `src/persistence/gameStateCodec.ts`
- related unit/integration tests

Requirements:
- New games start with an active season goal.
- Academic-year transition evaluates the previous goal after annual reputation resolution and before the next goal is generated.
- Preserve the just-completed goal summary in history.
- Generate the new year's goal after the new-year school state is authoritative.
- Keep `CURRENT_GAME_SCHEMA_VERSION = 8`.
- Codec accepts v8 saves without Phase 17 fields and validates Phase 17 fields when present.

## PR17-2 — Player-facing UI

Planned after PR17-1 is GREEN:
- Home dashboard season-goal card with current progress.
- Rankings screen/section with regional/national toggle.
- User school pinned/highlighted and nearby-rank context.
- Ranking movement indicator using season-start rank.
- Mobile widths 320 / 360 / 390 / 414 / 480.

## PR17-3 — Season-end presentation and regression hardening

Planned after PR17-2:
- Academic-year transition result presents goal outcome and final ranks.
- E2E covers new game, progress, season rollover and legacy v8 load.
- Full verify + full E2E + exact-tree PR CI + merged-main CI.

## Verification gates

For each PR:
1. RED tests demonstrate missing behavior before implementation.
2. Focused tests GREEN.
3. `npm run verify` GREEN.
4. Relevant E2E GREEN; final Phase17 PR runs full E2E.
5. Final diff review confirms no Phase16 official/PvP privacy or match-completion regression.
6. Exact-tree PR CI GREEN before merge.
7. Merged-main CI GREEN.
