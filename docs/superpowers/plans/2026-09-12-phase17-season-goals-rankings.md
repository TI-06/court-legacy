# Phase 17 — Season Goals & Rankings

## Goal

Give each academic year a clear target and an authoritative school ranking.
Reuse existing school reputation and official tournament history.

## PR17-1 — Domain foundation

- Build deterministic national and regional rankings.
- Use `reputationPoints` as the primary ranking signal.
- Tie-break with official achievements and stable school ID ordering.
- Create three deterministic season goals.
- Store season-start history baselines and starting ranks.
- Evaluate goals from final rank and season deltas.
- Archive a compact season result at academic-year rollover.
- Create the next season's goals after annual reputation resolution.
- Keep save schema version 8.
- Accept older v8 saves without Phase 17 fields.
- Validate Phase 17 fields when they are present.

## PR17-2 — Player-facing UI

- Add a Home season-goal card.
- Add regional and national ranking views.
- Highlight the user school and nearby schools.
- Show movement from the season-start rank.
- Verify 320, 360, 390, 414, and 480 pixel widths.

## PR17-3 — Season-end presentation

- Show season-goal results during the year transition.
- Add end-to-end coverage for new games, rollover, and legacy v8 saves.
- Run full verification and exact-tree CI before merge.

## Verification gates

1. Confirm RED before implementation.
2. Focused tests must be GREEN.
3. `npm run verify` must be GREEN.
4. Relevant E2E must be GREEN.
5. Review the final diff for Phase 16 regressions.
6. Exact-tree PR CI must be GREEN.
7. Merged-main CI must be GREEN.
