# Phase20 Rivalry, Legacy & Team Relationships Design

Date: 2026-09-14
Status: Approved after implementation review
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
- Practice planning already tracks recent completed practice opponents and generates incoming/outgoing candidates deterministically.
- The school screen already has a `records` tab and the PVE pre-match flow already has `PreMatchLineupScreen`; Phase20 extends those existing surfaces instead of adding another top-level navigation destination.

Phase20 extends these foundations instead of introducing parallel history systems.

## Global Constraints

- Preserve save schema version 8. New weekly-schedule fields required only for offer accounting must be optional/backward-compatible and normalize to empty defaults for old saves.
- Preserve deterministic behavior under the same seed/state.
- Preserve PvP authority, privacy, reconnect, and idempotency contracts.
- Do not add hidden stat bonuses for rival matches.
- Incoming practice offers: maximum two surfaced/generated offers per calendar month.
- User-initiated outgoing practice requests are not limited by the new monthly incoming-offer cap.
- Avoid CI noise: each PR must pass focused verification before ordinary PR CI becomes the first full gate.

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

Presentation-level labels are derived from objective evidence:

- `宿敵` — current `destinyRivalSchoolId`
- `因縁` — meaningful rivalry score below destiny-rival status; initial presentation threshold is 40 and may be tuned only with focused tests
- `天敵` — at least 4 meetings, user win rate at or below 25%, and an active losing streak of at least 2
- `雪辱戦` — previous meeting was a user loss
- `連勝中` / `連敗中` — current streak of at least 2

Labels are presentation logic, not persisted save data. `宿敵` takes precedence over `因縁`; contextual labels such as `雪辱戦` and streaks may coexist.

### School legacy

Extend the existing school `records` tab with a derived legacy presentation combining existing historical stores:

- best official tournament results by year
- national titles / official win-loss data already stored on schools
- user school head-to-head table
- strongest rivalry records available from match history
- recent notable matches

Phase20 does not reconstruct unavailable point-by-point or historical strength data. “Notable match” ranking may use only facts actually persisted in the historical match summary and current rivalry store, such as:

- official/tournament importance
- close set score
- rivalry score / destiny-rival status
- repeat-meeting or revenge context derivable from match ordering

Do not infer an old upset from current-day school strength or reputation.

### Match presentation integration

Before a PVE match, show compact context in the existing pre-match screen when meaningful:

- previous result
- lifetime record
- current streak
- rival/destiny-rival label
- revenge context

Do not expose this in PvP unless the data is already part of the established public contract. Neutral first-time PVE opponents should remain compact.

## Track 2: Player Concern Guidance

### Current problem

Concerns are currently derived correctly but surfaced only as label + severity. The user cannot see the trigger, the resolution rule, or progress.

### Concern guidance selector

Add a pure concern-presentation selector returning:

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
- `injury-overuse`: explain that the injured player still has recent official usage; stop official-match use while injured and let the rolling usage window recover.
- `team-slump`: show the active three-match official losing streak; winning an official match breaks the condition.

Avoid promising an exact number of future matches when the rolling-window implementation does not guarantee it. Show the actual tracked numerator/denominator where applicable.

### Resolution feedback

When a weekly dynamics update removes one or more previous concerns, append a compact notification identifying the player and resolved concern.

Resolution notifications must be generated by diffing the concern map immediately before and after that authoritative weekly dynamics progression. A single weekly progression may emit multiple resolved-concern notifications, but the same `(playerId, concernCode, week)` must not be emitted twice by retries/re-entry.

Do not persist a second concern-history subsystem solely for presentation.

### UI

The team dynamics screen shows:

- concern title
- reason
- actionable resolution text
- progress
- severity
- improving/needs-action state

The screen must no longer leave the user guessing what to do.

## Track 3: Practice Offer Quality

### Why an offer ledger is required

`recentPracticeMatches` contains completed practice matches only. It cannot reliably enforce either the monthly cap or same-school offer cooldown because a declined offer would disappear without a trace.

Add a small bounded incoming-offer ledger to `WeeklyScheduleState`, for example:

```ts
interface IncomingPracticeOfferHistoryEntry {
  schoolId: SchoolId;
  surfacedDate: GameDate;
}

interface WeeklyScheduleState {
  // existing fields...
  incomingPracticeOfferHistory?: IncomingPracticeOfferHistoryEntry[];
}
```

Compatibility rules:

- old saves with the field absent normalize to `[]`
- retain only the latest 32 surfaced incoming offers
- a ledger entry is appended exactly when a non-null incoming offer is generated for the next weekly schedule
- accepting or declining does not create another ledger entry
- outgoing requests never write this ledger
- schema version remains 8 because the field is optional/backward-compatible and receives a default during state normalization

### Incoming offer cadence

Incoming offers are capped at two surfaced/generated offers per calendar month.

Rules:

- calendar month key is derived from the offer `GameDate` (`YYYY-MM`)
- count ledger entries for that calendar month
- no third incoming offer may be generated in the same month
- count offers even when later declined
- official-match blocking rules remain unchanged
- deterministic under the same seed/state

### Opponent diversity

Incoming selection should prefer:

1. schools not offered recently
2. schools not met recently in completed practice matches
3. schools never met in recent practice history
4. schools with meaningful rivalry/history context after cooldown
5. a mix of comparable, stronger, and challenge opponents appropriate to school reputation

Hard repeat rule:

- do not surface an incoming offer from the same school within the prior 8 weekly progression windows when at least one eligible alternative exists
- if the eligible alternative pool is empty, relax the hard guard but retain a strong repeat penalty

The current strength-targeting behavior remains useful but must no longer dominate diversity so strongly that the same few schools recur.

### Rival-aware offers

A rival school receives a bounded intentional weight boost only after satisfying the same cooldown. This enables context such as “因縁の相手から練習試合の申し込み” without creating spam.

Rival weighting must never override the monthly cap or repeat cooldown.

### Outgoing requests

The user may continue to choose from outgoing candidates under the existing weekly scheduling rules. Phase20’s new `2/month` rule and incoming-offer ledger apply only to incoming offers.

## PR Decomposition

### PR20-1 — Rivalry & Legacy Foundation

- head-to-head selectors
- rival labels / notable-context selectors
- school records-tab legacy surface
- PVE pre-match rivalry context
- focused deterministic tests

### PR20-2 — Player Concern Guidance & Resolution

- pure guidance selector
- team-dynamics actionable UI
- concern-resolution notifications
- regression tests for all four concern codes

### PR20-3 — Practice Offer Cadence & Diversity

- optional bounded incoming-offer ledger with v8-compatible normalization
- incoming max two/month including declined offers
- same-school incoming 8-week cooldown
- diversity weighting
- rival-aware weighting
- outgoing-request behavior unchanged
- deterministic planning tests and long-run distribution evidence

## Acceptance Criteria

Phase20 is complete when:

1. repeated opponents produce readable lifetime records and rivalry context.
2. destiny rival and meaningful streak/revenge context are visible without altering match stats.
3. the existing school `records` tab presents head-to-head/legacy information without adding redundant navigation.
4. every current player concern tells the user why it exists and what action resolves it.
5. cleared concerns produce one readable resolution notification per resolved player/concern transition.
6. incoming practice offers never exceed two surfaced offers in a calendar month, including offers later declined.
7. the same school is not repeatedly surfaced inside the 8-week cooldown when alternatives exist.
8. repeated incoming opponents are materially reduced across deterministic long-run tests.
9. rival/history context can influence eligible incoming offers without creating spam.
10. outgoing practice requests are not subject to the incoming monthly cap or incoming ledger.
11. schema v8 remains compatible with old saves missing the new optional ledger.
12. focused tests, full `npm run verify`, official PR CI, squash merge, and exact main CI are GREEN for each PR.

## Non-goals

- No Phase21 personality/event-system expansion.
- No new selectable difficulty setting.
- No automatic substitution AI.
- No PvP contract changes.
- No full match-screen visual redesign; that remains the later presentation-focused phase.
