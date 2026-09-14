# Phase20 Rivalry, Legacy & Team Relationships Design

Date: 2026-09-14
Status: Approved
Base: `8e471383f3014f00dd45c8994ba54c7a66aa239d`

## Goal

Make long saves feel memorable by turning repeated opponents, school achievements, player concerns, and practice-match relationships into readable history and management decisions.

Phase20 has three coordinated tracks:

1. Rivalry & Legacy — head-to-head history, rival recognition, streaks, revenge context, school records, and notable-match presentation.
2. Player Concern Guidance — explain why a player is unhappy, what the user should do, whether resolution is progressing, and when the concern clears.
3. Practice Offer Quality — cap incoming practice offers at two per calendar month, reduce repeat opponents, and use rivalry/history to diversify offers while leaving user-initiated requests uncapped by this new monthly limit.

## Existing Foundations

- `GameState.history.matches` already stores the latest 500 match summaries.
- `world.rivalryScores` and `destinyRivalSchoolId` already exist and are updated by `recordMatchOutcome`.
- Team dynamics already derive four concern codes: `playing-time`, `role-mismatch`, `injury-overuse`, and `team-slump`.
- Practice planning already tracks recent practice opponents and generates incoming/outgoing candidates deterministically.

Phase20 extends these foundations instead of introducing a parallel history system.

## Global Constraints

- Preserve schema version 8 if implementation can derive all new presentation from existing persisted state. A schema bump requires separate review.
- Preserve deterministic behavior under the same seed/state.
- Preserve PvP authority, privacy, reconnect, and idempotency contracts.
- Do not add hidden stat bonuses for rival matches.
- Incoming practice offers: maximum two generated offers per calendar month.
- User-initiated outgoing practice requests are not limited by the new monthly incoming-offer cap.
- Avoid CI-noise: each PR must be locally/focused verified before ordinary PR CI is allowed to become the first full gate.

## Track 1: Rivalry & Legacy

### Head-to-head model

Create pure selectors derived from `history.matches` and `world.rivalryScores`.

For each opponent expose:

- total meetings
- wins / losses
- current win/loss streak
- last meeting result and date
- official-match meetings
- practice-match meetings
- rivalry score
- destiny-rival flag
- last five meetings

No duplicate persisted counters are required while these values can be derived cheaply from the bounded 500-match history.

### Rival labels

Presentation-level labels should be derived from objective evidence, for example:

- `因縁` — rivalry score crosses the established rivalry threshold
- `宿敵` — destiny rival
- `天敵` — meaningful sample plus poor user win rate / active losing streak
- `雪辱戦` — previous meeting was a user loss
- `連勝中` / `連敗中` — current streak

Exact wording is presentation logic, not save-schema data.

### School legacy

Add a school-history presentation that combines existing historical stores:

- best official tournament results by year
- national titles / official win-loss data already stored on schools
- user school head-to-head table
- longest active rivalry streaks available from match history
- notable milestones that can be objectively derived from bounded history

Phase20 does not attempt to reconstruct unavailable point-by-point history for old matches. “Notable match” ranking must use available facts such as tournament importance, close set score, upset context, rivalry score, and rematch context.

### Match presentation integration

Before a PVE match, show compact context when meaningful:

- previous result
- lifetime record
- current streak
- rival/destiny-rival label
- revenge context

Do not clutter every match. Neutral first-time opponents should remain compact.

## Track 2: Player Concern Guidance

### Current problem

Concerns are currently derived correctly but surfaced only as label + severity. The user cannot see the trigger, the resolution rule, or progress.

### Concern guidance selector

Add a pure concern-presentation selector returning a stable structure similar to:

```ts
interface PlayerConcernGuidance {
  code: PlayerConcernCode;
  severity: 1 | 2 | 3;
  title: string;
  reason: string;
  resolution: string;
  progressLabel: string;
  status: "needs-action" | "improving";
}
```

This is derived, not persisted.

Guidance rules:

