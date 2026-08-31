# Phase 10 Training and Player Mobile UI Design

## Status

Design approved in conversation on 2026-08-31. This document freezes the Phase 10 product and architecture decisions before implementation planning.

## Goal

Make Training and Player/Lineup screens behave like a compact smartphone management game instead of vertically stacked web forms.

Phase 10 must:

- turn Training into a settings-only screen;
- move weekly training results out of Training and into persistent Home notifications;
- redesign the new-student scouting entry as a compact game action;
- compress roster and player detail layouts without shrinking important text;
- make lineup editing drag-first on touch devices while retaining a tap fallback;
- preserve existing game rules, cloud persistence, team validation, scouting behavior, and weekly progression.

## Why this is architectural

This is not a CSS-only refresh. The requested experience changes responsibility across four areas:

1. `advance-week` must create a durable notification together with the training result.
2. Home becomes the presentation point for weekly training results.
3. Training stops owning historical result presentation and only edits the next training plan.
4. Team lineup editing gains a second interaction model, drag-and-drop, which must use the same validated `TeamSelection` domain state as the existing picker.

The save schema therefore changes from version 5 to version 6.

---

## Considered approaches

### Approach A — CSS-only compression

Keep the current Training and Team component structure and only reduce padding, font sizes, and card heights.

**Advantages**

- smallest code diff;
- minimal persistence risk.

**Problems**

- training results still consume Training screen height;
- scouting remains a separate oversized block;
- player lineup is still tap/picker-only;
- does not satisfy persistent Home notification requirement;
- encourages sub-12px text to regain density.

**Decision:** rejected.

### Approach B — Local UI notification plus visual refactor

Move the training result to Home using `GameApp` React state, while compressing Training/Player screens and adding drag behavior locally.

**Advantages**

- avoids a save migration;
- simpler server changes.

**Problems**

- notification disappears on reload or device restart;
- a successful `advance-week` can be persisted while the result notification is lost;
- contradicts the approved requirement that unread notifications survive reload;
- not reusable for later injury, scouting, tournament, or growth notifications.

**Decision:** rejected.

### Approach C — Persistent game notifications + presentation refactor + validated drag editing

Store notifications in `GameState`, generate training-result notifications atomically during `advance-week`, and mark them read through the normal revisioned game-action path. Recompose Training and Player screens around Phase 9 mobile tokens. Add touch-friendly drag-and-drop as an additional lineup interaction while keeping tap/picker controls available.

**Advantages**

- satisfies reload persistence;
- no split-brain between saved training execution and notification creation;
- creates a reusable notification foundation;
- keeps lineup rules server-authoritative and validated;
- supports both fast drag interaction and accessible tap interaction.

**Cost**

- schema migration v5 -> v6;
- new domain notification model and action;
- more extensive E2E coverage.

**Decision:** adopt Approach C.

---

# 1. Persistent notification model

## 1.1 State shape

Add a notification state to `GameState`.

```ts
export interface GameNotificationState {
  items: GameNotification[];
}

export interface TrainingResultNotification {
  id: string;
  type: "training-result";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: TrainingResultNotificationPayload;
}

export type GameNotification = TrainingResultNotification;
```

Phase 10 implements only `training-result`, but the discriminated union is intentionally extensible for later:

- injury notices;
- scouting/recruiting outcomes;
- player growth events;
- tournament outcomes;
- school events.

Do not build a full notification inbox in Phase 10.

## 1.2 Training result payload

The notification must remain readable even if a player later graduates or the live player record changes. Therefore the payload snapshots presentation-safe player information at creation time instead of requiring the popup to reconstruct old names from current state.

```ts
interface TrainingResultNotificationPayload {
  teamTrainingMenuName: string;
  totalAbilityGrowth: number;
  totalFatigueChange: number;
  injuredCount: number;
  players: Array<{
    playerId: PlayerId;
    displayName: string;
    grade: number;
    preferredPosition: string;
    totalAbilityGrowth: number;
    fatigueChange: number;
    conditionChange: number;
    trustChange: number;
    injured: boolean;
    abilityChanges: Partial<Record<AbilityKey, number>>;
  }>;
}
```

The payload is a historical presentation snapshot. It must not be used to update current player state.

