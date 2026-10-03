# Phase56-2 Team Identity Progression Implementation

Date: 2026-10-03

## Goal

Connect the Phase56 team-identity domain model to authoritative game actions and the normal game-week progression path.

## Implemented boundaries

- `set-team-identity` is validated by the Worker action schema.
- Identity changes are applied through the same authoritative game-action path as tactics and team planning.
- Changing identity does not rewrite the currently selected match tactics.
- `advanceGameWeek` progresses identity mastery exactly once after normal weekly player progression and before tournament advancement.
- Legacy saves with no `teamPlanning.teamIdentity` materialize the balanced fallback only when weekly progression first touches the identity.
- Existing schema version remains unchanged.
- Existing section-delta save infrastructure persists the compact `teamPlanning` change; no new save protocol is introduced.

## Verification

Focused tests cover:

1. canonical identity styles accepted by the Worker schema;
2. invalid identity values rejected;
3. authoritative identity persistence;
4. current tactics unchanged by identity selection;
5. schema version unchanged;
6. aligned weekly tactics increase mastery;
7. weekly progression increments `weeksInStyle` exactly once;
8. legacy-save fallback remains safe and immutable to the input state.

## Deferred

Phase56-3 owns the mobile UI for choosing and reviewing the identity.
Phase56-4 owns any bounded match effect and must pass deterministic tactical / long-run balance gates before an effect is enabled.
