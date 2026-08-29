# Phase 7 Team Dynamics & Leadership Design

## Goal

Turn the existing morale, trust, player relationships, leadership, team adaptation, and captain-career data into a coherent management loop without overpowering player ability or breaking ranked PvP fairness.

The Phase 7 loop is:

`training -> lineup/role -> morale & trust -> cohesion -> official match -> result/usage feedback -> relationships -> next week`

Phase 7 must deepen the existing endless high-school generation loop rather than introduce a separate game mode.

## Scope

Phase 7 includes:

- user-school captain and vice-captain assignments
- deterministic captain suitability scoring
- server-derived player roles based on actual roster strength and recent official usage
- player concerns caused by role/usage mismatch, injury handling, and team outcomes
- team cohesion 0..100 with an explainable trend
- bounded morale/trust changes from weekly progression and official match results
- small bounded training modifiers from morale/trust
- small bounded PvE official-match modifiers from cohesion/morale
- meaningful presentation of player relationships without exposing a full relationship matrix
- schema v4 migration from Phase 6 schema v3
- annual leadership cleanup and reassignment requirements after graduation
- mobile UI for team state, leadership, concerns, and relationship highlights
- 30-year deterministic and 100-year soak validation
- explicit ranked PvP isolation

Phase 7 does not include:

- transfers
- free-form player conversations
- contractual playing-time promises
- bullying or severe interpersonal-content systems
- individual tournament awards or best-six/MVP
- alumni hall of fame
- 47 permanently simulated prefectures
- ranked PvP dynamics modifiers
- monetization changes

## Existing Data Reused

The implementation must reuse current fields where possible:

- `Player.morale`
- `Player.trust`
- `Player.personalityId`
- `Player.leadership`
- `Player.teamAdaptation`
- `Player.career.captainSeasons`
- `GameState.playerRelationships`
- player official career appearances and sets from Phase 6
- school coach leadership/development/tactics
- current lineup and official-match history

No duplicate morale, trust, relationship, or leadership stats are introduced.

## Domain Model

### Team Dynamics State

Add a user-school-only persisted object:

```ts
export type PlayerRole =
  | "ace"
  | "starter"
  | "rotation"
  | "development"
  | "reserve";

export type CohesionTrend = "rising" | "stable" | "falling";

export type PlayerConcernCode =
  | "playing-time"
  | "role-mismatch"
  | "injury-overuse"
  | "team-slump";

export interface PlayerConcern {
  code: PlayerConcernCode;
  severity: 1 | 2 | 3;
}

export interface TeamDynamicsState {
  captainPlayerId: PlayerId | null;
  viceCaptainPlayerId: PlayerId | null;
  cohesion: number;
  previousCohesion: number;
  cohesionTrend: CohesionTrend;
  playerRoles: Partial<Record<PlayerId, PlayerRole>>;
  playerConcerns: Partial<Record<PlayerId, PlayerConcern[]>>;
  lineupContinuity: number;
  recentOfficialStarterCounts: Partial<Record<PlayerId, number>>;
  recentOfficialMatchesTracked: number;
}
```

Only the user's school persists this detailed state. NPC schools continue using their existing lightweight school/player state.

### Leadership Suitability

Leadership suitability is deterministic and derived from current player state:

- leadership: 40%
- mental: 20%
- trust: 15%
- morale: 10%
- teamAdaptation: 10%
- grade bonus: 5%

Grade bonus:

- grade 3: 100
- grade 2: 70
- grade 1: 25

The final public score is rounded and clamped to 0..100.

Captain and vice-captain must:

- belong to the user school
- be current roster players
- be distinct
- not be graduated/stale IDs

The browser may submit player IDs but never scores or effects.

### Player Roles

Roles are server-derived; the browser cannot set them.

A normalized player power score is used with current official usage:

- top one eligible player by power: `ace`
- current starting rotation/libero and other top first-unit players: `starter`
- meaningful recent official use but outside first unit: `rotation`
- grade 1/2 players with low current usage and reasonable future value: `development`
- otherwise: `reserve`

Exact tie-breaking is deterministic by player ID.

The implementation must avoid role churn from a single match by using a bounded recent official-match window of 8 matches.

### Player Concerns

Concerns are derived, not manually edited.

`playing-time`:
- high-power `ace`/`starter` expectation with materially low recent official usage

`role-mismatch`:
- strong player classified below expected tier for at least the tracked window threshold

`injury-overuse`:
- injured player appears in an official match

`team-slump`:
- user school loses at least 3 consecutive official matches in tracked history

Severity is 1..3 and must be deterministic.

Concerns influence weekly morale/trust adjustments but do not directly modify base abilities.

## Cohesion

Cohesion is recalculated from server-authoritative state and clamped to 0..100.

Target composition:

- average morale: 25%
- average trust: 20%
- average pair relationship signal: 20%
- captain suitability: 15%
- vice-captain suitability: 5%
- average team adaptation: 10%
- lineup continuity: 5%

Relationship calculation must be bounded and sparse-safe. Missing relationship entries are treated as neutral 50, not zero.

`lineupContinuity` is 0..100 and reflects how consistently the recent official starting group is used.

Cohesion trend compares current cohesion with previous cohesion:

- difference >= 3: `rising`
- difference <= -3: `falling`
- otherwise: `stable`

## Weekly Dynamics Progression

Weekly progression runs after weekly training resolution and before advancing to the next playable week state.

Rules:

- apply deterministic concern-based morale/trust changes
- mild natural recovery toward neutral for players without concerns
- never allow morale/trust outside 0..100
- recalculate roles and concerns
- recalculate cohesion and trend

