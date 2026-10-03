# Phase56-4 Team Identity Match Effect

Date: 2026-10-03

## Goal

Give long-term team philosophy mastery a small, readable PVE match effect without turning identity into a hidden raw-stat bonus or changing PvP behavior.

## Scope

Phase56-4 adds a bounded execution bonus to the user's PVE team only.

- PvP: unchanged
- CPU schools: unchanged
- persisted player abilities: unchanged
- growth / economy: unchanged
- match tactic public contract: unchanged
- save schema version: unchanged

## Effect model

Identity mastery never applies as a flat all-stat multiplier.

The active identity grants a small execution bonus only to the phases that represent that style:

- quick-combination: set / attack
- serve-block: serve / block
- defense-rally: receive / dig
- ace-centered: attack
- balanced: small bonus across serve / receive / set / attack / block / dig

The bonus is derived from both mastery and current tactical alignment.

### Mastery factor

- below 30: 0
- 30-59: ramps from 0 to 0.6
- 60-84: ramps from 0.6 to 0.85
- 85-100: ramps from 0.85 to 1.0

### Tactical alignment gate

Alignment below 40 gives no bonus.

Above 40, the bonus scales with alignment. A highly mastered identity used with contradictory tactics therefore provides little or no advantage.

### Maximum magnitude

- specialist identity: maximum +2.0 execution points on its supported phases
- balanced identity: maximum +0.8 execution points per supported phase

This is intentionally much smaller than the existing attack/block tactical matchup value (±12).

## Authority and PvP isolation

The generic match engine receives an optional `identityMasterySchoolId`.

Only PVE Worker paths pass the user's school ID:

- practice match
- official tournament match
- invitational cup match

PvP paths do not pass the option, so identity mastery cannot affect PvP or widen the PvP snapshot contract.

## Resumability

The option is supplied again on every authoritative resume. It is not persisted in `MatchRuntimeState`, avoiding save growth and active-match schema changes.

The effect is recomputed from:

- authoritative game state
- current runtime tactics projected into the simulation state
- current team identity mastery

This means mid-match tactical changes immediately affect alignment while remaining deterministic.

## Balance acceptance targets

Deterministic matrix / soak must show:

1. mastery 0 vs mastery 100 does not create more than a 5 percentage-point win-rate swing in equal-strength representative matchups
2. aligned mastery 100 is measurably better than aligned mastery 0
3. mismatched mastery 100 is approximately neutral
4. +8 to +10 raw team ability remains decisively stronger than an identity advantage
5. PvP baseline tests are bit-for-bit unchanged
6. no additional persisted arrays or match logs are introduced

## Implementation order

1. pure execution-bonus helper + unit tests
2. optional match-engine opt-in
3. PVE Worker wiring
4. PvP isolation regression
5. deterministic tactical/identity matrix
6. 10/30-season regression
