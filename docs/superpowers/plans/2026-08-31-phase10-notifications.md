# Phase 10 Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist weekly training-result notifications in the game save, render them from Home, and support durable read state.

**Architecture:** Add a small notification domain module and `GameState.notifications`, migrate schema v5 to v6, create training notifications inside the server-side `advance-week` action, and mark them read through the existing revisioned action pipeline. Home consumes only persisted notification payloads; `GameApp.latestTrainingResult` is removed.

**Tech Stack:** TypeScript 5.9, React 19, Zod 4, Vitest 4, Testing Library, existing Cloudflare worker game-action flow.

**Spec:** `docs/superpowers/specs/2026-08-31-phase10-training-player-mobile-ui-design.md`

## Global Constraints

- Raise `CURRENT_GAME_SCHEMA_VERSION` from 5 to 6.
- Persist at most 20 notifications; preserve unread items and trim oldest read items first.
- Training-result IDs are deterministic for one school/year/week/date and append is idempotent.
- Notification content is server-generated; clients may only submit `notificationId` when marking read.
- Opening a notification must remain useful even if the mark-read save fails.
- Home renders at most two notification rows and no Phase 10-owned text below 12px.
- The newest training result remains reopenable after being read until a newer training result exists.
- Existing revision and `operationId` semantics remain authoritative.

---

### Task 1: Add notification domain state and pure helpers

**Files:**
- Create: `src/domain/notifications/gameNotifications.ts`
- Modify: `src/domain/model/GameState.ts`
- Create: `tests/unit/domain/notifications/gameNotifications.test.ts`

**Interfaces:**
- Produces: `GameNotificationState`, `GameNotification`, `TrainingResultNotification`, `TrainingResultNotificationPayload`
- Produces: `buildTrainingResultNotification(input): TrainingResultNotification`
- Produces: `appendNotification(state, item): GameNotificationState`
- Produces: `markNotificationRead(state, notificationId, readDate): GameNotificationState`
- Produces: `selectHomeTrainingNotifications(state): TrainingResultNotification[]`

- [ ] **Step 1: Write the failing domain tests**

```ts
it("deduplicates the same deterministic training notification", () => {
  const first = appendNotification({ items: [] }, notification);
  const second = appendNotification(first, notification);
  expect(second.items).toHaveLength(1);
});

it("trims oldest read items before unread items", () => {
  const next = appendNotification(stateWithTwentyItems, newestUnread);
  expect(next.items).toHaveLength(20);
  expect(next.items.some((item) => item.id === oldestRead.id)).toBe(false);
  expect(next.items.some((item) => item.id === oldestUnread.id)).toBe(true);
});

it("keeps the newest read training result visible until a newer result exists", () => {
  expect(selectHomeTrainingNotifications(state)).toEqual([
    olderUnread,
    newestRead,
  ]);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm test -- tests/unit/domain/notifications/gameNotifications.test.ts`

Expected: FAIL because `src/domain/notifications/gameNotifications.ts` does not exist.

- [ ] **Step 3: Implement the notification model and helpers**

Use these public shapes:

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

export interface BuildTrainingResultNotificationInput {
  stateBeforeTraining: GameState;
  result: TrainingResult;
  data: GameDataRegistry;
}
```

Build the ID with:

```ts
`training-result:${state.userSchoolId}:${state.yearIndex}:${state.calendar.weekOfYear}:${state.date}`
```

Snapshot `displayName`, `grade`, `preferredPosition`, ability changes, fatigue/condition/trust changes, injury flag, menu name, aggregate growth, aggregate fatigue, and injured count from the pre-progression state plus exact `TrainingResult`.

- [ ] **Step 4: Run the domain test and verify GREEN**

Run: `npm test -- tests/unit/domain/notifications/gameNotifications.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/notifications/gameNotifications.ts src/domain/model/GameState.ts tests/unit/domain/notifications/gameNotifications.test.ts
git commit -m "feat: add persistent game notifications"
```

### Task 2: Add schema v6 migration and codec validation

**Files:**
- Modify: `src/persistence/gameStateCodec.ts`
- Modify: `tests/unit/persistence/gameStateCodec.test.ts`
- Create: `tests/unit/persistence/phase10GameStateMigration.test.ts`

**Interfaces:**
- Consumes: `GameNotificationState` from Task 1.
- Produces: v6 decode/encode support for `notifications`.

- [ ] **Step 1: Write the failing migration and codec tests**

```ts
it("migrates a version 5 save to version 6 with an empty notification state", () => {
  const decoded = decodeGameState(JSON.stringify(versionFiveState));
  expect(decoded.schemaVersion).toBe(6);
  expect(decoded.notifications).toEqual({ items: [] });
});

