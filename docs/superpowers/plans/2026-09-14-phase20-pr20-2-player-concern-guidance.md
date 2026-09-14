# Phase20 PR20-2 Player Concern Guidance & Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every existing player concern explain its trigger, current progress, and concrete resolution path, then notify the user exactly once when an official-match dynamics update clears concerns.

**Architecture:** Keep the four existing concern rules authoritative and add a derived `playerConcernGuidance` selector for copy/progress. Detect resolved concerns at the existing official-match dynamics boundary (`recordOfficialTournamentOutcome` around `applyOfficialMatchDynamicsFeedback`) and append one grouped concern-resolution notification per official match, while retaining only the newest training notification and newest concern-resolution notification independently.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4, Testing Library, existing notification and team-dynamics domain code.

**Spec:** `docs/superpowers/specs/2026-09-14-phase20-rivalry-legacy-team-relationships-design.md`

## Global Constraints

- Do not retune the existing concern trigger thresholds in this PR.
- Do not promise a fixed number of matches where rolling usage windows make resolution variable.
- `playing-time`, `role-mismatch`, `injury-overuse`, and `team-slump` must all have actionable guidance.
- Concern resolution is evaluated at the existing authoritative dynamics reevaluation boundary; do not invent a separate background concern engine.
- Latest training result remains available; concern notifications must not evict it.
- Notification storage stays strictly bounded.
- Schema stays v8 and existing saves/notifications remain valid.
- Focused tests and typecheck must be GREEN before ordinary PR CI.

---

### Task 1: Build pure concern guidance selectors

**Files:**

- Create: `src/domain/dynamics/playerConcernGuidance.ts`
- Create: `tests/unit/domain/dynamics/playerConcernGuidance.test.ts`
- Read/Reuse: `src/domain/dynamics/derivePlayerDynamics.ts`
- Read/Reuse: `src/domain/dynamics/teamDynamicsTypes.ts`

**Interfaces:**

- Produces:

```ts
export interface PlayerConcernGuidance {
  code: PlayerConcernCode;
  severity: 1 | 2 | 3;
  title: string;
  reason: string;
  resolution: string;
  progressLabel: string;
  status: "needs-action" | "improving";
}

export function buildPlayerConcernGuidance(
  state: GameState,
  playerId: PlayerId,
  concern: PlayerConcern,
): PlayerConcernGuidance;

export function selectPlayerConcernGuidance(
  state: GameState,
  playerId: PlayerId,
): PlayerConcernGuidance[];
```

- [ ] **Step 1: Write RED tests for `playing-time` guidance**

Create a state with `recentOfficialMatchesTracked = 4`, player usage `0`, and a `playing-time` concern. Assert:

```ts
expect(guidance.title).toBe("出場機会への不満");
expect(guidance.reason).toContain("直近4試合");
expect(guidance.progressLabel).toContain("0/4");
expect(guidance.resolution).toContain("公式戦");
expect(guidance.status).toBe("needs-action");
```

Add another still-concerned fixture with non-zero recent usage and assert status can be `improving` without promising “あとN試合”.

- [ ] **Step 2: Write RED tests for the other three concern codes**

Assert:

- `role-mismatch`: names current role and instructs starter/ace usage.
- `injury-overuse`: mentions active injury and recent official usage, instructs stopping official-match use while injured.
- `team-slump`: reports the current three official losses and says an official win breaks the slump condition.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/unit/domain/dynamics/playerConcernGuidance.test.ts
```

Expected: FAIL because selector does not exist.

- [ ] **Step 4: Implement guidance without changing concern derivation**

Read `state.teamDynamics.recentOfficialStarterCounts`, `recentOfficialMatchesTracked`, current role, injury state, and recent official match summaries. Keep helper functions private and deterministic.

Do not edit thresholds in `derivePlayerConcerns()`.

- [ ] **Step 5: Run focused regression and commit**

```bash
npx vitest run \
  tests/unit/domain/dynamics/playerConcernGuidance.test.ts \
  tests/unit/domain/dynamics/derivePlayerDynamics.test.ts \
  tests/unit/domain/dynamics/officialMatchDynamics.test.ts
npm run typecheck
git add src/domain/dynamics/playerConcernGuidance.ts tests/unit/domain/dynamics/playerConcernGuidance.test.ts
git commit -m "feat: explain player concern resolution paths"
```

---

### Task 2: Derive resolved concern transitions

**Files:**

- Create: `src/domain/dynamics/concernResolution.ts`
- Create: `tests/unit/domain/dynamics/concernResolution.test.ts`

**Interfaces:**

- Produces:

```ts
export interface ResolvedPlayerConcern {
  playerId: PlayerId;
  code: PlayerConcernCode;
}

