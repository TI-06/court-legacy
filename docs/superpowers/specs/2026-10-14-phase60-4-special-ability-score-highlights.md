# Phase60-4: Authoritative special ability scoring highlights

The match engine already applies passive and contextual special ability
modifiers. Phase60-4 records at most **one positive ability that actually
contributed** to an ace, spike, block or defensive point, selected from the
scoring player's owned abilities.

- Skill selection derives from existing real modifier rules, respecting
  conditional trigger conditions and capped stats. Serve adjustments are included.
- Match RNG and score calculation are untouched; highlights are computed only
  after existing scoring players are chosen, and stored as an optional
  `MatchEvent.scoringSpecialAbilityId` on a point event.
- No new event type is added: timestamps, event order, point flow and match
  skipping stay unchanged. No GameState schema version change.
- Presentation shows a short skill badge when that point is revealed, never
  before, and respects the reduced motion settings.
- Passive contributions are labeled `発揮`, not falsely advertised as a
  probabilistic special attack. Negative penalties are not celebratory.

Tests cover normal, contextual, rare skill selection, capped
abilities, old event logs, no lookahead, deterministic replay and playback.
