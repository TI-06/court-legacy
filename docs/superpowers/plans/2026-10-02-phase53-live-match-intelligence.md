# Phase53 Implementation Plan

## PR53-1 Observed stats foundation

1. Extend match stat aggregation with an optional visible event boundary while preserving the completed-match default.
2. Add liveMatchIntelligence as a presentation-only derivation module.
3. Add recent-point flow and sample-gated player signals.
4. Add unit tests proving future events are ignored and suggestions are deterministic.
5. Run focused tests, typecheck, lint/format through CI.

## PR53-2 Bench report

1. Compute live intelligence from MatchScreen using visibleEventSequence.
2. Show at most three compact BENCH REPORT cards at coach-decision points.
3. Map suggestions to existing Phase52 command entry points without auto-execution.
4. Keep layout compact at 390px and avoid adding permanent vertical sections during normal playback.
5. Add interaction and privacy tests.

## PR53-3 Result review redesign

1. Add team match rating model.
2. Add position-aware player rating model and sample confidence.
3. Redesign MatchResultStats around result grade, compact awards, team stats, and user-player cards.
4. Remove completed-match 監督采配 UI while retaining underlying command history.
5. Preserve growth BottomSheet and fixed result actions.
6. Add responsive and semantic tests.

## PR53-4 Gate

1. Verify practice / official / invitational paths.
2. Verify PvP public-ID privacy.
3. Verify reload/resume behavior.
4. Run 320/360/390/414/480 responsive E2E.
5. Verify no meaningful performance regression from live derivation.
6. Run Phase16/51/52/53 regression suites and repository verify gate.