it("round-trips a training result notification", () => {
  const encoded = encodeGameState(stateWithNotification);
  expect(decodeGameState(encoded).notifications.items[0]?.type).toBe(
    "training-result",
  );
});
```

- [ ] **Step 2: Run codec tests and verify RED**

Run: `npm test -- tests/unit/persistence/gameStateCodec.test.ts tests/unit/persistence/phase10GameStateMigration.test.ts`

Expected: FAIL on schema version and missing notification validation/migration.

- [ ] **Step 3: Implement v6 migration and Zod schema**

Add `notifications` to `gameStateSchema`, including a strict discriminated union for `training-result`, bounded `items.max(20)`, ability-change records using `abilityKeySchema`, and `readAtGameDate` nullable date validation.

Add `migrateVersionFive()`:

```ts
function migrateVersionFive(legacy: Record<string, unknown>): unknown {
  return {
    ...legacy,
    schemaVersion: CURRENT_GAME_SCHEMA_VERSION,
    notifications: { items: [] },
  };
}
```

Route version 5 through it and leave older migrations chaining into v6.

- [ ] **Step 4: Run codec tests and verify GREEN**

Run: `npm test -- tests/unit/persistence/gameStateCodec.test.ts tests/unit/persistence/phase10GameStateMigration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/gameStateCodec.ts tests/unit/persistence/gameStateCodec.test.ts tests/unit/persistence/phase10GameStateMigration.test.ts
git commit -m "feat: migrate saves to notification schema v6"
```

### Task 3: Generate and mark notifications through game actions

**Files:**
- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify: `tests/unit/worker/applyGameAction.test.ts`
- Modify: `tests/unit/worker/gameAction.test.ts`
- Modify: `tests/unit/worker/deferredTrainingPlan.test.ts`
- Modify: `tests/unit/worker/officialMatchAction.test.ts`

**Interfaces:**
- Consumes: `buildTrainingResultNotification`, `appendNotification`, `markNotificationRead`.
- Produces action: `{ type: "mark-notification-read"; notificationId: string }`.

- [ ] **Step 1: Write failing worker and route idempotency tests**

Add the basic generation assertion:

```ts
const advanced = applyGameAction(snapshot, { type: "advance-week" });
expect(advanced.state.notifications.items).toHaveLength(1);
expect(advanced.state.notifications.items[0]?.type).toBe("training-result");
```

Then pre-seed the same deterministic notification into the same-week snapshot while leaving training incomplete, call `advance-week`, and assert the builder/append path still leaves exactly one item with that ID:

```ts
const preseeded = {
  ...snapshot,
  state: {
    ...snapshot.state,
    notifications: { items: [existingNotification] },
  },
};
const deduped = applyGameAction(preseeded, { type: "advance-week" });
expect(
  deduped.state.notifications.items.filter(
    (item) => item.id === existingNotification.id,
  ),
).toHaveLength(1);
```

Extend the existing duplicate-operation route test in `gameAction.test.ts` so its cached response contains a training notification; assert the duplicate request returns that exact cached response and still calls neither `getSnapshot` nor `applyOperation`. This is the `operationId` retry guarantee; no second game mutation is performed.

For the official-match-required path, assert the notification exists in the returned state before redirect behavior. For mark-read, assert unknown and already-read IDs are idempotent no-ops.

- [ ] **Step 2: Run worker tests and verify RED**

Run: `npm test -- tests/unit/worker/applyGameAction.test.ts tests/unit/worker/gameAction.test.ts tests/unit/worker/deferredTrainingPlan.test.ts tests/unit/worker/officialMatchAction.test.ts`

Expected: FAIL because the action and generation logic do not exist.

- [ ] **Step 3: Implement action generation and mark-read handling**

Inside `applyAdvanceWeek`, capture `stateBeforeTraining`, run existing training, build the notification from the exact `TrainingResult`, append it to `currentState.notifications`, then continue official-match gating/week progression.

Add:

```ts
function applyMarkNotificationRead(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "mark-notification-read" }>,
): AppliedGameAction {
  return {
    state: {
      ...state,
      notifications: markNotificationRead(
        state.notifications,
        action.notificationId,
        state.date,
      ),
    },
    teamSelection,
  };
}
```

Register the action in the Zod discriminated union and `applyGameAction` switch.

- [ ] **Step 4: Run worker tests and verify GREEN**

Run the same command as Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/game/actionSchema.ts worker/game/applyGameAction.ts tests/unit/worker/applyGameAction.test.ts tests/unit/worker/gameAction.test.ts tests/unit/worker/deferredTrainingPlan.test.ts tests/unit/worker/officialMatchAction.test.ts
git commit -m "feat: create training notifications on week advance"
```