## 1.3 Notification IDs

Training notification IDs must be deterministic for one training execution so retries cannot create duplicates.

Recommended shape:

```text
training-result:<userSchoolId>:<yearIndex>:<weekOfYear>:<weekStartDate>
```

The exact helper may differ, but duplicate `advance-week` operation retries must never add a second identical notification.

## 1.4 Retention

- Persist at most 20 notification items.
- Always retain unread items when trimming.
- Trim oldest read items first.
- Home does not render all 20 items.

## 1.5 Read semantics

- Opening a notification detail popup immediately displays the locally available payload.
- After the popup opens, submit a revisioned `mark-notification-read` game action.
- If that save succeeds, `readAtGameDate` is populated.
- If it fails, the popup stays usable and the item remains unread; existing operation/error UI handles the persistence failure.
- Reading never deletes the historical payload immediately.

Home presentation:

- unread training result: prominent `NEW` row;
- current-week read training result: muted row so the user can reopen it;
- older read results: not shown on Home;
- older unread results: remain visible until read, newest first.

To prevent Home from becoming tall, render at most two notification rows. If more than two unread notifications exist, show a compact `お知らせ N件` control that opens a simple BottomSheet list. The full-screen inbox is out of scope.

## 1.6 Schema migration

Raise:

```ts
CURRENT_GAME_SCHEMA_VERSION = 6;
```

Add:

```ts
notifications: { items: [] }
```

when migrating version 5 saves.

The migration must preserve all existing state fields and must be covered by a dedicated v5 -> v6 migration test.

`gameStateCodec.ts` must validate the notification discriminated union and bounded item list.

---

# 2. Atomic training-result notification generation

## 2.1 Server-authoritative generation

Generate the notification inside `worker/game/applyGameAction.ts`, not in `GameApp` after the response arrives.

During `applyAdvanceWeek`:

1. If training has not run, resolve training as today.
2. Build a training-result notification from the exact `TrainingResult` and pre-progression player presentation data.
3. Append/dedupe the notification into `currentState.notifications`.
4. Continue official-match gating or week progression.
5. Persist the resulting state in the existing operation transaction.

This keeps training execution and its notification atomic.

If training was already completed before `advance-week`, do not fabricate a second result notification because the original result no longer exists in the action context.

The existing `trainingResult` outcome may remain temporarily for API compatibility, but Phase 10 UI no longer depends on `GameApp.latestTrainingResult`.

## 2.2 Mark-read action

Extend `worker/game/actionSchema.ts` with:

```ts
{ type: "mark-notification-read"; notificationId: string }
```

Rules:

- unknown notification ID: idempotent no-op or a documented conflict; prefer idempotent no-op;
- already read: idempotent no-op;
- never accepts arbitrary notification content from the client;
- uses the normal revision and `operationId` safeguards.

---

# 3. Home training-result notification UI

## 3.1 Placement

Place a compact Home notification zone immediately after the current-week action card and before team status.

A single unread row should be approximately 50–56px high:

```text
NEW  今週の練習結果       能力 +18  怪我 0   >
```

At narrow widths, secondary metrics may reduce to one concise summary but the row remains a single compact block.

## 3.2 Detail popup

Use an accessible modal/BottomSheet consistent with the existing mobile UI.

```text
今週の練習結果

チーム全体
能力成長 +18   疲労 +12   怪我 0人

田中 一郎    能力 +3
サーブ +2 / 跳躍 +1
疲労 +8 / 状態 0 / 信頼 +1

阿部 翔      能力 +2
レシーブ +2
疲労 +6 / 状態 +1 / 信頼 0

[閉じる]
```

Requirements:

- no text under 12px;
- player names 14px;
- aggregate numbers 16–20px;
- ability changes use concise chips/rows;
- injured players are visually and textually identified, never by color alone;
- popup content can scroll independently on short devices.

## 3.3 Home density

The notification must not undo the Phase 9 Home work.

- no large new hero card;
- maximum two notification rows on Home;
- the fixed bottom navigation remains unobstructed;
- no page-level horizontal scrolling at 320–480px.

---

# 4. Training screen — settings only

## 4.1 Remove historical result UI

Delete the visible `直近の練習結果` section from `TrainingScreen`.

