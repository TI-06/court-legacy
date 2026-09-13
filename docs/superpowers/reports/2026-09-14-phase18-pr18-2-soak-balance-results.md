# Phase18 PR18-2 Soak & Balance Results

Date: 2026-09-14
PR: #83 — Soak & Balance Harness
Baseline save schema: v8
Package version: 0.0.0

## Purpose

PR18-2 adds a deterministic headless soak runner that reuses the production game-action boundary instead of introducing a second simulation engine. The runner advances normal weeks, resolves events, continues controlled matches, contracts assistant coaches, and upgrades facilities through `applyGameAction`.

The harness separates hard invariants from balance observations. Hard invariant failures throw and return a non-zero process status. Reproduction errors include seed, date, academic-year index, week and action count. Balance observations remain visible in JSON and human-readable output without making CI fail.

## Presets and commands

- `npm run soak:smoke` — 1 season
- `npm run soak` — 3 seasons
- `npm run soak:balance` — 10 seasons
- `npm run soak:long` — 30 seasons

Release-side default seeds are `phase18-release-a` and `phase18-release-b`. The CLI also supports explicit repeatable/comma-separated seeds and JSON output.

Normal CI runs the fast smoke preset. The 3-season deterministic regression is also exercised by the normal unit suite. The 10-season and 30-season presets remain executable release-side rather than running on every commit.

## Production logic exercised

The runner uses the same production action path as the game for:

- weekly progression and training resolution;
- pending event choices;
- official/practice match continuation;
- tournament progression;
- academic-year rollover, growth, graduation, intake, world progression and annual finance;
- assistant-coach contracts;
- facility upgrades.

Management policy keeps a 300-fund reserve when selecting coach/facility actions. It prefers the highest affordable annual coach and upgrades an allowed low-level facility. The policy decides only which production action to send; it never writes the resulting economy/facility/coach state directly.

Year tracking retains each player's growth type before rollover so a graduating player's final development is still attributed to the correct growth type. The runner also records each national tournament's entrant `seedStrength` distribution once and counts assistant-coach contract changes within the completed academic year.

## Long-run verification evidence

GitHub Actions run `34769879886` revalidated the reporting-complete harness successfully:

- dependency audit: PASS
- full `npm run verify`: PASS
- 1-season smoke, two seeds: PASS
- 10-season balance, two seeds: PASS
- 30-season long soak, two seeds: PASS
- hard invariant failures: 0

The earlier management-enabled matrix in run `34767072758` also passed mobile E2E. Final PR-head CI returns to the normal `verify + smoke + mobile-e2e` configuration after this one-time long-run evidence collection.

### 1-season smoke evidence

| Seed              | Weeks | Actions | Funds        | User strength | CPU p50 | Coach                 | National entrants | National p50 |
| ----------------- | ----: | ------: | ------------ | ------------: | ------: | --------------------- | ----------------: | -----------: |
| phase18-release-a |    53 |     138 | 700 -> 913   |            91 |      53 | intermediate / attack |                32 |           79 |
| phase18-release-b |    53 |     148 | 700 -> 1752  |            91 |      54 | intermediate / attack |                32 |           74 |

Both first seasons recorded one assistant-coach contract change. The deterministic regression also verifies that yearly growth has no `unknown` growth-type bucket after rollover.

### 10-season results

| Seed              | Weeks | Actions | Final-year funds | User strength | CPU p50 | Final coach     | National entrants | National p50 | Facility range |
| ----------------- | ----: | ------: | ---------------- | ------------: | ------: | --------------- | ----------------: | -----------: | -------------- |
| phase18-release-a |   522 |    1427 | 12065 -> 1802    |            95 |      55 | master / attack |                32 |           81 | about Lv34-35  |
| phase18-release-b |   522 |    1433 | 2316 -> 771      |            95 |      56 | master / attack |                32 |           84 | about Lv31-32  |

### 30-season results

| Seed              | Weeks | Actions | Final-year funds | User strength | CPU p50 | Final coach       | National entrants | National p50 | Highest observed facility |
| ----------------- | ----: | ------: | ---------------- | ------------: | ------: | ----------------- | ----------------: | -----------: | ------------------------: |
| phase18-release-a |  1566 |    4349 | 4033 -> 2719     |            92 |      56 | master / physical |                32 |           83 |                        47 |
| phase18-release-b |  1566 |    4321 | 10634 -> 9586    |            94 |      56 | master / physical |                32 |           83 |                        38 |

Seed A ended with alumni association, dormitory, scouting network and study room at Lv47. Seed B was more evenly distributed, with gym reaching Lv38. Neither release seed reached Lv50 within 30 seasons. This is balance evidence, not an invariant failure; the harness still tracks milestones through the production maximum of Lv50.

The annual coach lifecycle is exercised in the real soak path. Early runs use affordable lower ranks, and long runs demonstrate progression to master contracts. Completed-year reports preserve the coach used during that year even though the production contract expires during academic-year rollover. The final observed year for each release seed records one contract change, matching the annual contract policy.

National-stage evidence is now derived from the actual tournament stage entrants rather than inferred from champions. The final observed year for both 30-season release seeds contains 32 national entrants with p50 seed strength 83.

## Balance observations

The most consistent finding is that the user school is materially stronger than the CPU distribution. Across the release seeds, user strength is generally around the low-to-high 90s while CPU p90 remains around the upper 50s/low 60s. The harness therefore emits `user_strength_above_cpu_p90` repeatedly.

This is intentionally non-blocking in PR18-2. It should be reviewed as a Phase19 balance target or as part of the v0.1.0 release decision, rather than being converted into an arbitrary CI threshold without an agreed design target.

The economy also occasionally records a minimum balance of zero. Management actions themselves preserve the 300 reserve, but other production economy transitions can subsequently reduce funds. `fundsMin` and sampled zero-fund week counts are reported separately so a transient/ledger minimum is not mislabeled as a full week spent at zero.

## Release-readiness conclusion

The deterministic runner can now reproduce the same seed, complete 1/3/10/30-season horizons, emit structured and readable evidence, preserve growth attribution across graduation, inspect national participant strength, exercise high facility levels and annual coach contracts, and stop on hard state corruption/deadlock with complete reproduction context instead of silently continuing.

No save-schema migration was introduced. The schema remains v8, the package version remains 0.0.0 for PR18-4, and PR18-2 does not change the Phase16 PvP authority/privacy/idempotency boundary.
