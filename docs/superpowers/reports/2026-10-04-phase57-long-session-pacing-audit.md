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

### 10-season run

- weeks: 522
- actions: 1,745
- average actions/week: 3.34
- maximum actions in one week: 14
- heavy weeks (>4 actions): 140 / 522 (26.8%)
- events: 218 across 218 weeks
- matches: 367 across 165 weeks
- match commands: 660
- decision reasons:
  - mid-set: 301
  - set-break: 163
  - critical-score: 100
  - opponent-run: 96
- save size: 271,407 bytes -> 1,068,719 bytes

### 30-season run

- weeks: 1,566
- actions: 5,033
- average actions/week: 3.21
- maximum actions in one week: 27
- heavy weeks (>4 actions): 428 / 1,566 (27.3%)
- events: 657 across 657 weeks
- matches: 500 across 223 weeks
- match commands: 1,945
- decision reasons:
  - mid-set: 908
  - set-break: 491
  - critical-score: 294
  - opponent-run: 252
- save size: 271,408 bytes -> 1,126,860 bytes
- maximum observed save size: 1,139,567 bytes

## Findings

The pacing pattern is stable across 10 and 30 seasons.

1. Roughly 27% of weeks require more than four authoritative actions.
2. Match commands are the largest repeated interaction source.
3. Unconditional mid-set decisions are the largest single match-decision category, representing 908 of 1,945 match commands in the 30-season run.
4. Set-break decisions remain valuable because they provide an explicit between-set adjustment point.
5. Critical-score and opponent-run decisions are contextual and should remain high-value interaction points.
6. Save growth remains bounded around 1.14 MB at the maximum observed point, so the immediate pacing problem is interaction density rather than state growth.

## Recommended next change

Reduce unconditional mid-set interruptions.

Keep mid-set interaction only when the human-controlled team is materially under pressure, while preserving:

- set-break decisions
- critical-score decisions
- opponent-run decisions

This should remove the largest low-value repeated prompt without turning matches back into passive simulations.
