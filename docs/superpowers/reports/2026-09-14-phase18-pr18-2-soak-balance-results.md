# Phase18 PR18-2 Soak & Balance Results

Date: 2026-09-14
PR: #83 — Soak & Balance Harness
Baseline save schema: v8
Package version: 0.0.0

## Purpose

PR18-2 adds a deterministic headless soak runner that reuses the production game-action boundary instead of introducing a second simulation engine. The runner advances normal weeks, resolves events, continues controlled matches, contracts assistant coaches, and upgrades facilities through `applyGameAction`.

The harness separates hard invariants from balance observations. Hard invariant failures throw and return a non-zero process status. Balance observations remain visible in JSON and human-readable output without making CI fail.

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

## Long-run verification evidence

GitHub Actions run `34767072758` completed the management-enabled validation matrix successfully:

- dependency audit: PASS
- full `npm run verify`: PASS
- 1-season smoke, two seeds: PASS
- 10-season balance, two seeds: PASS
- 30-season long soak, two seeds: PASS
- mobile E2E: PASS
- hard invariant failures: 0

### 10-season results

| Seed | Weeks | Actions | Final-year funds | User strength | CPU p50 | Final coach | Facility range |
| --- | ---: | ---: | --- | ---: | ---: | --- | --- |
| phase18-release-a | 522 | 1427 | 12065 -> 1802 | 95 | 55 | master / attack | about Lv34-35 |
| phase18-release-b | 522 | 1433 | 2316 -> 771 | 95 | 56 | master / attack | about Lv31-32 |

### 30-season results

| Seed | Weeks | Actions | Final-year funds | User strength | CPU p50 | Final coach | Highest observed facility |
| --- | ---: | ---: | --- | ---: | ---: | --- | ---: |
| phase18-release-a | 1566 | 4349 | 4033 -> 2719 | 92 | 56 | master / physical | 47 |
| phase18-release-b | 1566 | 4321 | 10634 -> 9586 | 94 | 56 | master / physical | 38 |

Seed A ended with alumni association, dormitory, scouting network and study room at Lv47. Seed B was more evenly distributed, with gym reaching Lv38. Neither release seed reached Lv50 within 30 seasons. This is balance evidence, not an invariant failure; the harness still tracks milestones through the production maximum of Lv50.

The annual coach lifecycle is now exercised in the real soak path. Early runs use affordable lower ranks, and long runs demonstrate progression to master contracts. Completed-year reports preserve the coach used during that year even though the production contract expires during academic-year rollover.

## Balance observations

The most consistent finding is that the user school is materially stronger than the CPU distribution. Across the release seeds, user strength is generally around the low-to-high 90s while CPU p90 remains around the upper 50s/low 60s. The harness therefore emits `user_strength_above_cpu_p90` repeatedly.

This is intentionally non-blocking in PR18-2. It should be reviewed as a Phase19 balance target or as part of the v0.1.0 release decision, rather than being converted into an arbitrary CI threshold without an agreed design target.

The economy also occasionally records a minimum balance of zero. Management actions themselves preserve the 300 reserve, but other production economy transitions can subsequently reduce funds. `fundsMin` and sampled zero-fund week counts are reported separately so a transient/ledger minimum is not mislabeled as a full week spent at zero.

## Release-readiness conclusion

The deterministic runner can now reproduce the same seed, complete 1/3/10/30-season horizons, emit structured and readable evidence, exercise high facility levels and annual coach contracts, and stop on hard state corruption/deadlock instead of silently continuing.

No save-schema migration was introduced. The schema remains v8, the package version remains 0.0.0 for PR18-4, and PR18-2 does not change the Phase16 PvP authority/privacy/idempotency boundary.
