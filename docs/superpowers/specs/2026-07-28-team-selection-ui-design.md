# Team Selection Mobile UI Design

## Goal

Expose the M1 team-selection domain through the mobile-first Team tab. The screen must let the player inspect and adjust the six-player rotation, libero, bench, starter locks, and safety substitution preferences without producing an invalid lineup.

## Screen flow

1. Open the Team tab.
2. Review the six numbered rotation slots and libero.
3. Use automatic selection or change one active player at a time.
4. Mark active players as starter locks.
5. Configure injury and severe-fatigue benching.
6. Apply safety adjustment and review any replacement explanations.

## Interaction rules

- Active-player selects disable players already active in another slot.
- Replacing a rotation or libero player moves the outgoing player to the bench and removes the incoming player from the bench.
- The serving order follows the six rotation slots.
- Starter locks can be toggled for rotation players and the libero.
- Automatic selection rebuilds a valid lineup from the current GameState.
- Safety adjustment uses `resolveLockedStarters` and displays injury/fatigue replacement reasons.
- The parent App owns the selection so it survives tab changes.

## Mobile layout

- Summary card with active, bench, locked, and warning counts.
- Compact numbered rotation cards with player selector, position, fatigue, condition, and lock toggle.
- Separate libero card.
- Collapsible-looking bench roster grid without horizontal scrolling.
- Safety settings as touch-friendly switch rows.
- Sticky actions are avoided because the application already has a sticky bottom navigation.

## Verification

- Six rotation selectors and one libero selector are rendered.
- All twelve school players remain represented exactly once across active and bench roles.
- Automatic selection and manual replacement preserve a valid selection.
- Starter-lock and safety settings persist when changing tabs.
- 390px mobile E2E completes without horizontal overflow.