Remove from the component:

- `latestResult` presentation prop;
- local `resultsExpanded` state;
- aggregate result calculations used only for that section;
- player-result list rendering.

Historical result presentation belongs to Home notifications after Phase 10.

## 4.2 Remove the large Training hero

Do not render the current large `週間育成 / 週間練習` hero.

The tab itself already identifies the context. Start directly with a compact screen heading/status row:

```text
育成                         平均疲労 25
```

Use:

- heading 18px;
- status 12px;
- 44px minimum interactive controls;
- Phase 9 shared spacing/radius tokens.

## 4.3 Primary layout

Target layout:

```text
育成                              疲労25

今週の練習
チーム練習
基礎練習                       変更 >
成長+5 / 疲労+12 / 怪我8%

個人育成
1  田中 一郎    サーブ狙い打ち       >
2  阿部 翔      レシーブ強化         >

新入生スカウト                       >
評判 E / スカウト網 Lv.0      候補を確認

                 [この内容で設定]
```

At 360x800 the save action must be reachable without requiring a long content scroll. At 390x844 the entire primary setup surface should fit above the fixed navigation under normal data.

## 4.4 Team training row

One compact row:

- label: `チーム練習`;
- selected menu name;
- concise growth/fatigue/injury metadata;
- chevron or `変更` affordance;
- whole row should be tappable where practical.

Menu selection remains a BottomSheet using existing training menu data.

## 4.5 Individual training rows

Replace each current multi-control card with a single compact row.

Visible row:

```text
1  田中 一郎   サーブ狙い打ち   >
```

Tap opens an assignment BottomSheet containing:

- current player + `選手を変更`;
- current instruction + `指示を変更`;
- player status relevant to the choice if space permits.

The existing player picker and instruction picker can be reused internally.

The visible screen must not show two separate `選手変更` / `指示変更` buttons for every slot.

## 4.6 Save action

Keep the 48px primary action `この内容で設定` above the fixed navigation.

When the week is already complete:

- settings become read-only;
- primary action becomes a compact disabled/completed state, not another large card.

No changes to training resolution rules.

---

# 5. New-student scouting entry

The current standalone white advertisement-like card is replaced by a compact action row inside the Training surface.

Target:

```text
新入生スカウト                         >
評判 E・スカウト網 Lv.0      獲得 1人
```

Rules:

- one semantic title only (`新入生スカウト`);
- no separate `来年度の戦力候補` headline;
- no duplicated `候補を調査` + button wording;
- whole row is clickable;
- height approximately 56–68px;
- use the same dark/navy panel family as the rest of the game;
- status count appears as a small 12px badge/text;
- existing `ScoutingScreen` behavior and API are unchanged in Phase 10.

---

# 6. Player Hub mobile redesign

## 6.1 Hub tabs

Keep the three modes:

- 選手一覧
- 編成
- チーム状態

Use the existing segmented-control concept, but enforce Phase 9 typography:

- 44px minimum height;
- 12–13px labels;
- no smaller 360px override.

## 6.2 Roster list

Replace the current tall mobile row with a dense two-line game roster row around 52–58px.

Example:

```text
12  田中 一郎          WS  2年      総合67
    178cm                           状態82
```

Priorities:

1. player name;
2. overall;
3. position/grade;
4. condition/fatigue cue;
5. height.

Rules:

- name 14px minimum;
- metadata 12px minimum;
- do not display reading/furigana in the list if it forces another line;
- whole row opens player detail;
- no desktop-table header on mobile;
- no horizontal roster scrolling.

## 6.3 Player detail header

Remove the oversized typography balance where the name and total power dominate the viewport.

Target:

```text
< 選手一覧
田中 一郎                         総合 67
2年・WS・178cm
```

Typography:

- name 18px;
- total power value 20–22px;
- metadata 12px;
- back target >=44px.

## 6.4 Ability and state layout

Keep ability bars but make the first viewport information-dense.

```text
攻撃      72  ███████---
守備      65  ██████----
跳躍      70  ███████---
スタミナ  58  █████-----
メンタル  64  ██████----

状態82   疲労14   士気70
役割 先発          信頼56
```

No Phase 10-owned labels under 12px.