export function selectResolvedPlayerConcerns(
  before: TeamDynamicsState["playerConcerns"],
  after: TeamDynamicsState["playerConcerns"],
): ResolvedPlayerConcern[];
```

- [ ] **Step 1: Write RED transition tests**

Assert a concern present before and absent after is returned exactly once; still-present and newly-added concerns are not returned; result order is deterministic by `playerId` then concern code.

```ts
expect(selectResolvedPlayerConcerns(before, after)).toEqual([
  { playerId: playerA, code: "playing-time" },
  { playerId: playerB, code: "team-slump" },
]);
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/domain/dynamics/concernResolution.test.ts
```

- [ ] **Step 3: Implement pure set-diff helper**

Do not mutate either concern map and do not persist any concern history.

- [ ] **Step 4: Run and commit**

```bash
npx vitest run tests/unit/domain/dynamics/concernResolution.test.ts
npm run typecheck
git add src/domain/dynamics/concernResolution.ts tests/unit/domain/dynamics/concernResolution.test.ts
git commit -m "feat: derive resolved player concerns"
```

---

### Task 3: Add a bounded concern-resolution notification type

**Files:**

- Modify: `src/domain/notifications/gameNotifications.ts`
- Modify: `src/persistence/gameStateCodec.ts`
- Modify: `tests/unit/persistence/gameStateCodec.test.ts`
- Create or Modify: `tests/unit/domain/notifications/gameNotifications.test.ts`

**Interfaces:**

- Extend notifications:

```ts
export interface ConcernResolutionNotificationItem {
  playerId: PlayerId;
  displayName: string;
  concernCode: PlayerConcernCode;
  concernTitle: string;
}

export interface ConcernResolutionNotification {
  id: string;
  type: "concern-resolution";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: { items: ConcernResolutionNotificationItem[] };
}

export type GameNotification =
  TrainingResultNotification | ConcernResolutionNotification;
```

- Add builder:

```ts
export function buildConcernResolutionNotification(input: {
  state: GameState;
  matchId: MatchId;
  resolved: readonly ResolvedPlayerConcern[];
}): ConcernResolutionNotification;
```

- Add selector:

```ts
export function selectHomeConcernResolutionNotifications(
  state: GameNotificationState,
): ConcernResolutionNotification[];
```

- [ ] **Step 1: Write RED notification tests**

Assert deterministic id:

```ts
expect(notification.id).toBe(`concern-resolution:${matchId}`);
```

Assert multiple resolved concerns from one official match are grouped into one payload and player display names are materialized.

- [ ] **Step 2: Write RED retention tests**

Start with a training notification, append a concern-resolution notification, then append newer notifications of each type. Assert:

- only newest training result remains,
- only newest concern-resolution remains,
- neither type evicts the other,
- duplicate notification id is ignored.

The retained item count must never exceed 2.

- [ ] **Step 3: Write codec RED tests**

Extend the notification Zod union so old training-only v8 saves still decode and a v8 state with a concern-resolution item round-trips.

Run:

```bash
npx vitest run tests/unit/domain/notifications/gameNotifications.test.ts tests/unit/persistence/gameStateCodec.test.ts
```

Expected: FAIL on the new notification type before implementation.

- [ ] **Step 4: Implement union, builder, per-type retention, selectors, and codec**

Replace the global `MAX_NOTIFICATION_ITEMS = 1` behavior with newest-one-per-supported-type retention. Keep `selectHomeTrainingNotifications()` behavior exactly newest-one training item.

Update `notificationStateSchema` to accept a discriminated union of training-result and concern-resolution records while remaining bounded to max 2 after encode.

- [ ] **Step 5: Run regression and commit**

```bash
npx vitest run tests/unit/domain/notifications/gameNotifications.test.ts tests/unit/persistence/gameStateCodec.test.ts
npm run typecheck
git add src/domain/notifications/gameNotifications.ts src/persistence/gameStateCodec.ts tests/unit/domain/notifications tests/unit/persistence/gameStateCodec.test.ts
git commit -m "feat: add player concern resolution notifications"
```

---

### Task 4: Emit resolution notification at authoritative official-match feedback

**Files:**

- Modify: `src/domain/tournament/recordOfficialMatch.ts`
- Modify: `tests/unit/domain/tournament/recordOfficialMatch.test.ts` if present; otherwise create `tests/unit/domain/tournament/phase20ConcernResolution.test.ts`
- Regression: `tests/unit/domain/dynamics/officialMatchDynamics.test.ts`

**Interfaces:**

- Consumes: `selectResolvedPlayerConcerns`, `buildConcernResolutionNotification`, `appendNotification`.
- No new worker action or public API.

- [ ] **Step 1: Write RED official-result tests**

Build an official match where the before-state has a `team-slump` concern and the match is a user win. After `recordOfficialTournamentOutcome`, assert:

```ts
expect(result.teamDynamics.playerConcerns[playerId] ?? []).not.toContainEqual(
  expect.objectContaining({ code: "team-slump" }),
);
expect(result.notifications.items).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ type: "concern-resolution" }),
  ]),
);
```

Add a playing-time or role-mismatch fixture that resolves through changed official starter usage.

- [ ] **Step 2: Add idempotency RED test**

Call the official recorder again with the already-recorded state/match. Assert no second resolution notification is created. The existing match-history idempotency early return plus deterministic notification id should enforce this.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/unit/domain/tournament/phase20ConcernResolution.test.ts tests/unit/domain/dynamics/officialMatchDynamics.test.ts
```

