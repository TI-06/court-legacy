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


## Measured baseline

Two deterministic seeds were run at 10 and 30 seasons.

| Horizon | Avg actions/week | Max actions/week | Event choices | Match commands | Mid-set decisions | Save size at end |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 seasons A | 3.54 | 13 | 227 | 669 | 316 | 1,034,982 B |
| 10 seasons B | 3.54 | 14 | 221 | 674 | 291 | 1,037,332 B |
| 30 seasons A | 3.50 | 14 | 668 | 1,928 | 897 | 1,144,918 B |
| 30 seasons B | 3.48 | 14 | 656 | 1,917 | 853 | 1,141,615 B |

The match decision mix showed that the guaranteed mid-set stop represented roughly 45% of all match commands. Set breaks, opponent runs, and critical-score moments were materially less frequent and are more contextual.

## Match-pacing adjustment

The controlled team now receives at most one explicit mid-set coaching stop per match. Set-break, opponent-run, and critical-score decisions remain available. CPU automatic mid-set coaching remains active in later sets.

Measured with the same deterministic seeds:

| Horizon | Avg actions/week | Max actions/week | Match commands | Mid-set decisions |
| --- | ---: | ---: | ---: | ---: |
| 10 seasons A | 3.22 | 11 | 501 | 146 |
| 10 seasons B | 3.23 | 12 | 514 | 131 |
| 30 seasons A | 3.26 | 12 | 1,528 | 433 |
| 30 seasons B | 3.24 | 12 | 1,533 | 393 |

This reduces match commands by about 20-25%, mid-set stops by about 52-55%, and total authoritative actions by about 7-9% while keeping the contextual coaching moments.

The 30-season save remained approximately 1.13 MB and produced no balance observations, so the pacing adjustment does not add save growth.
