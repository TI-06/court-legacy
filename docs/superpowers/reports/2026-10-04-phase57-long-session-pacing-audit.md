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


## Measured results

### 10 seasons

- weeks: 522
- actions: 1,847
- average actions/week: 3.54
- maximum actions in one week: 13
- weeks over four actions: 146
- event choices: 227 across 227 event weeks
- completed matches: 368 across 167 match weeks
- save size: 271,745 -> 1,034,982 bytes
- max observed save size: 1,038,374 bytes
- balance observations: 0

### 30 seasons

- weeks: 1,566
- actions: 5,486
- average actions/week: 3.50
- maximum actions in one week: 14
- weeks over four actions: 418
- event choices: 668 across 668 event weeks
- completed matches: 500 across 228 match weeks
- save size: 271,745 -> 1,144,918 bytes
- max observed save size: 1,144,918 bytes
- balance observations: 0

### 30-season action mix

| Action | Count | Interpretation |
| --- | ---: | --- |
| advance-week | 1,984 | core progression and match-start boundaries |
| match-command | 1,928 | approximately 3.9 decisions per completed match |
| facility-upgrade | 876 | largest low-value repetitive management action |
| event-choice | 668 | approximately 22 authored event decisions per season |
| assistant-coach-contract | 30 | one annual staffing decision |

### 30-season match-decision mix

- mid-set: 897
- set-break: 484
- critical-score: 284
- opponent-run: 263

## Audit conclusion

The match-command count is not the first simplification target. Roughly four decisions per match preserves the player-agency goal that was intentionally added to live matches.

Event frequency is high but still contributes narrative variety, especially now that Phase57 contextual weeks prioritize tournament, rival, and camp situations.

The clearest repetitive-management target is facility upgrading. The soak management policy generated 876 facility-upgrade actions across 30 seasons, or roughly 29 per season. A player who steadily invests in facilities can therefore encounter many low-value repeated taps.

The next gameplay improvement should reduce facility-upgrade click repetition without changing facility balance or save structure. Prefer a bulk/multi-level upgrade interaction over lowering costs, increasing passive growth, or adding another management screen.

Save growth is substantially front-loaded: the snapshot reaches about 1.03 MB by year 10 and about 1.14 MB by year 30. The additional 20 seasons add only about 110 KB, indicating that bounded-history policies are working. Continue to guard against full-state operation-response retention because transport duplication remains a larger risk than long-term state growth.
