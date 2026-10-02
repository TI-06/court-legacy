# Phase54 Implementation Plan

## PR54-1 Career record presentation

1. Add pure player-career presentation helpers and labels.
2. Add 成績 to PlayerDetailTabs.
3. Render official career totals in the selected-player detail view.
4. Add compact mobile styles.
5. Add presentation and UI tests.
6. Run repository verify and mobile E2E before merge.

## PR54-2 Current-season leaderboard

1. Add an optional current-season official-stat accumulator to Player.career.
2. Update it only through authoritative official-match recording.
3. Reset lazily by academic year so no annual bulk rewrite is required.
4. Build deterministic user-school TOP3 selectors with sample gates for rates.
5. Add a compact 今季成績 BottomSheet to Player Hub.
6. Drill ranked players into the 成績 detail tab and separate 今季 / 通算.
7. Add save-compatibility, recording, selector, and UI tests.
8. Run repository verify and mobile E2E before merge.

## Guardrails

- PR54-1 has no schema change
- PR54-2 adds only an optional bounded current-season field; no schema-version bump
- no modification to match simulation
- official stat recording remains the sole writer
- no practice/invitational totals relabeled as official career or season results
- no per-match season-stat history
