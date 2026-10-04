# Phase57-4 Long-session pacing audit — Results

Date: 2026-10-04

## Decision

The current long-session loop is not primarily suffering from empty-week streaks or a lack of event variety.

The next gameplay improvement should focus on **consequence depth and strategic carry-over**, not simply increasing event frequency.

## Method

The existing production-compatible deterministic soak driver was extended with read-only pacing diagnostics.

Measured progression interactions include:

- event choices
- user-match coach commands
- week advancement

Automated soak management purchases are excluded from pacing density.

Matches are counted only when the user school participates. Match detection compares match IDs so the 500-entry bounded history does not undercount after retention is full.

## 10-season results

### phase18-release-a

- seasons: 10
- weeks: 522
- average progression actions: 2.90 per week
- maximum progression actions in one week: 12
- quiet weeks: 209 (40.0%)
- longest quiet streak: 4 weeks
- interactive weeks: 313
- event weeks / resolved events: 228 / 228
- unique event IDs: 103
- user match weeks / user matches: 146 / 146
- most repeated event: `event.rival-rematch` ×7
- final save size: 1,039,723 bytes
- balance observations: 0

### phase18-release-b

- seasons: 10
- weeks: 522
- average progression actions: 2.89 per week
- maximum progression actions in one week: 13
- quiet weeks: 215 (41.2%)
- longest quiet streak: 4 weeks
- interactive weeks: 307
- event weeks / resolved events: 223 / 223
- unique event IDs: 103
- user match weeks / user matches: 143 / 143
- most repeated event: `event.camp-block-film` ×6
- final save size: 1,048,173 bytes
- balance observations: 0

## 30-season result

Seed: `phase18-release-a`

- seasons: 30
- weeks: 1,566
- average progression actions: 2.96 per week
- maximum progression actions in one week: 13
- quiet weeks: 638 (40.7%)
- longest quiet streak: 4 weeks
- interactive weeks: 928
- event weeks / resolved events: 668 / 668
- unique event IDs: 146
- user match weeks / user matches: 443 / 443
- most repeated event: `event.captain-discipline` ×17
- initial save size: 271,579 bytes
- final save size: 1,143,194 bytes
- maximum observed save size: 1,143,194 bytes
- balance observations: 0

## Findings

### 1. Empty-week repetition is bounded

Roughly 40% of weeks are quiet development weeks, but the longest consecutive quiet run is only four weeks across both 10-season seeds and the 30-season run.

The game is therefore not producing long stretches of nothing but repeated week advancement.

### 2. Event quantity is already high enough

The 30-season run resolves 668 events across 1,566 weeks.

Adding more generic random events would increase interruption frequency without addressing the deeper issue.

### 3. Event variety is healthy

The 30-season run surfaces 146 unique event IDs. The most repeated event appears 17 times, about 2.5% of all resolved events.

The primary monotony risk is therefore not one event dominating the catalog.

### 4. User-match cadence is substantial

The 30-season run records 443 user matches, about 14.8 matches per season.

This provides regular gameplay peaks without requiring additional tournament volume.

### 5. Save growth remains bounded

The 30-season snapshot grows from 271,579 bytes to 1,143,194 bytes, consistent with the existing bounded-history design and prior long-run verification.

Phase57 pacing diagnostics themselves add no persisted state.

## Next design target

Phase58 should deepen consequences rather than add more interruptions.

Recommended direction:

1. meaningful event choices create a small bounded short-term team condition
2. the condition lasts a limited number of weeks
3. it affects existing decisions such as training, fatigue, morale, tactical preparation, or scouting
4. Home shows only the currently relevant consequence
5. no unbounded event history or per-week permanent log is added

Examples:

- tournament preparation choice -> temporary analysis / fatigue trade-off
- rivalry response -> temporary morale / pressure state
- camp emphasis -> temporary training focus
- player concern decision -> short-term trust / role expectation

This connects existing events to future weeks and makes choices feel remembered without increasing event frequency.
