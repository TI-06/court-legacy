# Phase60-3 — Score celebration on the authoritative 2D court

## Scope

Show a brief, compact celebration overlay **only when a point event is revealed**. Use existing `MatchEvent.detailCode` values to distinguish spikes, blocks, aces, and digs. A generic point event has a generic label. No lookahead into future events is allowed.

The effect animates only during playback and respects both user reduced-motion and OS `prefers-reduced-motion`. No server actions, match rules, save fields, dependencies, or data transfers are added.

## Special-ability limitation

Existing special abilities contribute to the hidden match calculation, but the match event log does not contain a specific authoritative `special-ability-activated` event. This phase therefore **does not claim or fake special-ability activations**. Such an effect requires an explicit, server-produced activation event and a separate consistency/privacy review.

## Verification

Point vs nonpoint reveal, valid side and point kind, reduced motion, skipping and mobile E2E.