- [ ] **Step 4: Implement before/after concern diff around `applyOfficialMatchDynamicsFeedback`**

Capture the concern map immediately before feedback. After feedback, diff the maps; if `resolved.length > 0`, append exactly one grouped notification for `input.match.id`.

Do not call `progressWeeklyDynamics` and do not introduce a second reevaluation path.

- [ ] **Step 5: Run and commit**

```bash
npx vitest run tests/unit/domain/tournament/phase20ConcernResolution.test.ts tests/unit/domain/dynamics/officialMatchDynamics.test.ts tests/unit/domain/notifications/gameNotifications.test.ts
npm run typecheck
git add src/domain/tournament/recordOfficialMatch.ts tests/unit/domain/tournament tests/unit/domain/dynamics/officialMatchDynamics.test.ts
git commit -m "feat: notify when player concerns resolve"
```

---

### Task 5: Replace ambiguous concern UI with actionable guidance

**Files:**

- Modify: `src/features/team/TeamDynamicsPanel.tsx`
- Modify: `src/features/team/team-dynamics.css`
- Create or Modify: `tests/unit/features/team/TeamDynamicsPanel.test.tsx`
- Modify: `src/features/home/homeCommandCenter.ts`
- Modify: existing home-command-center test file under `tests/unit/features/home/`

**Interfaces:**

- `TeamDynamicsPanel` consumes `selectPlayerConcernGuidance(state, player.id)`.
- `HomeCommandNews` gains:

```ts
| {
    id: string;
    kind: "concern-resolution";
    title: string;
    detail: string;
  }
```

- [ ] **Step 1: Write RED TeamDynamicsPanel tests**

For each concern, assert the rendered card includes:

- readable title,
- reason,
- resolution instruction,
- progress label,
- severity,
- `対応が必要` or `改善中` status text.

Do not accept only the old `重要度 N/3` output as sufficient.

- [ ] **Step 2: Write RED Home news tests**

Given a concern-resolution notification, assert home news contains a compact item such as:

- title `選手の不満が解消`
- detail includes player name and resolved concern title.

Given both training and concern notifications, assert both news types can be selected while only one of each notification type exists.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/unit/features/team/TeamDynamicsPanel.test.tsx tests/unit/features/home/homeCommandCenter.test.ts
```

Use the actual existing home-command-center test filename if it differs.

- [ ] **Step 4: Implement actionable cards and home news**

Keep the existing team screen structure. Concern cards should be compact/mobile-first and must not require a new modal.

Home resolution news is read-only compact feedback; do not repurpose `TrainingResultNotificationSheet` for a different payload.

- [ ] **Step 5: Run focused suite and commit**

```bash
npx vitest run \
  tests/unit/domain/dynamics/playerConcernGuidance.test.ts \
  tests/unit/domain/dynamics/concernResolution.test.ts \
  tests/unit/domain/notifications/gameNotifications.test.ts \
  tests/unit/domain/dynamics/officialMatchDynamics.test.ts \
  tests/unit/domain/tournament/phase20ConcernResolution.test.ts \
  tests/unit/features/team/TeamDynamicsPanel.test.tsx \
  tests/unit/features/home/homeCommandCenter.test.ts
npm run typecheck
git add src/features/team src/features/home/homeCommandCenter.ts tests/unit/features/team tests/unit/features/home
git commit -m "feat: make player concerns actionable"
```

---

### Task 6: Final regression and PR gate

**Files:**

- Modify only for approved-scope verification fixes.

- [ ] **Step 1: Run existing dynamics regressions**

```bash
npx vitest run tests/unit/domain/dynamics tests/unit/domain/notifications tests/unit/domain/tournament
```

Expected: GREEN.

- [ ] **Step 2: Run repository gates before opening PR**

```bash
npm run verify
npm run release:check
```

Expected: GREEN.

- [ ] **Step 3: Review boundaries**

Confirm:

- concern thresholds in `derivePlayerConcerns` were not retuned,
- no weekly/background concern engine was added,
- newest training notification behavior still passes,
- notification store remains bounded,
- save schema version remains 8,
- no PvP file changed.

- [ ] **Step 4: Open PR only after GREEN**

PR title:

```text
feat: explain and resolve player concerns
```

PR body must document the authoritative official-match resolution boundary, notification retention policy, focused evidence, v8 compatibility, and exact candidate SHA.

- [ ] **Step 5: Require official PR CI GREEN, squash merge, and exact main merge-SHA CI GREEN**
