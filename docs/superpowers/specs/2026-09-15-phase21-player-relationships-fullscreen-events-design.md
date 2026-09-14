# Phase21 Player Relationships / Personality / Fullscreen Events Design

Date: 2026-09-15
Status: approved design draft for implementation planning
Base: main @ ada00b3ff95dc6523d3b2974233fcff8a5598931

## 1. Goal

Phase21 turns existing player personality, trust, morale, player-to-player relationship values, and event content into a visible long-term character system.

The phase must make players feel different from one another without introducing large hidden combat bonuses. Character systems should primarily influence event selection, relationship development, trust/morale, and small visible training modifiers.

The second goal is presentation. Choice-based manager/player events are currently compressed into a BottomSheet. In Phase21, choice-based events become a dedicated fullscreen game experience on mobile and desktop.

## 2. Non-goals

Phase21 does not perform the broader match-presentation overhaul planned for Phase22.

Phase21 does not add large direct match-stat bonuses from friendship, rivalry, personality, or undiscovered character traits.

Phase21 does not turn every notification into a fullscreen screen. Informational notifications such as ordinary training-result summaries remain compact unless they require a user choice.

Phase21 does not increase normal event cadence above the existing roughly once-per-three-weeks schedule. Due chain follow-ups retain their current priority behavior.

## 3. Existing foundations to reuse

The current model already contains:

- `Player.personalityId`
- `Player.traitIds`
- `Player.hiddenTraitIds`
- `Player.morale`
- `Player.trust`
- `Player.leadership`
- `Player.teamAdaptation`
- `GameState.playerRelationships`
- relationship/captaincy/rivalry event categories
- relationship-triggered event eligibility
- event effects that change relationship, trust, morale, ability, fatigue, traits, reputation, funds, facilities, and injury state
- personality modifiers for training stability, relationship growth, morale volatility, and pressure
- event memory for recent event/category/actor suppression

The existing personality catalog already includes ten distinct personalities, so Phase21 should expose and connect these systems rather than create a second competing personality model.

## 4. Product principles

### 4.1 Visible effects over hidden power

Any gameplay modifier that affects training growth must be shown in the training result. Phase21 must not add an invisible `+X%` relationship bonus.

### 4.2 Relationships come from history

Special relationships must be established through actual event history, not only because a numeric score crossed a threshold.

### 4.3 Negative relationships create stories, not punishment loops

Low relationships can produce tension, conflict, or reconciliation events, but Phase21 will not apply a permanent direct training penalty merely because two players dislike each other.

### 4.4 Event drama without event spam

Character depth is expressed by changing which eligible event is more likely, not by increasing the base event frequency.

## 5. Player personality presentation

Personality is public from the beginning.

Player detail must display:

- personality name
- personality description
- qualitative tendencies derived from the existing personality definition

Recommended presentation dimensions:

- training stability
- relationship building
- pressure response
- morale volatility

These should be qualitative labels such as `高 / 標準 / 低`, `得意 / 普通 / 苦手`, or equivalent game-language badges. The UI should not expose raw internal coefficient numbers unless a later product decision explicitly requires that.

Personality continues using the existing training calculations. Phase21 must not duplicate the existing personality training modifier.

## 6. Relationship score presentation

`GameState.playerRelationships` remains the canonical 0-100 pair score.

Presentation labels are:

- 0-19: 犬猿
- 20-39: 不仲
- 40-59: 普通
- 60-79: 好相性
- 80-100: 親友

The player detail screen shows a relationship section containing relevant teammates, a visible gauge, the relationship label, and any special relationship tags.

Default relationship remains 50 when no canonical entry exists.

## 7. Special relationships

Phase21 introduces three special relationship kinds:

- `rival` / ライバル
- `mentor` / 師弟
- `partner` / 相棒

These tags are separate from the numeric relationship label. A pair can therefore be `ライバル + 不仲`, `ライバル + 好相性`, or another valid combination.

A pair may hold at most two special relationship tags.

### 7.1 Rival

Rivalry must be established by a competition-oriented event or explicit relationship transition source. It does not require a minimum relationship score.

Normal sources include:

- same-position competition event
- explicit rivalry chain event
- repeated competition-related event outcome

When two rivals have the same preferred position and are both actively participating in that week's training, each may receive a visible `+3%` social training modifier.

### 7.2 Mentor

Mentor is directional and stores mentor/protege identity.

Baseline requirements:

- players are in different grades
- a coaching/mentoring event has occurred
- pair relationship is at least 60 at establishment

When both are actively participating in the same week's training, the protege may receive a visible `+4%` social training modifier.

### 7.3 Partner

Baseline requirements:

- pair relationship is at least 80
- a cooperation/coordination event has occurred