Concern penalties are intentionally small. A single normal week cannot change morale or trust by more than 4 points from dynamics progression.

## Training Effect

Training remains dominated by the existing factors.

Add two growth modifiers:

- morale modifier: 95%..105%
- trust modifier: 95%..105%

Mapping is centered around 50. Values below 50 reduce growth; above 50 increase it. Combined dynamics training influence must remain bounded and cannot bypass the existing academic restriction.

This requires extending the existing growth modifier code union rather than creating a parallel growth calculator.

## PvE Match Effect

Official PvE matches may receive a small dynamics readiness multiplier.

Maximum total effect from dynamics is bounded to approximately -5%..+5% on mental/decision/consistency-like readiness. It must not directly add raw spike/jump/serve/block points.

The match engine continues to use player ability, condition, fatigue, injury, tactics, and coach as primary determinants.

The dynamics match modifier is server-derived from current user-school state.

## Ranked PvP Isolation

Ranked PvP must not use or expose live user dynamics.

Requirements:

- `TeamDynamicsState` is excluded from PvP public DTOs
- morale/trust/relationship concerns are not added to frozen ranked snapshots beyond fields already intentionally present in existing snapshot contracts
- no cohesion multiplier is applied in ranked PvP simulation
- shop transient effects remain excluded as in Phase 5
- no browser-supplied cohesion or leadership score is accepted

PvE and ranked PvP therefore remain intentionally different:

- PvE official matches include current team management state
- ranked PvP compares frozen competitive roster strength without transient dynamics bonuses

## Server Actions

Add one explicit browser action for leadership assignment:

```ts
{
  type: "set-team-leadership";
  captainPlayerId: string;
  viceCaptainPlayerId: string;
}
```

The worker validates ownership, roster membership, distinct IDs, revision, and exact-once operation semantics through the existing game action pipeline.

No browser action exists for setting cohesion, roles, concerns, morale, trust, or relationship values directly.

Errors:

- `team_leadership_invalid_captain`
- `team_leadership_invalid_vice_captain`
- `team_leadership_same_player`

## Annual Progression

At academic-year rollover:

1. graduates are removed by the existing roster flow
2. stale captain/vice-captain IDs are cleared
3. `captainSeasons` increments once for the player who actually completed the academic year as captain
4. recent official usage window resets
5. roles/concerns are rebuilt for the new roster
6. cohesion is recalculated from the new roster
7. leadership may remain vacant until user assignment; no automatic assignment is required for the user's school

A vacant captain position lowers only the leadership component of cohesion; it never blocks week progression or official matches.

## UI

### Home

Add a compact team-state card:

- cohesion value and label
- trend
- captain name or `未設定`
- number of players with concerns

### Player Detail

Add:

- morale
- trust
- current derived role
- captain/vice-captain badge
- up to two concern summaries
- up to two relationship highlights

Do not show hidden relationship numbers by default; use qualitative labels.

### Team Screen

Add a third tab: `チーム状態`.

Contents:

- cohesion and trend
- captain and vice-captain selectors
- deterministic suitability score and top candidates
- concern list
- positive/negative relationship highlights
- explanation of the main cohesion factors

All selectors must remain usable at 320/360/390/480px widths.

## Persistence / Schema v4

Increase game-state schema from v3 to v4.

Migration v3 -> v4:

- preserve all Phase 6 tournament state/history
- preserve random cursor exactly
- preserve player/school IDs and all existing stats
- initialize `teamDynamics` deterministically from current user roster
- do not consume the global random cursor
- if existing user roster is malformed, use safe neutral defaults and let existing validation/reporting handle unrelated corruption

Older v0/v1/v2 migration paths must still end in valid v4.

## Determinism

All derived calculations are pure and deterministic.

If any named randomness is later needed for a dynamics event, it must use a named fork and must not consume unrelated global RNG. The initial Phase 7 implementation should not require new randomness for roles, cohesion, leadership, or concerns.

## Atomicity and Exact Once

Leadership assignment uses the existing operationId/revision game action path.

Official match post-processing must update, atomically with the existing official-match commit:

- recent starter/appearance window
- role/concern inputs
- morale/trust result feedback
- cohesion recalculation

Replaying the same operation must return the stored response without double-applying dynamics effects.

## Validation and Long-Run Requirements

Add tests covering:

- leadership suitability deterministic and 0..100
- invalid/stale leadership IDs rejected
- captain and vice-captain cannot be the same player
- role classification stable under ties
- missing relationships treated as neutral
- cohesion always 0..100
- trend thresholds exact
- concern derivation and bounded penalties
- training modifier remains within 95..105 for each dimension
- PvE match modifier bounded to -5%..+5%
- ranked PvP DTO and simulation have no cohesion leakage
- v3->v4 migration preserves Phase 6 tournament state and random cursor
- captain season increments exactly once at rollover
- 30-year deterministic equality for equal seeds/actions
- 100-year soak has no stale leadership IDs, out-of-range state, or unbounded maps
- mobile E2E at 320/360/390/480px has no body horizontal overflow

## Acceptance Criteria

Phase 7 is complete when:

- user can assign captain/vice-captain safely
- roles and concerns are server-derived and visible
- morale/trust/relationships materially but mildly influence the PvE management loop
- cohesion is explainable and bounded
- training and official PvE match effects are small and tested
- ranked PvP remains isolated from transient dynamics
- annual graduation does not leave stale leadership or relationship state
- schema v4 migration is lossless for Phase 6 state
- full unit/integration/mobile E2E regression is green
- no Phase 4/5/6/7 branch is merged without explicit user authorization
