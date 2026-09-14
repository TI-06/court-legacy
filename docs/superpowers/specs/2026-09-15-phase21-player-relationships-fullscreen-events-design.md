# Phase21 Player Relationships / Personality / Fullscreen Events Design

Date: 2026-09-15
Status: ready for user review
Base: main @ `ada00b3ff95dc6523d3b2974233fcff8a5598931`

## 1. Goal

Phase21 turns the existing personality, trust, morale, player-to-player relationship values, and event catalog into a visible long-term character system.

Players should feel different without adding large hidden combat bonuses. Character systems primarily affect event selection, relationship development, trust/morale, and small visible training modifiers.

Choice-based manager/player events also move from the current BottomSheet presentation to a dedicated fullscreen game experience.

## 2. Non-goals

- The broader match-presentation overhaul remains Phase22.
- Phase21 adds no large direct match-stat bonus from friendship, rivalry, personality, or undiscovered traits.
- Informational notifications remain compact unless they require a user choice.
- Normal event cadence does not increase beyond the current gate: `weekOfYear % 3 === 0`, except due follow-ups which retain priority behavior.

## 3. Existing foundations to reuse

Current state already contains `Player.personalityId`, `traitIds`, `hiddenTraitIds`, morale, trust, leadership, team adaptation, `GameState.playerRelationships`, relationship/captaincy/rivalry events, relationship trigger eligibility, and event effects for relationship/trust/morale changes.

The existing personality catalog already has ten personalities. Phase21 exposes and connects that system rather than creating a second personality model.

## 4. Product principles

1. **Visible effects over hidden power.** Training modifiers introduced by Phase21 must appear in training results.
2. **Relationships come from history.** Special relationships are created by an actual event outcome, not merely by crossing a numeric threshold.
3. **Negative relationships create stories, not punishment loops.** Low relationship scores change events and morale/trust behavior; they do not impose a permanent direct training penalty.
4. **More character depth without event spam.** Character state changes candidate weights, not the base event cadence.

## 5. Public personality presentation

Personality is visible from the beginning.

Player detail shows:

- personality name
- description
- qualitative training stability
- qualitative relationship-building tendency
- qualitative pressure response
- qualitative morale volatility

Use game-language labels such as `高 / 標準 / 低` or `得意 / 普通 / 苦手`. Do not expose raw coefficients by default.

The existing personality training modifier remains canonical; Phase21 must not duplicate it.

## 6. Relationship score presentation

`GameState.playerRelationships` remains the canonical 0-100 score using the existing sorted `relationshipKey`.

Labels:

- 0-19: 犬猿
- 20-39: 不仲
- 40-59: 普通
- 60-79: 好相性
- 80-100: 親友

Missing entries continue to mean 50.

Player detail shows relevant teammates as **label + gauge + special relationship tags**.

## 7. Special relationships

Kinds:

- `rival` / ライバル
- `mentor` / 師弟
- `partner` / 相棒

Special tags are independent of the numeric label. `ライバル + 不仲` and `ライバル + 好相性` are both valid.

A pair may hold at most two special tags.

### Rival

Requirements:

- an explicit competition/rivalry event outcome establishes it
- no relationship-score minimum

If both rivals share the same preferred position and both actively train that week, each gets a visible `+3%` social training contribution.

### Mentor

Directional relationship with mentor and protege IDs.

Requirements at establishment:

- different grades
- explicit mentoring/coaching event outcome
- relationship >= 60

If both actively train that week, the protege gets a visible `+4%` contribution.

### Partner

Requirements at establishment:

- explicit cooperation/coordination event outcome
- relationship >= 80

If both actively train that week, each gets a visible `+3%` contribution.

Setter-attacker pairs may receive higher event affinity, but not a higher training percentage.

### Social training cap

Relationship-derived training contributions are capped at **+5% total per player per weekly resolution**.

The result log still lists contributing relationships. If raw contributions exceed +5%, the result UI must make the cap understandable instead of silently truncating it.

No special relationship adds a hidden direct match-stat bonus in Phase21.

## 8. Canonical relationship state

Add a bounded canonical structure keyed by `relationshipKey`.

