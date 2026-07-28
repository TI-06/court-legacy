# Deterministic Match Engine Design

## Scope

Implement the first playable volleyball match engine as a pure domain service. It consumes a `GameState`, two valid `TeamSelection` values, a match format, and a seeded random source. It returns a complete `MatchState` and an explainable `MatchAnalysis` without mutating any input.

## Rally pipeline

Each rally records the following phases where applicable:

1. serve;
2. receive;
3. set;
4. attack;
5. block or dig;
6. point;
7. rotation when the receiving team wins the rally.

Serve errors and aces may end a rally before later phases. Every completed rally produces exactly one point event.

## Team strength

Rally probability uses the selected players only and combines:

- serve, receive, set, spike, block, speed, decision, and mental abilities;
- current condition and fatigue;
- position aptitude;
- school tactics such as serve risk, attack tempo, attack distribution, block system, and defense bias;
- coach tactics and leadership.

All probabilities are clamped so weaker teams retain an upset chance while strong teams remain meaningfully favored.

## Volleyball rules

- Best-of-three matches end when one school wins two sets.
- Best-of-five matches end when one school wins three sets.
- Normal sets are played to 25 points and require a two-point lead.
- The deciding set is played to 15 points and requires a two-point lead.
- The first server alternates by set.
- A receiving team that wins a rally rotates before its next serve.
- Rotation updates both rotation slots and serving order.

## Determinism

The engine uses `SeededRandom`. The same state, selections, seed, and starting cursor must produce the same scores and event log. The returned match stores the consumed random cursor.

## Match analysis

Analysis summarizes the winner and produces factors for serve pressure, attack efficiency, blocking/defense, and physical condition. Recommendations are generated from the losing side's weakest differentials.

## Verification

Tests cover:

- best-of-three and best-of-five completion;
- set target and two-point lead rules;
- deterministic replay;
- one point event per rally and contiguous event sequences;
- side-out rotation events;
- stronger lineup advantage over a fixed seed suite;
- no input mutation;
- explanatory analysis output.
