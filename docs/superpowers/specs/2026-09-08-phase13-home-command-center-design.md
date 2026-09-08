# Phase 13 Home Command Center Design

## Goal

Turn the Home tab from a collection of independent status cards into the game's weekly command center.

After Phase 13, opening Home should answer three questions within a few seconds:

1. What is happening this week?
2. What should I pay attention to or act on?
3. What is the next major competitive objective?

Phase 13 is primarily a presentation and orchestration phase. It should connect existing systems instead of introducing another large persistence subsystem.

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

The current `GameState` schema already contains the data required for Phase 13. Phase 13 must not increment the save schema version unless implementation reveals a concrete requirement that cannot be derived from existing state.

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

A confirmation warning may be shown only when advancing the week would discard an immediately expiring choice, such as an unanswered practice-match offer.

### Derived presentation model

Most Home tasks and news are derived from current `GameState` on render.

Do not persist derived Home items merely to display them.

This keeps:

- old saves compatible;
- Home logic testable as pure selectors;
- the notification subsystem bounded;
- future Phase 17 rankings and other systems easy to plug into the same presentation model.

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

The exact naming may change during implementation, but responsibilities should remain separated.

Recommended files:

- `src/features/home/homeCommandCenter.ts`
- `src/features/home/HomeCommandCenter.tsx`
- existing `src/features/home/HomeScreen.tsx` as the screen/container boundary

`homeCommandCenter.ts` should contain pure state-to-view-model logic and no React state.

`HomeCommandCenter.tsx` should focus on rendering the model and emitting navigation/action intents.

`GameApp` remains responsible for actual screen transitions and authoritative game actions.

## Navigation contract

Avoid expanding `HomeScreenProps` with many more `onOpenX` callbacks.

Introduce a small target contract, conceptually:

```ts
type HomeCommandTarget =
  | "training"
  | "team"
  | "player"
  | "school"
  | "facilities"
  | "staff"
  | "scouting"
  | "match"
  | "tournament";
```

If a target needs an entity, use a discriminated payload rather than encoding IDs in strings, for example:

```ts
type HomeCommandAction =
  | { target: "player"; playerId: PlayerId }
  | { target: "facilities" }
  | { target: "match" }
  | { target: "tournament" }
  | ...;
```

This contract should stay UI-oriented. It should not become a second application router.

## Home layout

The screen is divided into four conceptual regions:

1. Weekly summary
2. Coaching tasks
3. Coaching news
4. Persistent week-advance CTA

### 1. Weekly summary

The top area should be compact and immediately readable.

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

The summary view model should be designed so rank can be added later without restructuring Home.

### 2. Coaching tasks

Tasks answer: **what might the coach want to do now?**

Tasks are sorted by severity/urgency, not by subsystem.

Suggested priority bands:

1. `critical` — due official match or expiring decision
2. `attention` — significant player concern/injury
3. `normal` — normal weekly action or useful management action
4. `complete` — completed weekly actions shown only when useful for context

Limit the rendered list to a compact set, normally at most five visible task cards. Lower-priority items may be summarized into one aggregate task where appropriate.

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

The offer is treated as an expiring choice. Advancing the week with an unanswered offer is one of the few states allowed to trigger a confirmation warning.

#### Training task

Use the current weekly training state.

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

Prioritize concerns by severity, then use a stable deterministic tie-breaker.

Show at most one or two player concern tasks.

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

For one player:

```text
注意
佐藤 健
足首の怪我・あと2週
```

For multiple players, prefer aggregation such as:

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

If no assistant coach is contracted, Home may recommend contracting one during a suitable early-year window.

This is a recommendation, not a blocking warning and not a permanent red badge every week.

Implementation should define a deterministic eligibility window based on existing calendar data rather than introducing a new persisted dismissal flag in Phase 13.

#### Scouting task

Phase 13 may expose an existing immediately useful scouting action if current state already makes it obvious, but it must not redesign scouting logic. The deeper recruitment loop belongs to Phase 19.

## Coaching news

News answers: **what happened?**

News is distinct from tasks.

- Task: action or decision still available.
- News: outcome, trend or recent event worth seeing.

News is primarily derived from existing state and recent history.

Display at most three news items.

Suggested priority:

1. unread newest training result;
2. latest official/practice match outcome;
3. significant individual growth from newest training result;
4. injury occurrence/recovery if currently derivable without new persistence;
5. meaningful cohesion change;
6. other low-value informational items.

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

A significant individual growth item may be derived from the newest training notification.