```ts
export type SpecialRelationshipKind = "rival" | "mentor" | "partner";

export interface SpecialRelationshipTag {
  kind: SpecialRelationshipKind;
  establishedDate: GameDate;
  sourceEventId: EventId;
  lastReinforcedDate: GameDate;
  mentorPlayerId?: PlayerId;
  protegePlayerId?: PlayerId;
}

export interface PlayerRelationshipBond {
  playerIds: [PlayerId, PlayerId];
  tags: SpecialRelationshipTag[]; // max 2
}
```

Recommended state key: `GameState.playerRelationshipBonds`.

Mentor directionality is mandatory even if the exact persisted shape changes for codec simplicity.

## 9. Explicit event effects for relationship tags

Do not infer a new special relationship from event IDs or UI text.

Extend the event effect schema with explicit effects equivalent to:

```ts
{ type: "relationship-tag-add", kind: "rival" | "partner" }
{ type: "relationship-tag-add", kind: "mentor", mentorActorIndex: 0, protegeActorIndex: 1 }
{ type: "relationship-tag-remove", kind: "rival" | "mentor" | "partner" }
```

Add/remove effects operate on the event actors and call one canonical domain validator. The validator enforces pair capacity, mentor directionality, and score/grade requirements.

Invalid establishment attempts are deterministic no-ops with a safe visible result; event data should nevertheless be validated so invalid definitions are caught by tests.

Existing relationship events selected for Phase21 are updated to use these explicit effects. This guarantees that every special relationship has an auditable event origin.

## 10. Reinforcement, degradation, and graduation

Special relationships do not disappear after one bad week.

Each tag stores `lastReinforcedDate`.

Removal/transition can occur through an explicit event outcome or a prolonged fallback deterioration rule:

- partner: eligible for fallback degradation only after at least 8 consecutive weeks below relationship 60
- mentor: eligible only after at least 8 consecutive weeks below relationship 50
- rival: never removed solely because the relationship score is low

The exact compact persistence for the 8-week window may be a streak or last-qualified date, but it must be deterministic and bounded.

When a player graduates, active special bonds involving that player are archived then removed from active state.

Add bounded `GameHistory.relationshipLegacies` entries containing both IDs/names, tags, mentor direction where applicable, establishment dates, final score, and archive date. Keep the newest 200 records.

## 11. Hidden character traits

### Purpose

`Player.hiddenTraitIds` currently exists but generated players receive an empty array. Phase21 uses it for **undiscovered character traits**, not hidden ability bonuses.

Initial examples include:

- 面倒見がいい
- 研究熱心
- 練習の虫
- 負けを引きずらない
- 仲間思い
- 一人で抱え込みやすい
- 注目されると燃える
- 競争相手がいると伸びる

### Separate catalog

Do not reuse performance `traitIds` definitions, whose contract is ability/situation modification.

Add a separate character-trait catalog containing display text, event affinities, relationship tendencies where applicable, and discovery contexts. Initial catalog size: **8-12 traits**.

### Assignment contract

Phase21 supports at most one hidden character trait per player.

Initial assignment target:

- **60%** of players: one hidden character trait
- **40%**: none

New players use the normal seeded generation path.

Existing v8 active players receive a deterministic one-time backfill using stable inputs such as `seed + playerId`. Backfill must not consume or shift the simulation `randomCursor`.

Persist an initialization guard so reload cannot reroll the assignment.

### Revealed state

Add `revealedHiddenTraitIds: string[]`, always a subset of `hiddenTraitIds`.

Only revealed traits appear in UI and begin affecting event affinity or relationship behavior.

Before discovery, a hidden character trait applies **no unseen training bonus and no unseen match bonus**.

### Discovery

Discovery is contextual. Supported contexts include trust threshold, weeks in program, official appearances, leadership assignment, injury recovery, special relationship establishment, and tagged event outcomes.

Each character trait defines at least one meaningful discovery context. When satisfied, discovery is an informational notification and does not consume the normal event slot.

Example:

> 新しい個性を発見！
> 田中 悠真「面倒見がいい」
> 後輩を支える場面が起こりやすくなりました。

