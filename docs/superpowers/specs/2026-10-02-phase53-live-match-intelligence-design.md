# Phase53 Live Match Intelligence / Result Review Design

Date: 2026-10-02

## Goal

Make match decisions evidence-based during play and make the completed-match screen useful for reviewing the user's team.

Phase53 connects the existing Phase52 opponent-target commands with observed match data. It must not reveal future simulated events or private PvP information.

## Product principles

1. The player remains the coach. Suggestions never execute commands automatically.
2. Live analysis uses only play that has already been revealed in the UI.
3. Pre-match hidden/derived opponent intelligence remains Phase51 National Data Bank / analysis-room territory.
4. Match-complete review prioritizes the user's team: result, team grade, team stats, player grades, and player stats.
5. The existing coaching-command history remains available internally for diagnostics but is removed from the completed-match UI.
6. No save-schema expansion. Phase53 data is derived from the existing bounded match event log.
7. Mobile-first: 390px is the primary review width; 320/360/414/480px remain acceptance widths.

## Live match intelligence

### Observed-data boundary

Every live calculation receives an explicit visibleEventSequence. Events with a greater sequence are ignored even if the simulation has already generated them.

This is a hard anti-spoiler invariant.

### Derived signals

The first release derives:

- recent point flow from the latest five observed points
- user's hot attacker from observed attack attempts and attack points
- opponent dangerous attacker from observed attack attempts and attack points
- opponent receiver under pressure from observed receive attempts and perfect-receive rate

Suggestions require minimum samples so a single lucky play does not generate a strong recommendation.

### Suggested actions

Signals may suggest, but never execute:

- timeout
- focus-attacker
- mark-opponent-attacker
- target-serve-receiver

Phase52 command validation remains authoritative.

### Performance

Live intelligence must be a single pass over the visible event log plus bounded player sorting. It is recomputed only when the visible event sequence or relevant match state changes.

No server round-trip is added for the presentation calculation.

## Completed-match screen redesign

### Information order

1. Result hero
   - win/loss
   - set score
   - per-set score
   - user's overall match grade and numeric score
   - compact Team MVP
2. Team evaluation strip
   - overall
   - attack
   - block/defense
   - serve
   - receive
3. Team box score
   - compact user vs opponent comparison
4. Player performance
   - user's players only by default
   - compact mobile cards, not a horizontally scrolling table
   - grade + numeric score
   - points, ATT, BLK, ACE, REC
   - low-sample players show unrated / -- instead of an artificial poor grade
5. Existing post-match growth flow
6. Result actions

### Remove from result UI

- Coaching log / 監督采配 section

The command history remains in match runtime/event-derived data for diagnostics and future coaching evaluation.

### Player evaluation

Evaluation is position-aware:

- OH: scoring, attack efficiency, receive contribution
- OP: scoring, attack efficiency, block contribution
- MB: block contribution, attack efficiency
- S: team attack outcome, defense contribution, direct scoring where present
- L: receive/defense contribution

Participation/sample volume must influence confidence, not punish low-minute substitutes.

### Team evaluation

The user's match grade is based on observed match performance, result, and opponent-strength context. Winning is meaningful but not sufficient on its own for a top score.

Displayed grade scale: S / A / B / C / D / E / F.

## PvP privacy

PvP live analysis may use only public opponent identities and already-observed public match events. It must not expose private player IDs, abilities, fatigue, condition, potential, traits, selections, or runtime internals.

Phase52 public opponent IDs remain the targeting boundary.

## PR split

- PR53-1: observed-stat aggregation foundation + anti-future-leak tests
- PR53-2: bench report UI + assistant-coach suggestions
- PR53-3: completed-match screen redesign + team/player ratings + remove coaching-log UI
- PR53-4: PvP/official/invitational integration, responsive E2E, performance and regression gates

## Acceptance

- no live stat includes event.sequence > visibleEventSequence
- suggestions are factual and sample-gated
- no save migration
- no new persistent match-history growth
- 390px result screen has no horizontal scroll, clipped text, or fixed-action overlap
- 320/360/390/414/480px critical paths remain usable
- existing official, practice, invitational and PvP match flows remain valid
