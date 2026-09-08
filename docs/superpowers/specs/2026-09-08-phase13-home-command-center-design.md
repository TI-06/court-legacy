# Phase 13 Home Command Center Design

## Goal

Turn the Home tab from a collection of independent status cards into the game's weekly command center.

After Phase 13, opening Home should answer three questions within a few seconds:

1. What is happening this week?
2. What should I pay attention to or act on?
3. What is the next major competitive objective?

Phase 13 is primarily a presentation and orchestration phase. It connects existing systems instead of introducing another large persistence subsystem.

## Baseline and constraints

The design assumes the current `main` baseline after PR #68, including:

- weekly training and practice-match progression;
- official tournaments;
- player condition and injuries;
- team dynamics, including cohesion and player concerns;
- training-result notifications;
- school funds, facilities up to level 50, and annual assistant-coach contracts;
- scouting;
- pre-match preparation for practice, official and PvP matches;
- temporary match-only lineup presets and edits.

The current `GameState` schema already contains the data required for Phase 13. Phase 13 must not increment the save schema version unless implementation proves a requirement cannot be derived from existing state.

The current notification model intentionally retains only the newest training-result notification. Phase 13 must not repurpose this structure into a generic persistent news feed.

## Design principles

### Weekly command center

Home is the primary place to understand and advance the weekly game loop.

The intended loop is:

1. Open Home.
2. Review current week, next official objective and team condition.
3. Act on relevant coaching tasks.
4. Start a match when one is due.
5. Review recent outcome/growth information.
6. Advance the week.

### Decisions, not chores

The game should surface decisions without forcing players to clear every item before progressing.

Examples of non-blocking items:

- injured players;
- player concerns;
- facility upgrades that are affordable;
- no assistant coach contracted;
- optional scouting actions.

The week advance action remains available unless the user is currently in a mutually exclusive operation state.

A confirmation warning is shown only when advancing the week discards an immediately expiring choice. In Phase 13 that means an unanswered incoming practice-match offer.

### Derived presentation model

Home tasks and Home news are derived from current `GameState` on render wherever possible.

Do not persist derived Home items merely to display them.

This keeps:

- old saves compatible;
- Home logic testable as pure selectors;
- the notification subsystem bounded;
- future Phase 17 rankings and later systems easy to plug into the same presentation model.

## Architecture

Introduce a dedicated Home presentation selector rather than continuing to grow `HomeScreen.tsx` with inline conditionals.

Expected shape:

```ts
interface HomeCommandCenterModel {
  summary: HomeSummary;
  tasks: HomeCommandTask[];
  news: HomeCommandNews[];
  advance: HomeAdvanceState;
}
```

The exact type names may change during implementation, but responsibilities must remain separated.

Recommended files:

- `src/features/home/homeCommandCenter.ts`
- `src/features/home/HomeCommandCenter.tsx`
- existing `src/features/home/HomeScreen.tsx` as the screen/container boundary

`homeCommandCenter.ts` contains pure state-to-view-model logic and no React state.

`HomeCommandCenter.tsx` renders the model and emits navigation/action intents.

`GameApp` remains responsible for actual screen transitions and authoritative game actions.

## Navigation contract

Avoid expanding `HomeScreenProps` with many more `onOpenX` callbacks.

Introduce a small UI-oriented action contract, conceptually:

```ts
type HomeCommandAction =
  | { target: "training" }
  | { target: "team" }
  | { target: "player"; playerId: PlayerId }
  | { target: "facilities" }
  | { target: "staff" }
  | { target: "scouting" }
  | { target: "match" }
  | { target: "tournament" };
```

Use discriminated payloads when a target needs an entity. Do not encode IDs into route-like strings.

This contract must not become a second application router.

## Home layout

The screen has four conceptual regions:

1. Weekly summary
2. Coaching tasks
3. Coaching news
4. Persistent week-advance CTA

### 1. Weekly summary

The top area is compact and immediately readable.

Show:

- current game date;
- current week number;
- user school short name/name;
- next official tournament/match summary when available;
- team strength and grade;
- average team condition presentation;
- cohesion and trend.