## 12. Event selection and repetition control

Eligibility, cooldown, once-per-career, and scheduled follow-up checks remain authoritative.

Only after those checks pass may Phase21 apply bounded candidate weighting from:

- personality affinity
- current relationship label
- active special tags
- revealed character traits

Combined Phase21 affinity multiplier is clamped to **0.75x-1.50x** before the existing recent-event/category penalties.

Special relationship affinity never bypasses cooldown or eligibility.

### Pair repetition

Extend `EventMemory` with bounded `recentActorPairKeys`, maximum 6 entries.

For two-actor events, an exact recently used pair receives an initial `0.20x` repeat multiplier. Existing recent-event, recent-category, and recent-primary-actor controls remain.

This is specifically intended to stop one attractive pair from monopolizing relationship stories.

## 13. Fullscreen choice-event experience

### Scope

Every `PendingEvent` that asks the user to choose an action uses the fullscreen experience, including manager decisions, player events, relationship events, captaincy, rivalry, and other choice-based categories.

Informational notifications do not automatically become fullscreen.

### Replace BottomSheet

The current choice and result states use `BottomSheet`. Phase21 replaces that structural dependency with a dedicated component, recommended as:

```tsx
<FullscreenEventExperience state={state} data={data} onChoose={...} />
```

`EventDialog` may temporarily remain as a compatibility wrapper, but final Phase21 choice/result presentation must not depend on BottomSheet sizing.

### Mobile layout

Use full viewport height with `100vh` fallback and `100dvh`, plus safe-area insets.

Layout:

1. category/status header
2. large title
3. actor area
4. scrollable story/content area
5. sticky choice/action area above the bottom safe area

Two to four choices must fit without shrinking text to the current BottomSheet scale.

### Actor presentation

Show larger actor cards with name, grade/position, public personality, and relevant relationship label/special tag for two-player events.

No portrait asset system is required in Phase21; upgraded initials/emblem presentation is sufficient.

### Result transition

After the choice resolves, stay in the fullscreen experience and transition in-place to the result state.

Show:

- chosen action
- involved players
- visible numeric/state changes
- relationship label transition if changed
- special relationship establishment/removal
- character-trait discovery if synchronously caused by the resolution

The user explicitly confirms before returning to the main game.

Mandatory events remain non-dismissible before valid resolution.

### Accessibility

The fullscreen event layer must manage focus, block background interaction, restore focus meaningfully, respect reduced-motion settings, support safe areas, and preserve touch-target/contrast requirements.

## 14. Training integration

Use the existing additional-growth-modifier path; do not create a second training formula.

Add visible modifier codes equivalent to:

- `relationship-partner`
- `relationship-mentor`
- `relationship-rival`

A social modifier applies only when all relevant players are on the active team and are not skipped by injury or auto-rest for that weekly resolution.

Collect raw social contributions, cap their combined factor at 105%, then pass the visible bounded modifier(s) into normal growth calculation.

## 15. Notifications

Compact informational notifications are used for:

- special relationship established
- special relationship removed/transformed
- hidden character trait discovered

Copy explains the gameplay consequence in plain language.

These do not use fullscreen presentation unless they also require a choice.

## 16. Persistence and v8 -> v9 migration

Phase21 increments the game schema to **v9**.

PR21-2 introduces the complete v9 persistence foundation so PR21-3 does not require another schema bump. Defaults include:

- `playerRelationshipBonds = {}`
- relationship legacy history = `[]`
- relationship degradation tracking = empty
- `EventMemory.recentActorPairKeys = []`
- `revealedHiddenTraitIds = []` for existing players
- character-trait initialization guard = false for existing players

PR21-2 may add the hidden-character persistence fields before PR21-3 begins using them.

PR21-3 performs deterministic character-trait backfill after migration using stable non-`randomCursor` inputs, sets the initialization guard, and then saves canonically as v9.

Migration preserves existing `playerRelationships`, personalities, performance `traitIds`, event history, and pending event semantics.

Old v8 saves must load and encode canonically as v9.

## 17. Long-run balance gate

Run deterministic multi-season evidence with at least two fixed seeds.

Hard assertions:

- Phase21 does not increase normal event cadence beyond the existing three-week gate
- no invalid active special-relationship references remain after graduation
- no pair exceeds two special tags
- social training bonus never exceeds +5%
- hidden-trait backfill does not move `randomCursor`
- revealed traits are always a subset of assigned hidden traits
- v8 saves migrate successfully

Record:

- relationship events per season
- unique actor pairs
- maximum single-pair event share
- partner/rival/mentor establishments
- removals/transitions
- hidden trait discoveries per season
- percentage discovered by graduation
- average/max social training modifier

Initial soft targets:

- no single pair >35% of two-player relationship events in a sufficiently populated sample
- special relationships remain notable rather than covering most possible teammate pairs
- migration does not create a bulk hidden-trait discovery wave immediately after load

Measured results must be committed in a Phase21 report before completion.

## 18. PR decomposition

### PR21-1: Fullscreen Event Experience + Personality Presentation

- fullscreen choice/result event UI
- mobile `100dvh`, safe-area, sticky choices
- in-place result state
- personality name/description/tendencies on player detail
- accessibility and mobile E2E
- avoid persistence changes

### PR21-2: Relationship Labels + Special Relationships + v9 Foundation

- relationship label/gauge selectors
- special relationship canonical state
- explicit add/remove event effects and validators
- rival/mentor/partner establishment
- event-result relationship transitions
- player detail relationship section
- graduation legacy archival
- complete v9 persistence fields/defaults, including fields reserved for PR21-3

### PR21-3: Hidden Character Traits + Event Weighting

- 8-12 trait catalog
- deterministic assignment/backfill with 60% one-trait target
- contextual discovery and notifications
- revealed trait UI
- bounded event affinity
- recent actor-pair suppression

### PR21-4: Visible Training Effects + Balance Gate

- partner +3%, mentor/protege +4%, rival +3%
- combined social cap +5%
- visible training modifiers
- deterministic multi-season/multi-seed balance harness
- measured results report
- full release gates

## 19. Testing strategy

Use TDD for each PR.

Required focused coverage:

- relationship label boundaries
- explicit relationship-tag event effects
- rival valid at low relationship score
- mentor directionality and grade/score gate
- partner relationship threshold
- max-two-tags guard
- degradation windows
- graduation archival/cleanup
- deterministic hidden-trait assignment/backfill
- 60% assignment distribution sanity over a large deterministic sample
- reveal subset invariant
- no `randomCursor` change from backfill
- event affinity clamp
- pair repeat suppression
- normal event cadence preservation
- social contributions and +5% cap
- visible growth modifier labels
- fullscreen choice -> result -> confirm flow
- mandatory-event non-dismissibility
- keyboard/focus/reduced-motion behavior
- mobile safe-area behavior
- v8 -> v9 codec compatibility

Before opening each PR, use branch-only safe verification so intentional TDD RED states and exploratory balance failures do not create avoidable GitHub failure-notification noise.

Every final PR must pass official `dependency-audit`, `quality`, and `mobile-e2e`; after merge, verify exact-main-SHA CI before declaring the PR complete.

## 20. Acceptance criteria

Phase21 is complete when:

1. Choice-based manager/player events use a dedicated fullscreen experience instead of BottomSheet.
2. Results remain in the same fullscreen flow and clearly show consequences.
3. Personality is visible with understandable qualitative tendencies.
4. Player relationships are visible as label + gauge.
5. Rival, mentor, and partner relationships originate from explicit event outcomes and appear in UI.
6. Rival can coexist with an unfriendly relationship label.
7. Relationship-derived training bonuses are visible, contextual, and capped at +5%.
8. Hidden character traits are assigned/discovered without unseen performance bonuses before discovery.
9. Normal event cadence remains the existing three-week rhythm except due follow-ups.
10. Pair/category repetition controls prevent a single pair from dominating content.
11. Important relationships are archived at graduation.
12. Existing v8 saves migrate to v9 without loss of gameplay state.
13. Long-run multi-seed evidence satisfies hard invariants and records measured distribution metrics.
14. Focused, full, release, PR, and exact-main CI gates are green.