Setter-attacker combinations may receive greater event-selection affinity but not a larger training percentage.

When both are actively participating in the same week's training, each may receive a visible `+3%` social training modifier.

### 7.4 Social training cap

All Phase21 relationship-derived training modifiers combined are capped at `+5%` per player per weekly training resolution.

The result log must still identify the contributing relationships. If raw contributions exceed the cap, UI should make the cap understandable rather than silently truncate it.

No Phase21 special relationship applies a direct hidden match-stat bonus.

## 8. Active relationship state

Add a canonical state structure for special relationships rather than encoding them into event history alone.

Recommended model:

```ts
export type SpecialRelationshipKind = "rival" | "mentor" | "partner";

export interface SpecialRelationshipTag {
  kind: SpecialRelationshipKind;
  establishedDate: GameDate;
  sourceEventId: EventId | null;
  lastReinforcedDate: GameDate;
  mentorPlayerId?: PlayerId;
  protegePlayerId?: PlayerId;
}

export interface PlayerRelationshipBond {
  playerIds: [PlayerId, PlayerId];
  tags: SpecialRelationshipTag[];
}
```

`GameState.playerRelationshipBonds` is a record keyed by the existing sorted `relationshipKey`.

The exact TypeScript shape may be adjusted during implementation if persistence simplicity improves, but the canonical behavior must remain directional for mentor relations and bounded to two tags per pair.

## 9. Relationship reinforcement and removal

Special relationships do not disappear immediately when the numeric relationship score drops.

Each tag records `lastReinforcedDate`.

A relationship can be removed or transformed by:

- a dedicated event outcome
- prolonged deterioration below a tag-specific threshold
- graduation/end of active shared team membership

Phase21 should prefer event-driven removal when possible. Numeric deterioration is a fallback guard against stale impossible relationships.

Recommended fallback windows:

- partner: eligible for degradation after at least 8 consecutive weeks below relationship 60
- mentor: eligible for degradation after at least 8 consecutive weeks below relationship 50
- rival: does not degrade solely because relationship is low; rivalry can coexist with hostility

Implementation may use a compact weekly streak state or last-qualified-date representation. The persisted form must be deterministic and bounded.

## 10. Graduation / legacy history

Important special relationships survive as historical records when a player graduates.

Add a bounded relationship legacy history under `GameHistory`, containing at minimum:

- both player IDs
- both display names at archival time
- relationship kinds
- mentor/protege direction where relevant
- establishment dates
- final relationship score
- archive/graduation date

Recommended maximum retained records: 200, keeping newest records.

Active bonds involving a graduated player are removed after archival.

## 11. Hidden character traits

### 11.1 Purpose

`Player.hiddenTraitIds` currently exists but generated players receive an empty array. Phase21 gives this field a concrete role: undiscovered character traits.

These are not hidden ability bonuses.

Examples:

- 面倒見がいい
- 研究熱心
- 練習の虫
- 負けを引きずらない
- 仲間思い
- 一人で抱え込みやすい
- 注目されると燃える
- 競争相手がいると伸びる

### 11.2 Separate catalog from performance traits

Performance traits in `traitIds` already use ability/situation modifier definitions. Character traits must not be forced into that same effect contract.

Phase21 should add a separate character-trait definition/catalog with data needed for:

- display name
- description
- event tags/weights
- relationship-change tendencies where applicable
- discovery contexts

The initial Phase21 catalog should stay small and curated. Eight to twelve character traits is sufficient.

### 11.3 Assigned vs revealed

`hiddenTraitIds` stores assigned character-trait IDs.

Add a revealed/discovered subset, recommended as:

```ts
revealedHiddenTraitIds: string[];
```

Only revealed traits appear in the player UI and begin applying their event-selection/relationship behavior.

No hidden character trait applies an unseen training or match modifier before discovery.

### 11.4 Assignment

Phase21 should use at most one hidden character trait per player for the initial implementation. This keeps discovery readable and avoids character sheets becoming cluttered.

Newly generated players are assigned zero or one hidden character trait using deterministic seeded generation.

Existing v8 saves must not require a restart. Existing active players receive deterministic backfill based on stable inputs such as `seed + playerId`, without consuming or shifting the normal simulation `randomCursor`.

A one-time initialization marker or equivalent deterministic migration guard is required so a player cannot be re-rolled on reload.

### 11.5 Discovery

Discovery is contextual, not a generic random popup.

Supported discovery contexts may include:

- trust threshold
- minimum weeks in program
- official match appearances
- captain/vice-captain assignment
- injury recovery
- creation of partner/rival/mentor relationship
- tagged event outcome

Each character trait should define one or more meaningful discovery contexts. Discovery occurs only when its context is satisfied.

Discovery itself is an informational notification, not a choice event, so it does not consume the normal event slot.

