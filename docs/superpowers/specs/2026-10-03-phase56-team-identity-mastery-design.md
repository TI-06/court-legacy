# Phase56 Team Identity / Mastery Design

Date: 2026-10-03

## Goal

Add a persistent team identity that makes long-term coaching choices feel coherent without duplicating the existing match-tactic system or introducing a hidden flat stat bonus.

## Why Phase56

Current main already contains the originally proposed match loop in earlier phases:

- Phase26: actionable pre-match opponent analysis
- Phase29: practice-result training recommendations
- Phase31: rivalry surfacing and rematches
- Phase53: live match intelligence and result review
- Phase54: player/school legacy records
- Phase55: annual awards

Phase56 therefore focuses on the remaining gap: a user-controlled long-term volleyball philosophy that connects those systems.

## Identity styles

- `quick-combination`: MB participation and fast-tempo offense
- `serve-block`: aggressive serve pressure plus commit blocking
- `defense-rally`: low-risk serve, read block, stable floor defense
- `ace-centered`: side-out offense centered on OH/OP scoring
- `balanced`: neutral all-around identity

## Mastery

Mastery is 0-100 and advances weekly. Tactical alignment changes only the speed of mastery gain.

- 0-29: forming
- 30-59: established
- 60-84: mature
- 85-100: signature

Changing identity resets `weeksInStyle` and clamps transferred mastery to 30. This prevents instant identity swapping from becoming an optimization exploit.

## Persistence

`TeamPlanningState.teamIdentity` is optional.

Older schema-v10 saves therefore remain valid and resolve to a balanced default without a schema bump. Persistence is added only when the user explicitly changes the identity or weekly progression materializes it.

## Match impact

PR56-1 intentionally adds **no match-strength modifier**.

Later Phase56 tasks may introduce a small bounded effect after deterministic balance testing. The existing player abilities, tactical matchup system, and team composition remain primary.

## Performance and save-size constraints

- one compact object in `teamPlanning`
- no new match logs
- no per-player identity history
- no unbounded arrays
- weekly progression is O(1)
- presentation derives labels from the compact state

## Planned PR split

1. PR56-1: identity types, compatibility fallback, alignment/mastery domain logic and tests
2. PR56-2: authoritative set-identity action and weekly progression integration
3. PR56-3: compact Team screen UI and Home summary
4. PR56-4: bounded gameplay effect plus tactical matrix / 30-season soak
