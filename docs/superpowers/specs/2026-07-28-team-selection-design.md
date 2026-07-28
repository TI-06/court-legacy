# Team Selection Design

## Scope

Implement the M1 team-selection domain used before practice matches and official matches. A valid selection contains six unique rotation players, one optional libero outside the rotation, a non-overlapping bench, a serving order matching the six rotation players, and a substitution policy.

## Automatic selection

The automatic selector builds a balanced volleyball lineup from the selected school's available roster. It prioritizes one setter, two middle blockers, two outside hitters, and one opposite using position aptitude, role-relevant abilities, condition, and fatigue. It then chooses the best remaining libero candidate and places every other school player on the bench.

## Starter locks

A starter lock is a preference, not an unconditional safety override. Locked players remain in the rotation when eligible. When `allowInjuryBenching` is enabled, an injured locked player may be replaced. When `allowFatigueBenching` is enabled, a player at or above the severe-fatigue threshold may be replaced. The resolver returns replacement reasons so the UI can explain the decision.

## Validation

Validation is pure and checks all issues before state mutation:

- rotation contains slots 1 through 6 exactly once;
- rotation players are unique;
- all referenced players exist and belong to the school;
- libero does not overlap the rotation;
- bench does not overlap the rotation or libero and has no duplicates;
- serving order contains the same six unique players as the rotation;
- starter locks reference players present in the rotation, libero, or bench.

## Testing

Tests cover valid and invalid lineups, automatic role coverage, deterministic ordering, starter-lock preservation, injury and fatigue exceptions, insufficient eligible rosters, immutability, and stable explanatory replacement logs.
