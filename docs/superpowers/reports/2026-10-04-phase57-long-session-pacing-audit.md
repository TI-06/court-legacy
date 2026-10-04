# Phase57-4 Long-session pacing audit

Date: 2026-10-04

## Purpose

Measure long-session repetition and interaction density before adding more systems.

The soak report now records:

- average authoritative actions per simulated week
- maximum actions required in one week
- weeks requiring more than four actions
- resolved event count and number of event weeks
- completed match count and number of match weeks
- existing save-size measurements remain unchanged

## Why this matters

A long-running management game can become tiring even when individual features are good. The useful signal is not only total content count, but how often the player is forced through repeated interactions before reaching the next meaningful week.

Phase57-4 keeps this as diagnostic output only. No new save state is persisted.

## Follow-up thresholds

Use 10-season and 30-season runs to identify:

- excessive action density
- event saturation
- match congestion
- save growth
- repeated low-value interactions

Any gameplay simplification should be justified by these measurements rather than adding another permanent screen.


## Final measured results

The first measurement used the soak policy's legacy +1-only facility upgrades. Production already supports +1 / +5 / +10 bulk upgrades, so the soak policy was corrected to choose the largest affordable option while keeping the management reserve. The figures below are the final representative results.

### 10 seasons

- weeks: 522
- actions: 1,753
- average actions/week: 3.36
- maximum actions in one week: 13
- weeks over four actions: 148
- event choices: 224
- match commands: 647
- facility upgrades: 202
- save size: 271,745 -> 1,025,492 bytes
- balance observations: 0

### 30 seasons

- weeks: 1,566
- actions: 5,231
- average actions/week: 3.34
- maximum actions in one week: 13
- weeks over four actions: 440
- event choices: 662
- completed matches: 500 across 229 match weeks
- match commands: 1,958
- facility upgrades: 558
- assistant coach contracts: 30
- school investments: 20
- special projects: 2
- save size: 271,745 -> 1,155,772 bytes
- balance observations: 0

### 30-season match decision mix

- mid-set: 930
- set-break: 497
- critical-score: 283
- opponent-run: 248

## Final audit conclusion

The current interaction density is not severe enough to justify removing player agency.

Match commands average about 3.9 decisions per completed match, which is consistent with the intended live-match coaching layer. Event decisions average about 22 per season and now carry stronger tournament, rival, and camp context.

Facility upgrades remain frequent in the automated soak policy, but the production UI already provides +1 / +5 / +10 bulk upgrades. They are also optional management actions rather than mandatory weekly progression.

The next risk to prioritize is save reliability rather than further click reduction. The final snapshot grows from about 272 KB initially to about 1.03 MB after 10 seasons and about 1.16 MB after 30 seasons. Growth after the first decade is comparatively slow, which confirms that bounded histories are working. However, because historical production failures occurred around long sessions, keep transport payload size, operation-response retention, and full-state fallback paths under explicit regression coverage.