Example:

```text
4/15・第3週                         青峰高校

インターハイ県大会
準々決勝 vs 白波高校                  あと2週

戦力 A / 8420     😄 好調     結束 78 ↑
```

If an official match is due this week, replace `あとN週` with a stronger `今週` state.

Do not display prefectural/national rank in Phase 13. Ranking belongs to Phase 17 and must not be approximated with unrelated metrics.

The summary view model must leave an extension point so rank can be added in Phase 17 without restructuring Home.

### 2. Coaching tasks

Tasks answer: **what might the coach want to do now?**

Tasks are sorted by severity/urgency, not by subsystem.

Priority bands:

1. `critical` — due official match or expiring decision
2. `attention` — significant player concern/injury
3. `normal` — normal weekly action or useful management action
4. `complete` — completed weekly actions shown only when useful for context

Render **at most five task cards**. If more than five candidates exist, lower-priority candidates are either aggregated by subsystem or omitted according to deterministic priority order.

Tie-breaking must be deterministic so the same `GameState` always produces the same ordered task list.

#### Official-match task

When an official match is due:

```text
公式戦
県大会 準決勝
vs 白波高校
[試合準備 >]
```

The action enters the existing pre-match preparation flow. Phase 13 does not duplicate lineup editing or simulation.

When the next official competition is future rather than due, it belongs in the summary, not as a red task every week.

#### Practice-match task

If a practice opponent is scheduled and the match is not completed:

```text
練習試合
vs 東高校
[試合 >]
```

If an incoming offer exists and no opponent is scheduled, keep explicit Accept/Decline controls.

The offer is an expiring choice. Advancing the week with an unanswered offer triggers the Phase 13 advance confirmation.

#### Training task

Use current weekly training state.

Possible presentation:

```text
練習
バランス練習
設定済み
```

or:

```text
練習
今週分完了 ✓
```

Do not require users to change training every week. The existing low-friction training loop remains intact.

#### Player-concern task

Use existing `teamDynamics.playerConcerns`.

Prioritize concerns by:

1. severity descending;
2. player grade descending;
3. player ID ascending as the final stable tie-breaker.

Show at most two player-concern cards before the overall five-card Home limit is applied.

Example:

```text
選手から相談
山田 太郎
出場機会への不満・重要度3
[確認 >]
```

Supported concern codes remain the existing domain values:

- playing-time
- role-mismatch
- injury-overuse
- team-slump

Task navigation should open the relevant player detail when possible, not merely the generic roster.

#### Injury task

Injuries are attention items, not mandatory tasks.

For one injured player:

```text
注意
佐藤 健
怪我・あと2週
```

For two or more injured players, aggregate:

```text
怪我人 3名
[選手を確認 >]
```

Do not reintroduce fatigue-management chores through the injury UI.

#### Facility task

If at least one facility upgrade is currently affordable and valid, surface one low-priority management task.

If multiple upgrades are possible, aggregate them:

```text
学校
強化可能な設備 4件
[設備を見る >]
```

Do not show a task merely because a facility exists or because the user is short of money.

#### Assistant-coach task

If no assistant coach is contracted, recommend a contract only during **academic weeks 1 through 8 inclusive**.

This is a normal recommendation, not a blocking warning. After week 8, Home does not repeatedly nag the user about the missing annual coach during that academic year.

No new persisted dismissal flag is introduced in Phase 13.

#### Scouting task

Phase 13 may expose an existing immediately useful scouting action if current state already makes it obvious, but it must not redesign scouting logic. The deeper recruitment loop belongs to Phase 19.

## Coaching news

News answers: **what happened?**

News is distinct from tasks.

- Task: action or decision still available.
- News: outcome, trend or recent event worth seeing.

News is primarily derived from existing state and recent history.

Render **at most three news items**.

Priority order:

1. unread newest training result;
2. latest match outcome;
3. significant individual growth from newest training result;
4. meaningful cohesion change;
5. other low-value informational items introduced later.

Tie-breaking must be deterministic.

### Training result news

Reuse the existing newest training-result notification and existing bottom sheet.

Example:

```text
🔥 今週の練習
チーム成長 +27
山田 +8 / 佐藤 +6 / 鈴木 +5
```

Tapping opens the existing training-result detail sheet and marks it read through the existing action.

### Significant growth news

Derive this only from the newest training notification.

A player qualifies as `急成長` in Phase 13 when `totalAbilityGrowth >= 5` for that weekly training result.

If multiple players qualify, show only the highest-growth player; ties use player ID ascending for deterministic selection.

Example:

```text
急成長
山田 太郎・今週 +8
```

Do not claim long-term streaks or `直近4週` growth in Phase 13 because long-term growth history is a Phase 14 concern.

### Match outcome news

Use the most recent match involving the user school that can be resolved from existing match history/state.

Example:

```text
前節
○ 青峰高校 2-1 白波高校
```

Do not duplicate the full match-result UI on Home.

### Cohesion news

Use existing:

- `cohesion`
- `previousCohesion`
- `cohesionTrend`

A cohesion news item qualifies when the absolute change is **3 or more points**.

Example:

```text
チーム状態
結束 74 → 78・上向き
```

This threshold prevents a limited news slot from being consumed by negligible changes.

## Week-advance CTA

The week-advance control is the dominant Home action.

Label:

`今週を進める`

It remains visually available near the bottom of the viewport, directly above the application's bottom navigation and safe-area inset.

It must not cover Home content or bottom navigation.

Implementation may use sticky positioning inside the Home shell rather than global fixed positioning if that produces safer scrolling behavior across 320-480 px devices.

### Advance warning

Most incomplete/recommended Home items do not block week advancement.

The only Phase 13 warning condition is:

- an unanswered incoming practice-match offer exists and advancing the week would discard that offer.

Example:

```text
練習試合の申し込みが未回答です。
このまま次週へ進みますか？

[戻る] [そのまま進む]
```

Do not add warnings for:

- injuries;
- player concerns;
- affordable upgrades;
- no assistant coach;
- optional scouting;
- completed or unchanged training settings.

## Match flow integration

Phase 13 preserves the current pre-match flow.

When week advancement encounters a due practice/official match, the existing application flow still opens pre-match preparation before authoritative simulation.

The Home Command Center must not:

- simulate matches itself;
- persist a temporary lineup;
- bypass the server action;
- duplicate pre-match lineup selectors;
- alter PvP privacy behavior.

## UI behavior and visual hierarchy

### Information hierarchy

The user should visually encounter information in this order:

1. week and next objective;
2. team snapshot;
3. urgent coaching tasks;
4. optional/completed coaching tasks;
5. recent news;
6. week advance.

This order resolves the earlier ambiguity between team snapshot and tasks: the compact team snapshot belongs to the top summary, while the task list begins immediately below that summary.

### Task card anatomy

A task card normally contains:

- compact category/status badge;
- strong title;
- one-line supporting detail;
- one clear action/chevron if actionable.

Avoid multiple primary buttons inside ordinary task cards. Practice offers are the explicit exception because Accept/Decline is the decision itself.

### Completed tasks

Completed tasks use subdued styling and must not dominate the page.

If five higher-value task cards already exist, completed cards are omitted before any active task is omitted.

### Mobile requirements

Primary supported widths:

- 320 px
- 360 px
- 390 px
- 414 px
- 480 px

Requirements:

- no horizontal page overflow;
- task cards are single-column;
- primary touch targets should be approximately 44 px high where practical;
- the week-advance CTA does not collide with bottom navigation or safe-area insets;
- long school/player names truncate gracefully;
- core summary remains readable at 320 px;
- Home must not require horizontal scrolling.

At narrow widths, the summary's three key team values remain a compact three-cell layout:

- strength;
- condition;
- cohesion.

Reduce secondary labels before reducing touch-target size.

## Empty and edge states

### No upcoming official event

Omit the official objective line or show a neutral season state. Do not invent an opponent.

### Missing optional school/opponent data

Render known public information only. Existing guest official and PvP privacy rules remain unchanged.

### No tasks

Show a compact positive state such as `今週の準備は整っています` rather than leaving a blank section.

### No news