Example notification:

> 新しい個性を発見！
> 田中 悠真「面倒見がいい」
> 後輩を支える場面が起こりやすくなりました。

## 12. Event-selection integration

Normal event cadence remains unchanged: normal selection is still gated by the existing three-week rhythm, while due follow-ups may surface when due.

Phase21 modifies candidate weights only after existing eligibility/cooldown checks have passed.

New bounded weighting inputs may include:

- personality tags
- current relationship label
- active special relationship tags
- revealed character traits

The combined character/relationship weighting multiplier must be bounded. Recommended final multiplier range is `0.75x` to `1.50x` before existing event/category recent penalties.

Special relationship weighting must never bypass:

- event cooldown
- trigger eligibility
- once-per-career guard
- scheduled follow-up rules

## 13. Pair repetition control

Phase21 must prevent the same pair from dominating relationship content.

Extend `EventMemory` with a bounded recent pair history, recommended:

```ts
recentActorPairKeys: string[];
```

Recommended length: 6.

For two-actor events, an exact pair that appeared in recent pair history receives a strong repeat penalty. Recommended initial multiplier: `0.20x`.

Existing recent-event and recent-category penalties remain in place.

Long-run tests must verify that one pair does not monopolize the relationship event stream.

## 14. Fullscreen choice-event experience

### 14.1 Scope

Every `PendingEvent` flow that asks the player to choose an action uses the fullscreen event experience.

This includes manager decision events, player events, relationship events, captaincy events, rivalry events, and other choice-based event categories.

Ordinary informational notifications remain compact.

### 14.2 Replace BottomSheet structure

`EventDialog` currently renders both the choice state and resolution state through `BottomSheet`. Phase21 replaces this with a dedicated fullscreen overlay/screen component.

Recommended component boundary:

```ts
<FullscreenEventExperience
  state={state}
  data={data}
  onChoose={...}
/>
```

The component may preserve `EventDialog` as a compatibility wrapper during migration, but the final Phase21 UI must not rely on BottomSheet sizing for event choices or their results.

### 14.3 Mobile layout

Use the full viewport (`100dvh`) with safe-area handling.

Structure:

1. category/status header
2. large event title
3. actor area
4. scrollable story/content region
5. sticky choice/action region near the bottom safe area

The center content may scroll; choice buttons remain easy to reach.

The screen must support 2-4 choices without shrinking text to fit.

### 14.4 Actor presentation

Actor cards are larger than the current compact BottomSheet cards and show:

- player name
- grade/position
- current public personality
- relevant relationship label/special tag when the event involves two players

No new player portrait system is required in Phase21. Existing initials/emblem treatment can be upgraded without blocking on art assets.

### 14.5 Choice presentation

Each choice uses a large touch target and shows:

- action label
- short explanatory detail

The UI does not preview exact hidden numeric results unless the event definition explicitly intends to reveal them. The result screen provides the actual visible outcome.

### 14.6 Resolution presentation

After a choice is resolved, the fullscreen event screen remains open and transitions in-place to a result state.

Show:

- selected action
- involved players
- visible result changes
- relationship label transition when relevant
- special relationship establishment/removal when relevant
- character trait discovery if caused synchronously by the resolution

The user then explicitly confirms and returns to the game.

### 14.7 Accessibility

The fullscreen event layer must:

- use dialog/screen semantics appropriate to the application shell
- trap or otherwise correctly manage keyboard focus
- return focus meaningfully when closed
- lock background interaction
- respect `prefers-reduced-motion` and the game's reduced-motion setting
- support mobile safe areas
- meet existing tap-target and contrast expectations

Mandatory events remain non-dismissible until a valid choice is resolved.

## 15. Training integration

Relationship-derived growth is implemented through the existing growth modifier path rather than a second training formula.

Add dedicated visible modifier codes, for example:

- `relationship-partner`
- `relationship-mentor`
- `relationship-rival`

The relationship modifier builder receives current state/player/training participation and returns bounded additional growth modifiers.

A player is considered actively training for a social bonus only when the relevant players are on the active team and are not skipped by injury or auto-rest for that weekly resolution.

The social cap is applied after collecting relationship contributions and before passing them to the normal growth calculation.

## 16. Notifications

Create compact informational notifications for:

- special relationship established
- special relationship removed/transformed
- hidden character trait discovered

These notifications must not use the fullscreen choice UI unless they require a player decision.

The notification copy should explain the gameplay consequence in plain language.

## 17. Persistence and schema migration

Phase21 requires persisted state additions and therefore should increment the game schema from v8 to v9.

v8 -> v9 migration defaults:

- `playerRelationshipBonds = {}`
- relationship legacy history = `[]`
- recent actor pair history = `[]`
- `revealedHiddenTraitIds = []` for existing players
- character-trait initialization marker defaults to false for existing players if such a marker is used

Character trait backfill for existing active players must be deterministic and must not advance the simulation random cursor.

The migration must preserve existing `playerRelationships`, personalities, `traitIds`, event history, and current pending event without semantic changes.

Old saves must load successfully and encode canonically as v9.

## 18. Long-run balance requirements

Run deterministic long-run evidence with at least two fixed seeds across multiple seasons.

Hard assertions:

- normal event cadence does not exceed the existing schedule solely because of Phase21
- no invalid special relationship references after graduation
- no pair has more than two active special relationship tags
- social training bonus never exceeds +5%
- hidden character trait backfill does not shift `randomCursor`
- discovered traits are a subset of assigned hidden traits
- old v8 saves migrate successfully

Distribution metrics to record:

- relationship events per season
- unique actor pairs represented
- maximum share for one actor pair
- number of partner/rival/mentor establishments
- relationship removals/transitions
- hidden trait discoveries per season
- percentage of players with a discovered character trait by graduation
- average and max applied social training modifier

Soft targets for initial tuning:

- no single pair should account for more than 35% of two-player relationship events over a sufficiently populated sample
- special relationships should feel notable rather than universal; the majority of all possible teammate pairs should not simultaneously carry special tags
- hidden trait discoveries should be common enough to be noticed but not fire as a bulk reveal wave immediately after migration

Exact measured results must be documented before Phase21 completion.

## 19. PR decomposition

### PR21-1: Fullscreen Event Experience + Personality Presentation

- replace BottomSheet-based choice/result event UI with fullscreen event experience
- mobile `100dvh` / safe-area / sticky choices
- in-place result state
- public personality name/description/tendency presentation on player detail
- accessibility and mobile E2E coverage

This PR should avoid persistence/schema changes where possible.

### PR21-2: Relationship Labels + Special Relationships

- relationship presentation selector/labels/gauge
- special relationship state and schema v9 foundation
- rival/mentor/partner establishment rules
- event-result relationship transitions
- player detail relationship section
- graduation relationship legacy archival
- compatibility migration defaults

### PR21-3: Hidden Character Traits + Event Weighting

- character trait catalog
- deterministic assignment/backfill
- discovery rules and notifications
- revealed trait UI
- bounded personality/relationship/character-trait event weighting
- recent actor pair suppression

### PR21-4: Visible Training Effects + Balance Gate

- partner +3%, mentor/protege +4%, rival +3% rules
- combined social cap +5%
- training result modifier visibility
- deterministic multi-season / multi-seed balance harness
- measured Phase21 result report
- full release gates

## 20. Testing strategy

Use TDD for each PR.

Required focused suites include:

- relationship label boundaries
- special relationship establishment rules
- rival with low relationship score remains valid
- mentor directionality
- max-two-tags guard
- graduation archival and active-state cleanup
- character trait deterministic backfill
- reveal subset invariant
- no random cursor movement from migration/backfill
- event weight bounding
- pair repeat suppression
- event cadence preservation
- social training contribution and +5% cap
- visible growth modifier labels
- fullscreen event choice/result flow
- non-dismissible mandatory event behavior
- keyboard/focus behavior
- reduced motion behavior
- mobile viewport/safe-area behavior
- v8 -> v9 codec compatibility

Before each PR is opened, use the project's branch-only safe verification approach so intentionally red TDD states and exploratory balance failures do not create avoidable failed GitHub notification noise.

Each final PR must pass official `dependency-audit`, `quality`, and `mobile-e2e` checks before merge. After merge, verify the exact main SHA CI before declaring that PR complete.

## 21. Acceptance criteria

Phase21 is complete when:

1. Choice-based manager/player events use a fullscreen dedicated event experience rather than BottomSheet.
2. Event results remain visible in the same fullscreen experience and clearly show consequences.
3. Every player personality is visible with understandable qualitative tendencies.
4. Player-to-player relationship scores are visible as label + gauge.
5. Rival, mentor, and partner relations can be established through actual event history and are shown in player UI.
6. Rival can coexist with an unfriendly relationship label.
7. Relationship-derived training bonuses are visible, contextual, and capped at +5% total.
8. Hidden character traits are assigned/discovered without invisible performance bonuses before discovery.
9. Normal event cadence remains at the existing three-week rhythm except for due follow-ups.
10. Pair/category repetition control prevents one relationship pair from dominating event content.
11. Important relationships are archived on graduation.
12. Existing v8 saves migrate to v9 without loss of existing gameplay state.
13. Long-run multi-seed evidence satisfies hard invariants and documents measured distribution metrics.
14. All focused, full, release, PR, and exact-main CI gates are green.
