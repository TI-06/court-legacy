# Phase19 PR19-2 — Player Growth / Talent Balance Results

## Scope

This report records the deterministic evidence for Phase19 PR19-2 on top of Phase19 PR19-1 main SHA `c54c219e5f0461bcbbb03573a2c86efb59b103bf`.

The PR changes player-development policy only. Save schema stays at v8. Scouting rarity, PvP client authority, PvP persistence and database schema are unchanged.

## Implemented balance policy

- One canonical long-term ability ceiling and near-ceiling dampening policy is shared by weekly training and solo match experience.
- Grade curves keep early and late bloomers meaningfully different across the three school years.
- `growth.practice` retains the stronger weekly-practice identity.
- `growth.match` receives bounded solo match experience and is no longer structurally disadvantaged by having no match-growth path.
- `growth.adversity` receives a bounded extra match-experience step after a loss and/or against a meaningfully stronger opponent.
- Solo match experience is applied only when a practice or official match reaches `match-complete` on the authoritative game-action path.
- Existing weekly-action and official-tournament completion boundaries prevent duplicate application.
- PvP session/client paths do not invoke the new player-growth resolver.

## Focused verification before long soak

Safe isolated run `34793995182` completed successfully with:

- TypeScript typecheck: exit 0.
- Focused player-growth/training/action suites: 6 files passed, 32 tests passed, 2 skipped.
- `npm run verify`: formatting, lint, typecheck, V2 structure, unit tests and production build all reported `[OK]`.
- `npm run release:check`: `[OK] release metadata v0.1.0, save schema v8`.
- 10-season balance soak, both established seeds: exit 0.

The focused test set was subsequently expanded to cover official-match completion, a user player excluded from the selected match roster, and the explicit `match experience < weekly training` contract. Final release-quality verification is recorded separately in the PR/CI evidence after those additions.

## 10-season deterministic soak

### Seed `phase18-release-a`

- Seasons: 10/10
- Weeks: 522
- Actions: 1,441
- Final user strength: 96
- Final CPU p50: 67
- Final-year recorded weekly-training growth: 2,809
- National field: 32 entrants, p50 strength 92
- Highest listed facilities reached Lv35 by the final season

### Seed `phase18-release-b`

- Seasons: 10/10
- Weeks: 522
- Actions: 1,397
- Final user strength: 99
- Final CPU p50: 67
- Final-year recorded weekly-training growth: 2,360
- National field: 32 entrants, p50 strength 94
- Highest listed facilities reached Lv27 by the final season

Both 10-season runs completed without invariant/test failure.

## 30-season deterministic soak

Safe isolated run `34794331772` completed successfully. `PHASE19_SOAK_LONG_STATUS=0` and both long-soak tests passed.

### Seed `phase18-release-a`

- Seasons: 30/30
- Weeks: 1,566
- Actions: 4,189
- Final user strength: 96
- CPU strength: p50 68, p90 75, max 76
- All-player ability distribution: p50 60.1, p90 69.9, max 94.6, mean 61.8
- National field: 32 entrants, p50 95, p90 108, max 120
- Final-year recorded weekly-training growth: 3,312
- Final player tiers: 814 normal, 70 prospect, 2 generational

### Seed `phase18-release-b`

- Seasons: 30/30
- Weeks: 1,566
- Actions: 4,087
- Final user strength: 94
- CPU strength: p50 67, p90 85, max 91
- All-player ability distribution: p50 60.5, p90 83.1, max 93.1, mean 63.36
- National field: 32 entrants, p50 99, p90 111, max 120
- Final-year recorded weekly-training growth: 1,795
- Final player tiers: 787 normal, 85 prospect, 3 generational

## Interpretation

### Early/late curves remain distinct

Focused domain tests lock the intended grade ordering directly: early bloomers have the stronger grade-1 multiplier, while late bloomers have the stronger grade-3 multiplier. This avoids trying to infer a growth curve from one randomly composed final-year roster.

### Practice and match identities are both meaningful

Focused tests compare the definitions under the same player/context and enforce both sides of the identity:

- weekly training favors `growth.practice` over `growth.match`;
- completed-match experience favors `growth.match` over `growth.practice`;
- a normal focused weekly-training increment remains larger than one bounded match-experience increment.

The soak report field `growthByGrowthType` is intentionally **not** used as proof of match-growth balance because that metric is derived from `history.playerDevelopmentWeeks` and therefore records weekly training only. Match experience is verified through the domain and authoritative game-action tests instead.

### No broad ability saturation

Across the two 30-season worlds, all-player maximum average ability is 94.6 and 93.1. The p90 values are 69.9 and 83.1. The canonical potential/tier ceiling therefore still permits rare separation without causing a broad population of 99/100 players.

### Phase19 PR19-1 CPU progression remains present

The 30-season runs retain differentiated CPU strength and a strong national field. Final CPU p90 is 75/85 across the two seeds, while national participant p50 is 95/99. PR19-2 does not replace or bypass the PR19-1 rival-school progression path.

## Non-blocking observations

The existing soak harness still reports some years where the user school materially exceeds the ordinary CPU-school p90, and some years with a minimum fund balance of zero. Those observations pre-date or sit outside this PR's player-development scope. They remain evidence for later economy/match-difficulty tuning rather than reasons to weaken the player growth-type identities introduced here.

## Decision

The 10-season and 30-season deterministic evidence supports keeping the current bounded constants. No additional numeric tuning is justified before PR review/CI. Final acceptance still requires exact-head PR CI GREEN and exact merge-SHA main CI GREEN.

Final isolated verification is rerun after applying repository-standard Prettier formatting to the expanded match-experience test.
