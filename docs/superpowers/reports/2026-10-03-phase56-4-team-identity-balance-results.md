# Phase56-4 Team Identity Match Effect — Verification

Date: 2026-10-03

## Scope

This report records the verification evidence for the bounded team-identity mastery effect.

The effect is intentionally PVE-only and opt-in at the match-engine call boundary. No PvP transport, save schema, player ability, growth, economy, or match-runtime persistence contract is widened.

## Implemented constraints

- specialist phase bonus: maximum +2.0 execution points
- balanced identity: maximum +0.8 execution points per supported phase
- mastery below 30: no match effect
- tactical alignment at or below 40: no match effect
- generic simulation without `identityMasterySchoolId`: unchanged
- PVE user team only: explicit opt-in from Worker practice / official / invitational paths
- no new persisted arrays or event-log entries

## Verification

- [x] focused identity-domain tests
- [x] generic/PvP isolation regression
- [x] practice/official/invitational Worker regression
- [x] full `npm run verify`
- [x] mobile E2E
- [x] deterministic Phase56 identity matrix
- [x] existing Phase19 tactical matrix
- [x] 30-season long-run save/progression regression

## Phase56 identity matrix

The original 160-match sample was too noisy for a deliberately small effect, so the final gate uses **2,000 matches per series**. The harness reuses one standardized world per series so the larger sample remains fast and deterministic.

- baseline equal-strength win rate: 50.0%
- aligned mastery 100 win rate: 53.1%
- aligned mastery 100 delta: **+3.0 percentage points**
- mismatched mastery delta: **0.0 percentage points**
- mastery 100 vs opponent +8 ability: **23.8% user win rate**

The identity effect is therefore visible but remains materially weaker than roster strength.

## Existing Phase19 tactical matrix regression

- neutral: 50%
- favorable tactics: 57%
- unfavorable tactics: 46%
- stronger roster despite tactical disadvantage: 82%
- plan average, balanced: 51%
- plan average, quick: 46%
- plan average, side: 51%
- CPU counter, Tier0 / Tier3: 50% / 56%
- CPU neutral, Tier0 / Tier3: 50% / 50%

Phase56 does not erase the existing tactical matchup model or create a dominant identity path.

## 30-season long soak

Both canonical long-soak seeds completed **30/30 seasons and 1,566 weeks**.

### phase18-release-a

- actions: 5,516
- final team strength: 93
- national field p50 / p90: 87 / 102
- save bytes: 271,579 -> 1,142,173
- observed maximum save bytes: 1,142,705
- progression observations/errors: 0

### phase18-release-b

- actions: 5,407
- final team strength: 96
- national field p50 / p90: 87 / 106
- save bytes: 271,334 -> 1,142,618
- observed maximum save bytes: 1,142,618
- progression observations/errors: 0

Phase56 adds only one compact bounded identity object, so the long-run save-size curve remains driven by pre-existing career/history data rather than identity mastery.

## Decision

Keep the Phase56-4 coefficients as implemented:

- specialist max: +2.0 execution points
- balanced max: +0.8 execution points
- no effect below mastery 30
- no effect when tactical alignment is <= 40

No further strength increase is justified by the matrix.


## Measured matrix

160 matches per series, mirrored home/away:

- baseline equal-strength win rate: 50.0%
- aligned mastery 100 win rate: 53.1%
- aligned mastery delta: +3.1 percentage points
- mismatched mastery delta: 0.0 percentage points
- mastery 100 against +8 ability opponent: 23.8% win rate

These results satisfy the Phase56-4 acceptance targets: mastery is visible but subordinate to roster strength, and contradictory tactics erase the advantage.
