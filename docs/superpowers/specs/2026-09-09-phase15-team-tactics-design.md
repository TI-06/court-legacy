# Phase 15 — Team Tactics Design

Status: Approved product direction; written specification awaiting final review before implementation planning.

Date: 2026-09-09

## 1. Purpose

Phase 15 turns the tactics values that already exist on each school into a deliberate coaching decision with visible volleyball trade-offs.

The player should be able to answer two questions before a match:

1. What style does my team normally play?
2. Do I want to adjust that style for this opponent without permanently changing my normal setup?

The feature must make tactics meaningful without adding per-point micromanagement. There must be no single option that is mathematically best in every matchup.

## 2. Existing foundation

`School` already persists a `TeamTactics` object:

- `serveRisk`
- `serveTargetPlayerId`
- `attackTempo`
- `attackDistribution`
- `blockSystem`
- `defenseBias`

The match simulator already consumes several of these values. Existing schools and existing saves therefore already have enough data to derive a simple tactical identity.

The current simulator also contains flat bonuses that make some choices intrinsically stronger:

- block system: read receives a larger unconditional bonus than mixed or commit;
- defense bias: balanced receives a larger unconditional bonus than line or cross.

Phase 15 removes that fixed dominance and replaces it with explicit matchup trade-offs.

## 3. Goals

Phase 15 must provide:

- three understandable tactical axes;
- an authoritative normal team tactic that persists with the school;
- a match-only tactic override in pre-match preparation;
- opponent-level tactical tendencies that can inform the choice;
- tactical effects in PvE, official matches, and asynchronous PvP;
- a small, deterministic matchup model where advantages are visible but not overwhelming;
- no schema migration if the existing `School.tactics` storage remains sufficient;
- five-width mobile acceptance coverage for the new UI.

## 4. Non-goals

Phase 15 does not add:

- per-rally or per-point tactical commands;
- timeout decisions or substitutions driven by tactics;
- a fourth user-facing defensive-positioning axis;
- individual serve-target selection against PvP opponents;
- hidden opponent player abilities;
- scouting uncertainty for tactics;
- tactical progression trees, unlocks, or consumables;
- new rankings or season objectives.

Those belong to later roadmap phases if needed. In particular, Phase 16 owns high-value in-match coaching decisions.

## 5. User-facing tactical model

The user-facing model is intentionally smaller than legacy `TeamTactics`.

```ts
export type ServePlan = "safe" | "balanced" | "aggressive";
export type AttackPlan = "side" | "balanced" | "quick";
export type BlockPlan = "commit" | "mixed" | "read";

export interface MatchTacticPlan {
  serve: ServePlan;
  attack: AttackPlan;
  block: BlockPlan;
}
```

Japanese presentation:

| Axis | Value | Label | Meaning |
| --- | --- | --- | --- |
| Serve | `safe` | 安全重視 | Reduce errors; less pressure on reception |
| Serve | `balanced` | バランス | Neutral risk and return |
| Serve | `aggressive` | 強気 | More pressure and aces; more errors |
| Attack | `side` | サイド重視 | Concentrate on OH/OP and higher balls |
| Attack | `balanced` | バランス | Spread attacks without a strong matchup edge |
| Attack | `quick` | 高速 | Increase MB/quick involvement and tempo |
| Block | `commit` | コミット | Commit early to the middle/quick threat |
| Block | `mixed` | ミックス | Neutral, flexible approach |
| Block | `read` | リード | Read the set and react to side distribution |

The normal tactics screen presents only these three axes. It does not expose raw percentage sliders.

## 6. Compatibility mapping to existing `TeamTactics`

The persisted `School.tactics` object remains the source of truth. Phase 15 adds pure conversion helpers rather than introducing a second persisted tactics object.

### 6.1 Deriving the simple plan

Serve plan is derived from `serveRisk`:

- `< 40` → `safe`
- `40 ... 60` → `balanced`
- `> 60` → `aggressive`

Attack plan is derived from `attackTempo`:

- `slow` → `side`
- `balanced` → `balanced`
- `fast` → `quick`

Block plan maps directly from `blockSystem`.

### 6.2 Applying a simple plan

Saving a plan writes canonical values into the existing tactics structure:

| Plan | Existing value |
| --- | --- |
| Serve `safe` | `serveRisk = 25` |
| Serve `balanced` | `serveRisk = 50` |
| Serve `aggressive` | `serveRisk = 75` |
| Attack `side` | `attackTempo = slow` |
| Attack `balanced` | `attackTempo = balanced` |
| Attack `quick` | `attackTempo = fast` |

