# Phase 15 — Team Tactics Design

Status: Approved product direction; written specification awaiting final review before implementation planning.

Date: 2026-09-09

## 1. Purpose

Phase 15 turns the tactics values that already exist on each school into deliberate coaching decisions with visible volleyball trade-offs.

The player should be able to answer two questions before a match:

1. What style does my team normally play?
2. Do I want to adjust that style for this opponent without permanently changing my normal setup?

Tactics must matter without adding per-point micromanagement. No option may be mathematically best in every matchup.

## 2. Existing foundation

`School` already persists a `TeamTactics` object containing:

- `serveRisk`
- `serveTargetPlayerId`
- `attackTempo`
- `attackDistribution`
- `blockSystem`
- `defenseBias`

The match simulator already consumes several of these values. Existing schools and saves therefore already contain enough data to derive a simple tactical identity.

The current simulator also contains flat bonuses that make some choices intrinsically stronger:

- `read` block receives a larger unconditional bonus than `mixed` or `commit`;
- `balanced` defense bias receives a larger unconditional bonus than `line` or `cross`.

Phase 15 removes those fixed advantages and replaces them with matchup-dependent trade-offs.

## 3. Goals

Phase 15 provides:

- three understandable tactical axes;
- an authoritative normal team tactic that persists with the school;
- a match-only tactic override in pre-match preparation;
- opponent-level tactical tendencies that inform the choice;
- tactical effects in practice, official, and asynchronous PvP matches;
- a deterministic matchup model where advantages are visible but bounded;
- schema-v8 compatibility without migration;
- five-width mobile acceptance coverage for the new UI.

## 4. Non-goals

Phase 15 does not add:

- per-rally or per-point tactical commands;
- timeout decisions or tactics-driven substitution commands;
- a fourth user-facing defensive-positioning axis;
- individual serve-target selection against PvP opponents;
- hidden opponent player abilities;
- scouting uncertainty for tactics;
- tactical progression trees, unlocks, or consumables;
- tactical result analysis cards;
- new rankings or season objectives.

Phase 16 owns limited high-value in-match coaching decisions.

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

| Axis   | Value        | Label      | Meaning                                    |
| ------ | ------------ | ---------- | ------------------------------------------ |
| Serve  | `safe`       | 安全重視   | ミスを抑える代わりに相手を崩しにくい       |
| Serve  | `balanced`   | バランス   | リスクと威力を中間にする                   |
| Serve  | `aggressive` | 強気       | エース・崩しを狙う代わりにミスが増える     |
| Attack | `side`       | サイド重視 | OH/OPへ集め、高いボールでも押す            |
| Attack | `balanced`   | バランス   | 攻撃先を散らし大きな相性差を作らない       |
| Attack | `quick`      | 高速       | MB参加とテンポを上げてブロック完成前を狙う |
| Block  | `commit`     | コミット   | 中央・速攻を早く決め打ちする               |
| Block  | `mixed`      | ミックス   | 読みと決め打ちを使い分ける                 |
| Block  | `read`       | リード     | トスを見てサイドまで組織的に追う           |

The normal tactics screen exposes only these three axes. Raw percentage sliders are not exposed.

## 6. Compatibility mapping to existing `TeamTactics`

The persisted `School.tactics` object remains the sole persisted source of truth. Phase 15 adds pure conversion helpers instead of a second saved tactics object.

### 6.1 Deriving `MatchTacticPlan`

Serve plan from `serveRisk`:

- `< 40` → `safe`
- `40 ... 60` → `balanced`
- `> 60` → `aggressive`

Attack plan from `attackTempo`:

- `slow` → `side`
- `balanced` → `balanced`
- `fast` → `quick`

Block plan maps directly from `blockSystem`.

### 6.2 Applying `MatchTacticPlan`

Saving a plan writes canonical values into the existing tactics structure:

| Plan               | Existing value           |
| ------------------ | ------------------------ |
| Serve `safe`       | `serveRisk = 25`         |
| Serve `balanced`   | `serveRisk = 50`         |
| Serve `aggressive` | `serveRisk = 75`         |
| Attack `side`      | `attackTempo = slow`     |
| Attack `balanced`  | `attackTempo = balanced` |
| Attack `quick`     | `attackTempo = fast`     |

Canonical attack distributions:

| Attack plan |  OH |  MB |  OP |   S |   L |
| ----------- | --: | --: | --: | --: | --: |
| `side`      |  45 |  15 |  36 |   4 |   0 |
| `balanced`  |  40 |  22 |  34 |   4 |   0 |
| `quick`     |  34 |  32 |  30 |   4 |   0 |