### Task 4: Render persistent notifications on Home

**Files:**
- Create: `src/features/home/TrainingResultNotificationSheet.tsx`
- Create: `src/features/home/training-result-notification.css`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/home.css`
- Modify: `src/app/GameApp.tsx`
- Modify: `tests/unit/features/home/HomeScreen.test.tsx`
- Create: `tests/unit/features/home/TrainingResultNotificationSheet.test.tsx`

**Interfaces:**
- HomeScreen new prop: `onMarkNotificationRead(notificationId: string): Promise<void> | void`.
- Consumes: `selectHomeTrainingNotifications(state)`.

- [ ] **Step 1: Write failing Home/UI tests**

```tsx
expect(screen.getByText("NEW")).toBeInTheDocument();
expect(screen.getByText("今週の練習結果")).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: /今週の練習結果/ }));
expect(screen.getByRole("dialog", { name: "今週の練習結果" })).toBeInTheDocument();
expect(onMarkNotificationRead).toHaveBeenCalledWith(notification.id);
```

Also assert the newest read result remains rendered, older read results do not, and only two rows are directly shown.

- [ ] **Step 2: Run Home tests and verify RED**

Run: `npm test -- tests/unit/features/home/HomeScreen.test.tsx tests/unit/features/home/TrainingResultNotificationSheet.test.tsx`

Expected: FAIL because notification UI is missing.

- [ ] **Step 3: Implement compact Home rows and detail sheet**

`HomeScreen` derives rows from state and renders them immediately after the current-week action block. Opening a row sets local selected notification state, opens the sheet, and invokes the mark-read callback after opening.

In `GameApp`, add:

```ts
const markNotificationRead = async (notificationId: string) => {
  await cloudSession.runAction(
    { type: "mark-notification-read", notificationId },
    "お知らせを更新しています…",
  );
};
```

Pass the callback into Home. Remove `latestTrainingResult` state and stop assigning it in `advanceWeek`.

- [ ] **Step 4: Run Home tests and verify GREEN**

Run the same command as Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/TrainingResultNotificationSheet.tsx src/features/home/training-result-notification.css src/features/home/HomeScreen.tsx src/features/home/home.css src/app/GameApp.tsx tests/unit/features/home/HomeScreen.test.tsx tests/unit/features/home/TrainingResultNotificationSheet.test.tsx
git commit -m "feat: show persistent training results on home"
```

### Task 5: Verify notification subsystem end to end

**Files:**
- Create: `tests/e2e/phase10-notifications.spec.ts`

**Interfaces:**
- Consumes all previous tasks.
- Produces reload-persistence coverage.

- [ ] **Step 1: Add the failing mobile E2E path**

Cover: save training plan -> Home -> next week -> `NEW 今週の練習結果` -> reload -> still present -> open sheet -> reload -> read state persisted -> row still reopenable until a newer training result exists.

- [ ] **Step 2: Run the focused E2E and verify failures are meaningful**

Run: `npx playwright test tests/e2e/phase10-notifications.spec.ts --project=mobile`

Expected: no infrastructure errors; any failure must point to the Phase 10 behavior under test.

- [ ] **Step 3: Fix only notification integration defects found by E2E**

Do not change training balance, tournament flow, or navigation behavior while fixing this task.

- [ ] **Step 4: Run focused and subsystem verification**

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test tests/e2e/phase10-notifications.spec.ts --project=mobile
```

Expected: all GREEN.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/phase10-notifications.spec.ts
git commit -m "test: cover persistent training notifications"
```
