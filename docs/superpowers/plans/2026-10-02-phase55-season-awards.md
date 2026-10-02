# Phase55 Implementation Plan

## PR55-1 Annual award selection

1. Add pure season-award selector from user-school PlayerSeasonStats.
2. Add sample gates and deterministic tie-breaks.
3. Add MVP and specialist categories.
4. Add unit tests for low-sample exclusion, ties, and position-relevant selection.
5. Do not modify save schema or academic-year progression yet.

## PR55-2 Year-end integration

1. Resolve awards before seasonStats are cleared/reset at academic-year transition.
2. Append compact year-qualified award IDs to Player.career.awardIds.
3. Include award result in AcademicYearTransitionSummary for immediate UI only.
4. Ensure graduating-player summaries contain the newly earned awards.

## PR55-3 UX

1. Show annual awards during year-end transition.
2. Add named award history to player career details.
3. Keep 390px-first compact layout.

## PR55-4 Gate

1. 10/30-season soak.
2. Verify awardIds remain bounded by player career length.
3. Verify no duplicate annual award IDs.
4. Full persistence / mobile / regression gate.