- `playing-time`: show recent official starter usage and tell the user that official-match usage must recover above the concern threshold.
- `role-mismatch`: explain that a highly rated player is outside ace/starter role; using the player as a starter resolves the mismatch on the next dynamics evaluation.
- `injury-overuse`: explain that the injured player was still recently used; stop using the player in official matches while injured.
- `team-slump`: show the active three-match official losing streak; winning an official match breaks the condition.

Avoid promising an exact number of matches when the current rolling-window implementation does not guarantee an exact fixed count. Show the actual tracked numerator/denominator where applicable.

### Resolution feedback

When a weekly dynamics update removes one or more previous concerns, append a compact notification identifying the player and resolved concern.

Resolution notification generation must be idempotent for one weekly progression and must not persist a second parallel concern history solely for presentation.

### UI

The team dynamics screen should show:

- concern title
- reason
- actionable resolution text
- progress
- severity
- improving/needs-action state

The screen should no longer leave the user guessing what to do.

## Track 3: Practice Offer Quality

### Incoming offer cadence

Incoming offers are capped at two generated offers per calendar month.

Rules:

- count only incoming offers that were actually surfaced/generated, not user outgoing requests
- no third incoming offer may be generated in the same calendar month
- official-match blocking rules remain unchanged
- deterministic under the same seed/state

Prefer deriving monthly count from an existing bounded history/notification/schedule source if reliable. If no reliable existing source can distinguish generated incoming offers, add the smallest backward-compatible persisted counter and review schema compatibility before implementation.

### Opponent diversity

Incoming selection should prefer:

1. schools not met recently
2. schools never met in recent practice history
3. schools with meaningful rivalry/history context
4. a mix of comparable, stronger, and challenge opponents appropriate to school reputation

Add a hard repeat guard for incoming offers from the same school within approximately eight weeks when enough alternative schools exist. The guard may relax only when the eligible pool is too small.

The current strength-targeting behavior remains useful but must no longer dominate diversity so strongly that the same few schools recur.

### Rival-aware offers

A rival school may receive an intentional weight boost after enough cooldown, enabling messages such as “last year’s prefectural rival has requested a practice match.”

Rival weighting must not override the monthly cap or repeat cooldown.

### Outgoing requests

The user may continue to choose from outgoing candidates under the existing weekly scheduling rules. Phase20’s new `2/month` rule applies only to incoming offers.

## PR Decomposition

### PR20-1 — Rivalry & Legacy Foundation

- head-to-head selectors
- rival labels / notable-context selectors
- school-history UI surface
- pre-match rivalry context
- focused deterministic tests

### PR20-2 — Player Concern Guidance & Resolution

- pure guidance selector
- team-dynamics actionable UI
- concern-resolution notifications
- regression tests for all four concern codes

### PR20-3 — Practice Offer Cadence & Diversity

- incoming max two/month
- same-school incoming cooldown
- diversity weighting
- rival-aware weighting
- outgoing-request behavior unchanged
- deterministic planning tests and long-run distribution evidence

## Acceptance Criteria

Phase20 is complete when:

1. repeated opponents produce readable lifetime records and rivalry context.
2. destiny rival and meaningful streak/revenge context are visible without altering match stats.
3. every current player concern tells the user why it exists and what action resolves it.
4. cleared concerns produce a single readable resolution notification.
5. incoming practice offers never exceed two generated offers in a calendar month.
6. repeated incoming opponents are materially reduced across deterministic long-run tests.
7. rival/history context can influence eligible incoming offers without creating spam.
8. outgoing practice requests are not subject to the incoming monthly cap.
9. schema v8 remains compatible unless a separately reviewed blocker proves otherwise.
10. focused tests, full `npm run verify`, official PR CI, squash merge, and exact main CI are GREEN for each PR.

## Non-goals

- No Phase21 personality/event-system expansion.
- No new selectable difficulty setting.
- No automatic substitution AI.
- No PvP contract changes.
- No full match-screen visual redesign; that remains the later presentation-focused phase.