Concerns remain below the core state section and can scroll naturally.

---

# 7. Lineup screen — compact court

## 7.1 Court presentation

Keep the familiar 3x2 volleyball court, but reduce each player tile from the current 112px-plus-pin footprint.

Target player tile height: roughly 70–82px depending on width and content.

Each court tile should prioritize:

```text
4  佐藤
MB   65
```

Optional small fatigue/condition indicator may be included if it does not reduce text below 12px.

Do not put a separate `先発固定` button under every court tile.

## 7.2 Starter lock

Move starter-lock editing into the tap detail/picker BottomSheet for the selected slot/player.

The court tile may show a small lock/pin visual when active, but drag gestures and primary player identification must not be obstructed by a second button under every tile.

## 7.3 Bench

Keep a component-level horizontal bench rail because it is a natural game interaction and avoids making the page excessively tall.

This is an explicit exception to the no-horizontal-page-scroll rule:

- page/body must never scroll horizontally;
- bench rail may scroll horizontally;
- compact bench cards approximately 104–124px wide;
- card text >=12px.

---

# 8. Drag-and-drop lineup editing

## 8.1 Interaction model

Drag is the fast path; tap remains the reliable fallback.

Touch:

- short tap -> opens existing slot/player BottomSheet;
- press-and-hold approximately 180–250ms -> begins drag;
- moving beyond tolerance before activation keeps normal page/rail scrolling;
- active drag card visually lifts;
- valid targets highlight;
- invalid targets are visibly disabled;
- release on valid target -> submit one updated `TeamSelection`;
- release elsewhere -> cancel with no mutation.

Mouse/pointer:

- small movement threshold starts drag without long touch delay.

Keyboard/accessibility:

- drag must not be the only way to change a player;
- existing tap/BottomSheet controls remain fully usable;
- any drag library keyboard sensor is additive, not required for task completion.

## 8.2 Implementation technology

Prefer `@dnd-kit/core` for the interaction layer rather than native HTML5 drag-and-drop.

Reasons:

- native HTML5 drag is unreliable for the desired touch-first behavior;
- dnd-kit supports pointer/touch activation constraints;
- easier control over scroll-versus-drag activation;
- accessible sensor model;
- no need for a sortable abstraction because court and bench are explicit drop zones.

Do not introduce a large UI framework.

## 8.3 Domain transformation helper

Drag UI must not hand-edit selection arrays ad hoc.

Create a pure domain helper such as:

```ts
repositionTeamSelection(selection, source, target): TeamSelection
```

with explicit slot descriptors:

```ts
type TeamPlacement =
  | { type: "rotation"; slot: RotationSlot }
  | { type: "libero" }
  | { type: "bench"; playerId: PlayerId };
```

Every resulting selection is validated with the existing `validateTeamSelection` before `onChange`.

## 8.4 Movement rules

### Rotation -> rotation

Swap the two `rotation.playerId` assignments.

The set of six servers does not change, so `servingOrderPlayerIds` remains the same set/order.

### Bench -> rotation / rotation -> bench player

Swap the incoming bench player with the court player.

- replace outgoing starter ID with incoming ID in `servingOrderPlayerIds`;
- remove incoming ID from bench and add outgoing ID at the same or stable bench position;
- remove outgoing starter lock if it is no longer a starter;
- validate final selection.

### Bench -> bench

Reorder `benchPlayerIds` for presentation convenience. No match-rule effect.

### Bench <-> libero

Swap the selected bench player and libero.

- ensure no overlap with rotation;
- update starter locks if required;
- validate final selection.

### Rotation <-> libero

Do not enable this direct drop in Phase 10. The user can perform it through the tap picker/bench route. This avoids ambiguous serving-order and libero semantics in the first drag release.

## 8.5 Persistence

One successful drop calls the existing `onChange(nextSelection)` once.

`GameApp` continues to submit the existing revisioned `team-selection` action. Do not add a separate drag-specific API.

While a team-selection operation is submitting:

- disable new drag starts;
- retain visible state from the current authoritative snapshot;
- use existing save/operation status.

---

# 9. Visual system

Phase 10 extends the Phase 9 mobile game language instead of creating another visual theme.

Use:

- navy/dark panels for primary surfaces;
- teal/blue for Training actions;
- orange/accent for active game state where already established;
- white text and muted blue-gray secondary text;
- 14px normal body;
- 12px labels/captions minimum;
- 16px section headings;
- 18px compact screen/card titles;
- 44px minimum touch targets;
- 48px primary actions;
- card radius 10–14px;
- vertical gaps primarily 8–12px.

Avoid:

- isolated large white web-form cards;
- 10–11px text;
- repeated explanatory paragraphs;
- separate buttons where one tappable row communicates the same action;
- giant player names or total-power numerals that push useful data below the fold.

---

# 10. Responsive acceptance

Test at minimum:

- 320x568;
- 360x800;
- 390x844;
- 414x896;
- 480px wide framed layout.

## Training

- no page-level horizontal overflow;
- no Phase 10 Training text under 12px;
- team menu + two individual rows visible without large empty blocks;
- scouting entry is one compact row;
- no `直近の練習結果` section on Training;
- primary save action remains above fixed navigation and is reachable without a long scroll at 360x800.

## Home notifications

- `advance-week` creates one persistent training-result notification when training executes;
- reload preserves unread notification;
- opening it shows the result modal;
- marking read survives reload;
- current-week read result can still be reopened from the muted row;
- no more than two notification rows expand Home.

## Player roster/detail

- roster rows fit within viewport width at 320px;
- roster/player detail has no text below 12px;
- player detail name and total power no longer dominate the first viewport;
- key abilities and state are visible near the top.

## Lineup

- 3x2 court fits at 320px without horizontal page overflow;
- player tiles remain readable;
- tap replacement still works;
- long-press drag can swap rotation players;
- bench-to-court drop performs one valid saved swap;
- invalid/cancelled drop makes no state change;
- fixed bottom navigation is never covered by drag overlays.

---

# 11. Testing strategy

## Unit/domain

Add tests for:

- notification ID deduplication;
- notification retention/read behavior;
- v5 -> v6 migration;
- training-result notification payload snapshot;
- mark-read idempotency;
- rotation <-> rotation swap;
- bench <-> rotation swap and serving-order replacement;
- bench reorder;
- bench <-> libero swap;
- invalid drag transformation rejection.

## Worker/action

Add tests proving:

- `advance-week` atomically returns state with exactly one training notification;
- operation retry does not duplicate it;
- official-match-required path still persists the training notification before redirecting;
- mark-read action only changes notification read state;
- existing team-selection validation remains authoritative.

## Component

Add Training tests for compact rows and absence of result section.

Add Home tests for notification row, popup content, and read callback.

Add PlayerHub/Team tests for compact semantic content and tap fallback.

## E2E

Add a Phase 10 mobile E2E suite covering:

1. configure training;
2. return Home;
3. advance week;
4. see `NEW 今週の練習結果`;
5. reload and verify notification still exists;
6. open popup and verify aggregate/player details;
7. close/reload and verify read state persists;
8. Training screen remains compact and has no historical result section;
9. roster/detail layout audit at narrow widths;
10. drag a court player onto another court slot and verify saved placement after reload;
11. drag a bench player into a court slot and verify saved replacement after reload.

Existing full Quality and mobile E2E suites remain required before merge.

---

# 12. Non-goals for Phase 10

Do not include:

- new training balance or menus;
- new scouting candidate logic;
- a full notification center/history screen;
- push notifications or OS notifications;
- lineup tactics editor;
- rotation animation during matches;
- direct rotation <-> libero drag;
- new player portraits/character art;
- redesign of PvP, Shop, School, or Match result screens;
- changes to training, match, tournament, or recruiting economics.

These can be separate phases after the core mobile interaction is stable.

---

# 13. Delivery gate

Phase 10 is complete only when:

1. schema v6 migration is covered and existing saves decode;
2. training notifications are server-generated and reload-persistent;
3. Training is settings-only and compact;
4. scouting entry is integrated as a compact action row;
5. Player roster/detail follows Phase 9 typography floors;
6. lineup supports touch drag plus tap fallback;
7. all domain/unit/component tests pass;
8. all mobile E2E tests pass at the required widths;
9. production build passes;
10. PR review finds no Critical/Important issue;
11. main is merged only after the branch CI is green.