Canonical attack distributions are:

| Attack plan | OH | MB | OP | S | L |
| --- | ---: | ---: | ---: | ---: | ---: |
| `side` | 45 | 15 | 36 | 4 | 0 |
| `balanced` | 40 | 22 | 34 | 4 | 0 |
| `quick` | 34 | 32 | 30 | 4 | 0 |

Each row sums to 100.

Block plan writes the corresponding existing `blockSystem` value unchanged.

`defenseBias` is preserved for save compatibility but is not exposed as a Phase 15 control and must no longer receive an unconditional performance bonus.

`serveTargetPlayerId` is also preserved. Phase 15 does not expose new target-player controls. A normal save of the three-axis plan must not silently clear an existing serve target unless that target is no longer valid for the relevant context.

## 7. Persistence and server authority

### 7.1 Normal team tactics

A new authoritative game action is introduced:

```ts
{
  type: "set-team-tactics";
  plan: MatchTacticPlan;
}
```

The server validates all three enum values, converts the plan to canonical `TeamTactics` values, and updates only the user's school tactics.

The client must not optimistically persist a tactic plan as a separate source of truth. After the action returns, the UI derives the current plan again from the authoritative returned `GameState`.

### 7.2 Save schema

The schema remains **v8**.

Reason: every current save already contains `School.tactics`, and the Phase 15 normal plan is a projection of that existing data. No new persisted game-state field is required.

## 8. Match-only tactic override

Pre-match tactics follow the same principle as Phase 14 match-only lineup selection.

The pre-match screen initializes a local tactic plan from the user's current authoritative `School.tactics`.

The user can change it for the pending match. Those changes remain local until the user starts the match.

Starting a match passes the selected plan to the server as a match-only override. The override is used only to build the simulation input and must never mutate the stored `School.tactics`.

### 8.1 Weekly / official match action

The relevant server action accepts an optional field:

```ts
matchTactics?: MatchTacticPlan
```

The existing optional `matchSelection` remains independent.

### 8.2 PvP challenge request

`PvpChallengeRequest` similarly accepts:

```ts
matchTactics?: MatchTacticPlan
```

The challenger override is applied only to the challenger school in the isolated PvP simulation state.

If no override is provided, the server derives the plan from the currently authoritative user school tactics.

### 8.3 Cancellation / reset

Leaving pre-match discards the local plan.

A `元に戻す` action in the tactics section restores the baseline plan derived from authoritative normal tactics. It does not affect lineup reset semantics.

## 9. PvP publication semantics and privacy

The existing PvP publication model stores a complete snapshot of the published `School`, players, and team selection. Therefore the defender's tactics are already naturally frozen at publication time.

Phase 15 keeps that snapshot behavior:

- publishing a PvP team freezes the defender's current `School.tactics` in the snapshot;
- changing normal tactics later does not retroactively change an already published defender snapshot;
- republishing creates/activates a new snapshot with the new tactics, according to the existing publication lifecycle.

Public PvP summaries add only a categorical team-level tactics summary:

```ts
export interface PublicTacticSummary {
  serve: ServePlan;
  attack: AttackPlan;
  block: BlockPlan;
}
```

This may appear in `PvpPublishedTeamSummary` and `PvpOpponentSummary`.

Never expose through this summary:

- `serveTargetPlayerId`;
- individual player IDs;
- player abilities;
- player traits that are not already public elsewhere;
- raw private simulation state.

The defender simulation still uses the full tactics frozen in the server-side snapshot, while the challenger UI sees only the categorical public summary.

## 10. Tactical matchup model

### 10.1 Attack versus block

The primary explicit matchup is the attack plan against the opponent block plan.

Attack-side matchup points:

| Attack \ Block | Commit | Mixed | Read |
| --- | ---: | ---: | ---: |
| Side | +3 | 0 | -3 |
| Balanced | 0 | 0 | 0 |
| Quick | -3 | 0 | +3 |

Interpretation:

- quick attack can beat a read block before it organizes;
- commit block can anticipate and suppress quick attack;
- side-heavy attack can exploit a block that commits inside;
- read block is better able to organize against predictable side distribution;
- balanced/mixed is deliberately lower variance rather than secretly strongest.

The matchup points are not added to the displayed team strength. They influence rally-resolution inputs such as set/attack quality and the opposing block contest.

Implementation must keep the effect small enough that player quality, condition, lineup, and randomness remain primary determinants.

### 10.2 No unconditional block-system winner

The existing unconditional block-system bonus is removed.