Example:

```text
急成長
山田 太郎・今週 +8
```

Do not claim long-term streaks or `直近4週` growth in Phase 13 because long-term growth history is a Phase 14 concern.

### Match outcome news

Use recent match history/latest available result.

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

Example:

```text
チーム状態
結束 74 → 78・上向き
```

Only show it when the change is meaningful enough to justify one of the limited news slots.

## Week-advance CTA

The week-advance control is the dominant Home action.

Label:

`今週を進める`

It should remain visually available near the bottom of the viewport, directly above the application's bottom navigation and safe-area inset.

It must not cover Home content or bottom navigation.

Implementation may use sticky positioning inside the Home shell rather than global fixed positioning if that produces safer scrolling behavior across 320-480 px devices.

### Advance warning

Most incomplete/recommended Home items do not block week advancement.

Warning is allowed only when advancing the week causes a meaningful expiring choice to be lost.

Initial Phase 13 supported warning:

- unanswered incoming practice-match offer.

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
- completed/unchanged training settings.

## Match flow integration

Phase 13 must preserve the current pre-match flow.

When week advancement encounters a due practice/official match, the existing application flow should still open pre-match preparation before authoritative simulation.

The Home Command Center is not allowed to:

- simulate matches itself;
- persist a temporary lineup;
- bypass the server action;
- duplicate pre-match lineup selectors;
- alter PvP privacy behavior.

## UI behavior and visual hierarchy

### Information hierarchy

The user should visually encounter information in this order:

1. week / next objective;
2. urgent coaching task;
3. team snapshot;
4. optional management tasks;
5. recent news;
6. week advance.

The exact card placement may vary after mobile visual testing, but the priority must remain clear.

### Task card anatomy

A task card should normally contain:

- compact category/status badge;
- strong title;
- one-line supporting detail;
- one clear action/chevron if actionable.

Avoid multiple primary buttons inside ordinary task cards. Practice offers are the explicit exception because Accept/Decline is the decision itself.

### Completed tasks

Completed tasks use subdued styling and should not dominate the page.

If the page becomes too long, completed context may be folded into the weekly summary rather than keeping a full card.

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

The news section may be omitted. Do not populate generic filler messages.

### Operation pending

Existing authoritative actions that are already pending must disable conflicting controls and prevent duplicate submission.

## Data and persistence

Phase 13 should use existing sources:

- `calendar` / weekly completion IDs;
- `weeklySchedule`;
- `officialSeason` / tournament selectors;
- `teamDynamics`;
- `players` / injuries / condition;
- `notifications`;
- `history.matches`;
- `schoolManagement` and school funds;
- existing facility/assistant-coach evaluators.

No new generic Home task array should be persisted in `GameState`.

No new generic Home news history should be persisted in `GameState`.

No Worker endpoint is required solely for Home rendering.

## Testing strategy

### Selector unit tests

Cover at minimum:

- ordinary week;
- official match due this week;
- future official event in summary only;
- scheduled practice match;
- incoming practice offer;
- training configured / training completed;
- player concern severity ordering;
- injury aggregation;
- affordable facility upgrade aggregation;
- assistant coach recommendation window;
- unread training-result news;
- significant training growth news;
- recent match outcome news;
- cohesion-change news;
- task priority order;
- maximum task/news counts;
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
2. Home derives a prioritized compact coaching-task list from current game state.
3. Home derives up to three useful recent news items without creating a new persistent news feed.
4. Player concerns, injuries, practice offers, match preparation and school management actions route to appropriate existing screens/actions.
5. `今週を進める` remains the dominant Home CTA and preserves the current authoritative week/match flow.
6. Only genuinely expiring choices produce advance warnings.
7. No prefectural/national rank is fabricated before Phase 17.
8. Existing saves remain compatible without a Phase 13 schema migration.
9. Mobile layouts at 320/360/390/414/480 px have no horizontal overflow and no bottom-navigation collision.
10. Unit, integration, production build and mobile E2E verification remain green.

## Future extension points

The Phase 13 presentation model should intentionally leave space for later phases:

- Phase 14: recent/long-term player growth summaries;
- Phase 15: active tactical plan summary;
- Phase 16: match-command readiness/context;
- Phase 17: prefectural/national rank and season goals;
- Phase 18: richer school development milestones;
- Phase 19: scouting/recruitment alerts;
- Phase 20: rivalry/legacy events;
- Phase 21: PvP season rank/status.

These future fields should extend the derived Home model rather than forcing a rewrite of Home's architecture.