Omit the news section. Do not populate generic filler messages.

### Operation pending

Existing authoritative actions that are already pending disable conflicting controls and prevent duplicate submission.

## Data and persistence

Phase 13 uses existing sources:

- `calendar` / weekly completion IDs;
- `weeklySchedule`;
- `officialSeason` / tournament selectors;
- `teamDynamics`;
- `players` / injuries / condition;
- `notifications`;
- `history.matches`;
- `schoolManagement` and school funds;
- existing facility/assistant-coach evaluators.

No new generic Home task array is persisted in `GameState`.

No new generic Home news history is persisted in `GameState`.

No Worker endpoint is required solely for Home rendering.

## Testing strategy

### Selector unit tests

Cover at minimum:

- ordinary week;
- official match due this week;
- future official event in summary only;
- scheduled practice match;
- incoming practice offer;
- training configured and training completed;
- player concern severity/tie ordering;
- maximum two player concerns;
- injury aggregation;
- affordable facility upgrade aggregation;
- assistant coach recommendation on week 1 and week 8;
- no assistant coach recommendation from week 9 onward;
- unread training-result news;
- significant growth at the `>= 5` threshold;
- latest match outcome news;
- cohesion news at absolute change `>= 3`;
- no cohesion news below threshold;
- task priority order;
- maximum five tasks;
- maximum three news items;
- deterministic ordering for ties;
- no invented prefectural rank.

### Component tests

Cover:

- summary rendering;
- task rendering/order;
- task navigation intents;
- practice Accept/Decline controls;
- training notification bottom-sheet opening;
- empty task/news states;
- week-advance warning.

### App integration tests

Cover Home intents routing to:

- player detail/team screen;
- training;
- school facilities/staff where supported;
- scouting;
- tournament;
- match/pre-match.

Confirm existing due-match advancement still enters pre-match preparation before simulation.

### E2E / mobile regression

At 320, 360, 390, 414 and 480 px:

- no horizontal overflow;
- summary readable;
- at least one task interaction works;
- practice offer interaction remains usable;
- week-advance CTA remains visible/usable without bottom-nav overlap;
- due match proceeds through pre-match preparation;
- normal week can advance;
- pending operations cannot be double-submitted.

## Out of scope for Phase 13

Explicitly defer:

- prefectural/national ranking calculation and persistence;
- season goal system;
- player long-term growth history;
- saved lineup presets beyond the existing pre-match presets;
- tactical attack/serve/block/defense systems;
- in-match coaching decisions;
- scouting/recruitment redesign;
- rivalry overhaul;
- alumni career outcomes;
- coach career achievements;
- PvP seasons;
- generic notification/event-stream architecture;
- save schema migration unless a concrete blocker is discovered.

These belong to later roadmap phases.

## Acceptance criteria

Phase 13 is complete when:

1. Home clearly presents current week, next official objective and team snapshot.
2. Home derives a prioritized coaching-task list of at most five cards from current game state.
3. Home derives at most three useful recent news items without creating a new persistent news feed.
4. Player concerns, injuries, practice offers, match preparation and school management actions route to appropriate existing screens/actions.
5. `今週を進める` remains the dominant Home CTA and preserves the current authoritative week/match flow.
6. Only an unanswered expiring practice-match offer produces the Phase 13 advance warning.
7. No prefectural/national rank is fabricated before Phase 17.
8. Existing saves remain compatible without a Phase 13 schema migration.
9. Mobile layouts at 320/360/390/414/480 px have no horizontal overflow and no bottom-navigation collision.
10. Unit, integration, production build and mobile E2E verification remain green.

## Future extension points

The Phase 13 presentation model intentionally leaves space for later phases:

- Phase 14: recent/long-term player growth summaries;
- Phase 15: active tactical plan summary;
- Phase 16: match-command readiness/context;
- Phase 17: prefectural/national rank and season goals;
- Phase 18: richer school development milestones;
- Phase 19: scouting/recruitment alerts;
- Phase 20: rivalry/legacy events;
- Phase 21: PvP season rank/status.

These future fields should extend the derived Home model rather than force a rewrite of Home's architecture.