Each row sums to 100.

Block plan writes the corresponding existing `blockSystem` value.

`defenseBias` remains persisted for compatibility but is not exposed in Phase 15 and receives no unconditional performance bonus.

`serveTargetPlayerId` is preserved unchanged when the three-axis normal plan is saved. Phase 15 does not create, replace, or clear serve targets. Existing runtime target-validity behavior remains responsible for ignoring a target that is unavailable in a particular match.

## 7. Persistence and server authority

### 7.1 Normal team tactics

A new authoritative game action is introduced:

```ts
{
  type: "set-team-tactics";
  plan: MatchTacticPlan;
}
```

The server validates all three enum values, converts the plan to canonical `TeamTactics` values, and updates only `state.schools[state.userSchoolId].tactics`.

The client never persists a second local tactics source of truth. After the action returns, UI state is derived again from the authoritative returned `GameState`.

### 7.2 Save schema

The save schema remains **v8** throughout Phase 15.

Every current save already contains `School.tactics`; the three-axis plan is only a projection of existing data. No migration is introduced.

## 8. Match-only tactic override

Pre-match tactics follow the same rule as Phase 14 match-only lineup selection.

The pre-match screen initializes a local plan from the user's authoritative `School.tactics`. Changes remain local until the match starts.

Starting the match passes the local plan as a match-only override. The server applies it to an isolated simulation copy and never mutates stored `School.tactics`.

### 8.1 Practice / official match path

The existing `advance-week` action accepts a new optional field alongside `matchSelection`:

```ts
matchTactics?: MatchTacticPlan
```

The pending practice/official match simulation uses that override for the user school only. If omitted, simulation uses the authoritative stored user-school tactics.

### 8.2 PvP challenge path

`PvpChallengeRequest` accepts:

```ts
matchTactics?: MatchTacticPlan
```

The challenger override is applied only to the challenger school in the isolated PvP simulation state. The defender continues to use the tactics frozen in its published snapshot.

If omitted, the challenger uses the currently authoritative user-school tactics.

### 8.3 Cancellation / reset

Leaving pre-match discards the local tactic plan.

`基本戦術に戻す` restores the plan derived from authoritative normal tactics. It does not alter or reset the local lineup; lineup reset keeps its existing independent behavior.

## 9. PvP publication semantics and privacy

The existing PvP publication model stores a complete snapshot of the published `School`, players, and team selection. The defender's tactics are therefore frozen naturally at publication time.

Phase 15 preserves this behavior:

- publishing freezes the defender's current `School.tactics` in the snapshot;
- editing normal tactics later does not mutate an already published snapshot;
- republishing follows the existing lifecycle and captures the new tactics.

Public PvP contracts add only a categorical team-level summary:

```ts
export interface PublicTacticSummary {
  serve: ServePlan;
  attack: AttackPlan;
  block: BlockPlan;
}
```

Both `PvpPublishedTeamSummary` and `PvpOpponentSummary` include `tactics: PublicTacticSummary` for newly published/returned Phase-15 records.

During rollout, persisted legacy rows that predate this field are tolerated by the storage/response adapter; their public summary is returned as absent and the UI shows `戦術傾向 非公開` rather than guessing.

Never expose through the public summary:

- `serveTargetPlayerId`;
- individual player IDs;
- player abilities;
- private player traits;
- raw simulation state.

The defender simulation uses the full tactics in the private server-side snapshot. The challenger UI sees only the categorical public summary.

## 10. Tactical matchup model

### 10.1 Attack versus block

The primary explicit matchup is attack plan versus opponent block plan.

Attack-side matchup points:

| Attack \ Block | Commit | Mixed | Read |
| -------------- | -----: | ----: | ---: |
| Side           |     +3 |     0 |   -3 |
| Balanced       |      0 |     0 |    0 |
| Quick          |     -3 |     0 |   +3 |

Interpretation:

- quick attack can beat a read block before it organizes;
- commit block can anticipate and suppress quick attack;
- side-heavy attack can exploit a block committed inside;
- read block organizes better against predictable side distribution;
- balanced/mixed is lower variance, not secretly stronger.

These points are not added to displayed team strength. They modify rally-resolution inputs around set/attack quality and the opposing block contest.

The effect must remain small enough that player quality, condition, lineup, readiness/cohesion, and randomness remain primary determinants.

### 10.2 No unconditional block winner

The existing unconditional hierarchy is removed. There must be no equivalent of:

- read always +7;
- mixed always +5.5;
- commit always +4.

Any block-system advantage depends on the opponent's attack plan.

### 10.3 Defense bias

The existing unconditional `defenseBias` bonus is removed from rally power. The field remains persisted but has no Phase-15 user-facing control or flat bonus.

## 11. Serve risk / reward model

Serve is a capability-sensitive trade-off rather than a matchup matrix.

The server's serve and mental abilities continue to define the base serve quality. The categorical plan applies one bounded profile around the existing serve-vs-receive calculation.

Initial profile targets:

| Serve plan |     Serve-error chance | Ace chance | Opponent receive quality |
| ---------- | ---------------------: | ---------: | -----------------------: |
| Safe       | -1.6 percentage points |    -1.2 pp |               +2 quality |
| Balanced   |                neutral |    neutral |                  neutral |
| Aggressive |                +2.2 pp |    +1.8 pp |               -4 quality |

Final probability values remain clamped by simulator safety bounds.

The tactical modifier is applied exactly once. Refactoring must remove any raw `serveRisk` contribution that would double-count the canonical plan alongside these profile adjustments.

Strong servers receive more practical upside from aggressive play because their base serve-vs-receive differential is stronger. Weak servers have less protection against the aggressive error penalty. `aggressive` must therefore not become a universal best choice.

## 12. Public matchup hint

A pure selector calculates matchup information from two categorical plans only.

```ts
export type TacticMatchupRating = "favorable" | "neutral" | "unfavorable";

export interface TacticMatchupSummary {
  ownAttack: TacticMatchupRating;
  ownBlock: TacticMatchupRating;
  headline: TacticMatchupRating;
  reason: string;
}
```

`ownAttack` uses own attack versus opponent block. `ownBlock` uses the inverse perspective: opponent attack versus own block.

`headline` is:

- `favorable` when the combined signed matchup score is positive;
- `unfavorable` when it is negative;
- `neutral` when it is zero.

The selector uses only `MatchTacticPlan` values and never reads opponent players or abilities.

Pre-match labels:

- `相性有利`
- `互角`
- `相性注意`

The reason is one short tactical sentence, such as:

- `高速攻撃は相手のリードブロックを崩しやすい`
- `相手の高速攻撃にコミットブロックが噛み合う`

No win probability is shown.

Phase 15 does **not** add a new result-screen tactical analysis factor. The pre-match decision and simulation effect are sufficient for this phase; deeper match-command/result interpretation stays out of scope.

## 13. Opponent tactic visibility

### PvE / official matches

The opponent's three categorical plans are visible because these are school-level tendencies and the full opponent school state already exists locally for these flows.

### PvP

Only `PublicTacticSummary` from the published snapshot is visible.

The UI never derives PvP tactical hints by examining hidden opponent individual abilities. If the public summary is absent for a legacy snapshot, the UI displays `戦術傾向 非公開` and omits the matchup hint.

## 14. UI design

### 14.1 Player Hub — `戦術`

Player Hub gains a tactics mode alongside the existing player, lineup, and team-state flows.

The tactics screen contains three cards:

1. サーブ方針
2. 攻撃方針
3. ブロック方針

Each card has exactly three large tap targets and a short description of the selected trade-off.

One primary action saves the full plan:

`この戦術を基本設定にする`

While the authoritative save is pending, all tactics controls and the save action are disabled. Success uses the app's existing operation/status feedback.

### 14.2 Pre-match — `今回の戦術`

The existing pre-match lineup screen gains a tactics section before the final start button.

It shows:

- the three local tactic choices;
- opponent public tendencies when available;
- one compact matchup headline and reason;
- `基本戦術に戻す`;
- explicit copy that the change applies to this match only.

Changing these controls never changes the stored normal tactics displayed elsewhere.

Existing lineup presets, saved lineups, comparison chart, PvP privacy note, and lineup editing remain available.

The final start CTA is renamed to:

`この編成・戦術で試合開始`

It submits a cloned match-only lineup and a cloned match-only tactic plan together.

## 15. Validation and errors

All `MatchTacticPlan` values are validated server-side.

Invalid enum values are rejected using the existing user-action validation error family. Unknown values are never silently coerced to `balanced`.

`set-team-tactics` rejects a corrupt/missing user school rather than mutating another school.

Match-only overrides are copied into isolated simulation state. A failed match start leaves persistent normal tactics unchanged.

Missing legacy PvP public summaries are non-fatal and degrade to `非公開`.

## 16. Testing strategy

### 16.1 Domain tests