There must not be a function equivalent to:

- read always +7;
- mixed always +5.5;
- commit always +4.

Any block-system advantage must depend on the opponent's attack plan.

### 10.3 Defense bias

The current `defenseBias` unconditional bonus is removed from the rally power calculation.

The field remains persisted for compatibility. It is not deleted or migrated in Phase 15.

## 11. Serve risk / reward model

The serve axis is a capability-sensitive trade-off, not a rock-paper-scissors matchup.

The current server's serve ability and mental ability continue to matter. The plan then applies bounded adjustments around the existing serve-vs-receive calculation.

Initial profile targets:

| Serve plan | Serve-error chance | Ace chance | Opponent receive quality |
| --- | ---: | ---: | ---: |
| Safe | -1.6 percentage points | -1.2 pp | +2 quality |
| Balanced | neutral | neutral | neutral |
| Aggressive | +2.2 pp | +1.8 pp | -4 quality |

All final probability values remain clamped by the simulator's existing safety bounds.

The modifiers must be applied once. The implementation must avoid simultaneously treating canonical `serveRisk` as a large hidden multiplier and applying the profile again in a way that double-counts the same tactical choice.

Strong servers should get more usable upside from aggressive play because their base serve-vs-receive differential is already better. Weak servers should experience a visibly larger self-destruction risk from choosing aggressive play because their base error protection is lower.

## 12. Match analysis and matchup hint

A pure selector should calculate a public tactical matchup summary from the two categorical plans.

Suggested shape:

```ts
export type TacticMatchupRating = "favorable" | "neutral" | "unfavorable";

export interface TacticMatchupSummary {
  ownAttack: TacticMatchupRating;
  ownBlock: TacticMatchupRating;
  headline: TacticMatchupRating;
}
```

The summary is based only on public categorical plans. It must never inspect hidden opponent player data in PvP.

Pre-match UI labels:

- `相性有利`
- `互角`
- `相性注意`

The copy should explain the tactical reason in one short sentence, for example:

- `高速攻撃は相手のリードブロックを崩しやすい`
- `相手の高速攻撃にコミットブロックが噛み合う`

Do not present deterministic win predictions or percentages.

Where match analysis factors are already surfaced, Phase 15 may add a tactical-matchup factor derived from the same public model. It should describe influence, not claim that tactics alone caused the result.

## 13. Opponent tactic visibility

### PvE / official matches

The opponent's three categorical plans are visible because the full opponent school state is already local and these are school-level tendencies.

### PvP

Only the `PublicTacticSummary` stored/returned with the published snapshot is visible.

The UI must not derive tactic hints by examining hidden opponent individual abilities.

If an older PvP snapshot or API record does not yet carry the public summary during rollout, the UI displays `戦術傾向 非公開` and continues without a matchup hint rather than guessing.

## 14. UI design

### 14.1 Player Hub — `戦術`

Player Hub gains a fourth functional mode alongside the existing roster/lineup/team-state flows.

The tactics screen contains three stacked or compact cards:

1. サーブ方針
2. 攻撃方針
3. ブロック方針

Each card presents exactly three large tap targets. The selected option shows a short trade-off description.

A single primary action saves the full plan:

`この戦術を基本設定にする`

Pending authoritative save disables all plan controls and the save action. Success uses the app's existing operation/status feedback rather than creating a second persistence indicator.

### 14.2 Pre-match — `今回の戦術`

The existing pre-match lineup screen gains a tactics section before the final start button.

It shows:

- current local selections for the three axes;
- opponent's three public tendencies when available;
- one compact matchup headline/reason;
- `基本戦術に戻す`;
- explicit copy that this match-only choice is not saved to the normal team.

Changing a tactic must not alter the displayed stored normal tactics.

The existing lineup presets, saved lineups, comparison chart, PvP privacy note, and `この編成で試合開始` flow remain available.

The final start CTA may be renamed to `この編成・戦術で試合開始` because both local choices are now submitted together.

## 15. Validation and errors

All `MatchTacticPlan` values are validated server-side.

Invalid enum values return the same family of user-action validation error used by other authoritative actions. The server must never silently coerce an unknown value to `balanced`.

A normal `set-team-tactics` action must reject if the user school is unavailable/corrupt rather than mutating another school.

Match-only tactical overrides are copied/applied into isolated simulation input. A failed match start leaves persistent normal tactics unchanged.

PvP public summary absence is non-fatal and degrades to `非公開`.

## 16. Testing strategy

### 16.1 Domain tests

Cover:

- exact derivation thresholds for serve plan;
- exact canonical mapping back into legacy `TeamTactics`;
- preservation of compatibility-only fields;
- all 3 x 3 attack/block matchup values;
- matchup headline calculation;
- no hidden player dependency in public matchup selectors.

### 16.2 Authoritative action tests

Cover:

- `set-team-tactics` persists canonical values to the user school;
- invalid plans are rejected;
- unrelated school/tactics fields are preserved;
- action/revision behavior follows existing server authority rules.

### 16.3 Match simulation tests

Use seeded deterministic tests to verify:

- intended attack/block matchup direction;
- the old unconditional read/mixed/commit hierarchy is gone;
- safe serve reduces errors and pressure;
- aggressive serve increases both upside and error risk;
- tactics do not mutate source school state.

A deterministic multi-seed balance regression should use broad, non-flaky bounds. For representative equal-strength teams, no single attack/block plan combination may be allowed to dominate every opposing block/attack choice. Tactical edges should be material but smaller than a meaningful player-quality gap.

The initial balance target is that, across a fixed representative seed set, an intended favorable matchup produces a visible advantage without routinely pushing otherwise equal teams beyond approximately a 60/40 match outcome split. This is a regression guard, not a promised user-facing probability.

### 16.4 PvP tests

Cover:

- defender snapshot keeps the tactics from publication time;
- later normal tactic edits do not mutate the stored published snapshot;
- republished snapshots can carry different tactics;
- challenger match-only override applies only to the isolated challenger simulation school;
- public summaries contain only categorical plans;
- no player IDs or private abilities are introduced into public contracts.

### 16.5 UI tests

Cover:

- Player Hub tactics option selection and authoritative save callback;
- returned authoritative state updates selected normal plan;
- pre-match starts from normal plan;
- local changes do not mutate normal state;
- reset returns to baseline plan;
- opponent tendencies and matchup hints render from public categorical data;
- missing PvP summary renders `非公開` without guessing.

### 16.6 Mobile E2E

At widths 320, 360, 390, 414, and 480:

- open Player Hub tactics;
- change all three axes and save;
- verify authoritative persisted selection after snapshot return;
- enter a practice-match pre-match screen;
- verify baseline tactics are loaded;
- override at least one tactic;
- verify matchup hint changes where applicable;
- start the match successfully;
- verify no horizontal overflow or bottom-nav/action collision.

PvP contract/integration tests cover privacy; a dedicated full network PvP E2E is not required if the existing test harness cannot deterministically seed an opponent snapshot, but the public summary rendering must still have component/integration coverage.

## 17. PR split

### PR15-1 — Tactics Foundation

Scope:

- `MatchTacticPlan` types and legacy conversion helpers;
- tactical matchup selector/matrix;
- serve risk/reward refactor;
- removal of flat dominant block/defense bonuses;
- authoritative `set-team-tactics` action;
- match-only `matchTactics` for weekly/official match simulation;
- match-only `matchTactics` for PvP challenger simulation;
- public PvP tactic summary and publication/list contract wiring;
- deterministic domain/worker/simulation tests.

PR15-1 contains no major new tactics UI beyond any minimal plumbing needed for compilation/tests.

### PR15-2 — Tactics UX

Scope:

- Player Hub tactics mode;
- authoritative basic-tactic save UX;
- pre-match match-only tactics controls;
- opponent public tendencies;
- matchup hint/reason;
- PvE and PvP presentation behavior;
- five-width mobile E2E;
- durable project-context update marking Phase 15 complete.

## 18. Invariants

Phase 15 is not complete unless all of the following remain true:

- schema remains v8 unless implementation proves the existing storage fundamentally insufficient;
- normal tactic saves are server-authoritative;
- match-only tactics never overwrite normal `School.tactics`;
- there is no unconditional globally strongest block option;
- there is no unconditional globally strongest serve option;
- PvP does not expose individual hidden ability data or player target IDs;
- published PvP defender tactics are frozen with the snapshot;
- old saves and generated rival schools continue to derive valid three-axis plans;
- no fatigue-management chores are added;
- no Phase 16 in-match micromanagement is pulled into this phase;
- all required PR CI jobs and post-merge main CI jobs must be green before claiming completion.

## 19. Success criteria

A player should be able to look at an opponent tendency, choose a tactical response in a few taps, understand the trade-off, and start the match without having to manage percentages or individual instructions.

The chosen response must have a real, testable effect on rally simulation while remaining one factor among lineup quality, player ability, condition, cohesion/readiness, and randomness.
