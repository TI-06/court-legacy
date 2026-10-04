# Phase57-4 Long-session pacing audit

Date: 2026-10-04

## Purpose

Measure long-session repetition and interaction density before adding more systems.

The soak report records:

- average authoritative actions per simulated week
- maximum actions required in one week
- weeks requiring more than four actions
- resolved event count and number of event weeks
- completed match count and number of match weeks
- authoritative action counts by type
- match decision counts by reason
- existing save-size measurements

No new gameplay state is persisted for these diagnostics.

## Measured baseline

Two deterministic seeds were run at both 10 and 30 seasons.

### 10 seasons

- Seed A: 3.54 actions/week, max 13, 227 event choices, 669 match commands, 316 mid-set decisions, final save 1,034,982 bytes.
- Seed B: 3.54 actions/week, max 14, 221 event choices, 674 match commands, 291 mid-set decisions, final save 1,037,332 bytes.

### 30 seasons

- Seed A: 3.50 actions/week, max 14, 668 event choices, 1,928 match commands, 897 mid-set decisions, final save 1,144,918 bytes.
- Seed B: 3.48 actions/week, max 14, 656 event choices, 1,917 match commands, 853 mid-set decisions, final save 1,141,615 bytes.

The decision mix showed that the guaranteed mid-set stop represented roughly 45% of all match commands. Set breaks, opponent runs, and critical-score moments were materially less frequent and more contextual.

## Match-pacing adjustment

The controlled team now receives at most one explicit mid-set coaching stop per match. Set-break, opponent-run, and critical-score decisions remain available. CPU automatic mid-set coaching remains active in later sets.

Measured with the same deterministic seeds:

### 10 seasons after adjustment

- Seed A: 3.22 actions/week, max 11, 501 match commands, 146 mid-set decisions.
- Seed B: 3.23 actions/week, max 12, 514 match commands, 131 mid-set decisions.

### 30 seasons after adjustment

- Seed A: 3.26 actions/week, max 12, 1,528 match commands, 433 mid-set decisions.
- Seed B: 3.24 actions/week, max 12, 1,533 match commands, 393 mid-set decisions.

The adjustment reduces match commands by about 20-25%, mid-set stops by about 52-55%, and total authoritative actions by about 7-9% while preserving contextual coaching moments.

The 30-season save remained approximately 1.13 MB and produced no balance observations, so the pacing adjustment does not add save growth.

## Follow-up

Continue to use the pacing metrics to identify:

- excessive action density
- event saturation
- match congestion
- save growth
- repeated low-value interactions

Further simplification should be justified by measured interaction cost rather than by adding another permanent screen.