Cover:

- exact serve-plan derivation thresholds;
- exact canonical mapping into legacy `TeamTactics`;
- preservation of `serveTargetPlayerId` and `defenseBias`;
- all 3 x 3 attack/block matchup values;
- exact matchup headline calculation;
- no hidden-player dependency in public matchup selectors.

### 16.2 Authoritative action tests

Cover:

- `set-team-tactics` persists canonical values to the user school;
- invalid plans are rejected;
- unrelated school fields and compatibility tactic fields are preserved;
- normal revision/idempotency behavior follows existing authoritative game-action rules.

### 16.3 Match simulation tests

Use seeded deterministic tests to verify:

- intended attack/block matchup direction;
- the old unconditional read/mixed/commit hierarchy is gone;
- safe serve reduces errors and pressure;
- aggressive serve increases both upside and error risk;
- tactical overrides do not mutate source school state.

A fixed multi-seed balance regression uses broad, non-flaky bounds. For representative equal-strength teams, no single attack/block plan combination may dominate every opposing choice.

Initial balance guard: an intended favorable matchup should be visible but should not routinely push otherwise equal representative teams beyond approximately a 60/40 match-outcome split across the fixed seed set. This is a regression bound, not a user-facing promised probability.

### 16.4 PvP tests

Cover:

- defender snapshot keeps publication-time tactics;
- later normal edits do not mutate the stored snapshot;
- republishing can carry different tactics;
- challenger match-only override affects only the isolated challenger simulation school;
- public summaries contain only categorical plans;
- legacy snapshots without a summary degrade safely;
- no player IDs or private abilities enter public contracts.

### 16.5 UI tests

Cover:

- Player Hub tactic selection and authoritative save callback;
- returned authoritative state updates the displayed normal plan;
- pre-match initializes from normal tactics;
- local changes do not mutate normal state;
- reset restores only the baseline tactics;
- opponent tendencies and matchup hints render from public categorical data;
- missing PvP summary renders `非公開` without guessing.

### 16.6 Mobile E2E

At 320, 360, 390, 414, and 480 px:

- open Player Hub tactics;
- change all three axes and save;
- verify authoritative persisted selection after snapshot return;
- enter a practice-match pre-match screen;
- verify baseline tactics load;
- override at least one tactic;
- verify the matchup hint updates where applicable;
- start the match successfully;
- verify no horizontal overflow or bottom-nav/action collision.

PvP contract/integration tests own privacy and snapshot semantics. A full network PvP E2E is not required if the existing harness cannot deterministically seed an opponent snapshot, but public-summary rendering must have component/integration coverage.

## 17. PR split

### PR15-1 — Tactics Foundation

Scope:

- `MatchTacticPlan` types and conversion helpers;
- tactical matchup matrix/selector;
- serve risk/reward refactor;
- removal of flat dominant block/defense bonuses;
- authoritative `set-team-tactics` action;
- `matchTactics` through practice/official `advance-week` simulation;
- `matchTactics` through PvP challenger simulation;
- public PvP tactics summary and publication/list contract wiring;
- deterministic domain, worker, and simulation tests.

PR15-1 contains no major new tactics UI beyond minimal plumbing required for compilation and integration tests.

### PR15-2 — Tactics UX

Scope:

- Player Hub tactics mode;
- authoritative baseline-tactic save UX;
- pre-match match-only tactics controls;
- opponent public tendencies;
- matchup headline/reason;
- PvE and PvP presentation behavior;
- five-width mobile E2E;
- durable `PROJECT_CONTEXT.md` update marking Phase 15 complete.

## 18. Invariants

Phase 15 is not complete unless all of the following remain true:

- save schema is v8;
- normal tactic saves are server-authoritative;
- match-only tactics never overwrite normal `School.tactics`;
- no block plan is unconditionally strongest;
- no serve plan is unconditionally strongest;
- PvP never exposes hidden individual abilities or serve-target player IDs;
- published PvP defender tactics are frozen with the snapshot;
- old saves and generated rivals derive valid three-axis plans;
- no fatigue-management chores are added;
- no Phase 16 in-match micromanagement is pulled into Phase 15;
- required PR CI and post-merge main CI are all green before completion is claimed.

## 19. Success criteria

A player can inspect an opponent tendency, choose a tactical response in a few taps, understand its trade-off, and start the match without managing percentages or individual instructions.

The chosen response has a real, deterministic-testable effect on rally simulation while remaining only one factor among lineup quality, player ability, condition, readiness/cohesion, and randomness.
