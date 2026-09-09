# Phase 14 — Player Hub UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase14 foundation into a mobile-first Player Hub where the coach can filter/sort the roster, see real 4-week/12-week growth, inspect an actual recent growth trend, and manage up to three development-priority players through the authoritative game action path.

**Architecture:** Keep Phase14 PR14-2 presentation-focused. Add one pure selector/view-model module beside `PlayerHubScreen` for deterministic filtering, sorting and persisted-history aggregation; keep React state and rendering in `PlayerHubScreen`; route development-priority writes through `GameApp` → `useGameSession.runAction` → existing `set-development-priorities` Worker action. Do not add schema fields, Worker routes, saved-lineup UX, pre-match changes, inferred historical data or fatigue management.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, Playwright, existing Worker `game-action` flow and CSS.

**Spec:** `docs/superpowers/specs/2026-09-09-phase14-player-hub-2-design.md`

## Global Constraints

- PR14-2 scope only: mobile-first roster cards, filters, sorting, player growth summary, 4/12-week aggregation, real-data trend, explicit priority-management UI.
- Filters must support: all / grade / position / starter / bench / priority / injured.
- Sorting must support: power / potential / condition / 4-week growth / grade.
- Never fabricate historical growth. A player with no persisted development log in the requested window reports `null`, not `0`.
- A persisted zero-growth player log is real history and therefore reports `0`.
- Development priority remains explicit coach intent only; no hidden training multiplier.
- Development priorities remain max 3 and are persisted only by the authoritative `set-development-priorities` action.
- Match-only lineup behavior and saved-lineup UX remain untouched; PR14-3 owns saved-lineup UI.
- No fatigue controls or fatigue-based sorting/filtering.
- PvP opponent data is not used by Player Hub selectors or UI.
- Mobile widths 320 / 360 / 390 / 414 / 480 must have no horizontal overflow and no bottom-navigation collision.
- Existing lineup and team-dynamics tabs remain available.
- Existing individual-training control remains available and keeps its completed/pending protections.

---

## File Structure

- Create `src/features/team/playerHubRoster.ts`
  - Pure Player Hub roster view-model construction.
  - Defines filter/sort IDs, growth aggregation and deterministic roster ordering.
- Modify `src/features/team/PlayerHubScreen.tsx`
  - Owns selected filter/sort UI state, priority-toggle interaction and renders roster/detail growth presentation.
- Modify `src/features/team/player-hub.css`
  - Responsive controls, priority affordance, growth metrics and compact trend visualization.
- Modify `src/app/GameApp.tsx`
  - Adds authoritative `saveDevelopmentPriorities()` callback and passes pending state to Player Hub.
- Create `tests/unit/features/team/playerHubRoster.test.ts`
  - Pure selector/filter/sort/growth tests.
- Modify `tests/unit/features/team/PlayerHubScreen.test.tsx`
  - Component-level controls, growth empty/real states, priority toggle and max-3 behavior.
- Create `tests/unit/app/GameApp.playerHubPlanning.test.tsx`
  - Proves Player Hub priority changes call the existing authoritative action and adopt the returned snapshot.
- Create `tests/e2e/phase14-player-hub.spec.ts`
  - 320/360/390/414/480 overflow audit and main Player Hub interactions.
- Modify `docs/PROJECT_CONTEXT.md`
  - Record PR14-2 completion/handoff only after implementation and CI are green.

---

### Task 1: Build deterministic Player Hub roster selectors and real growth aggregation

**Files:**
- Create: `src/features/team/playerHubRoster.ts`
- Create: `tests/unit/features/team/playerHubRoster.test.ts`

**Interfaces:**

- Produces:

```ts
export type PlayerHubFilter =
  | "all"
  | "grade-1"
  | "grade-2"
  | "grade-3"
  | "position-OH"
  | "position-MB"
  | "position-OP"
  | "position-S"
  | "position-L"
  | "starter"
  | "bench"
  | "priority"
  | "injured";

export type PlayerHubSort =
  | "power"
  | "potential"
  | "condition"
  | "growth-4w"
  | "grade";

export interface PlayerGrowthTrendPoint {
  gameDate: GameState["date"];
  totalAbilityGrowth: number;
}

export interface PlayerGrowthSummary {
  fourWeekGrowth: number | null;
  twelveWeekGrowth: number | null;
  observedWeeks4: number;
  observedWeeks12: number;
  trend12: PlayerGrowthTrendPoint[];
}

export interface PlayerHubRosterItem {
  player: Player;
  displayPower: number;
  potential: number | null;
  isStarter: boolean;
  isBench: boolean;
  isPriority: boolean;
  isInjured: boolean;
  growth: PlayerGrowthSummary;
}

export interface SelectPlayerHubRosterInput {
  state: GameState;
  selection: TeamSelection;
  filter: PlayerHubFilter;
  sort: PlayerHubSort;
}

export function summarizePlayerGrowth(
  state: GameState,
  playerId: PlayerId,
): PlayerGrowthSummary;

export function selectPlayerHubRoster(
  input: SelectPlayerHubRosterInput,
): PlayerHubRosterItem[];
```

**Selector rules:**

- Growth windows use the newest 4 and 12 persisted `history.playerDevelopmentWeeks` entries respectively.
- For each window, only entries containing a log for the target player count as observed history.
- If no target-player log exists in a window, the aggregate is `null`.
- If one or more logs exist and all are zero-growth, aggregate is `0`.
- `trend12` contains only real target-player logs from the newest 12 persisted weeks, in oldest → newest display order. Do not add synthetic zero bars for missing weeks.
- Starter = any rotation player plus libero.
- Bench = `selection.benchPlayerIds` membership.
- Priority = `state.teamPlanning.developmentPriorityPlayerIds` membership.
- Injured = `player.injury !== null`.
- Potential = rounded `player.potential` when numeric, otherwise `null`.
- Sort direction: power desc, potential desc with null last, condition desc, 4-week growth desc with null last, grade desc (3 → 1).
- Every sort uses display power desc as the secondary tie-breaker except power itself; final tie-breaker is `player.id.localeCompare` so output is stable.

- [ ] **Step 1: Write failing growth aggregation tests**

Add focused tests that construct known development weeks, including an explicit zero-growth log and a player absent from history:

```ts
it("aggregates only persisted player logs and distinguishes no history from zero growth", () => {
  const state = createDemoGame();
  const playerId = state.schools[state.userSchoolId]!.playerIds[0]!;
  const otherPlayerId = state.schools[state.userSchoolId]!.playerIds[1]!;

  state.history.playerDevelopmentWeeks = [
    developmentWeek("2026-04-01", 1, [
      { playerId, totalAbilityGrowth: 0, abilityChanges: {} },
    ]),
    developmentWeek("2026-04-08", 2, [
      { playerId, totalAbilityGrowth: 3, abilityChanges: { spike: 3 } },
    ]),
  ];

  expect(summarizePlayerGrowth(state, playerId)).toMatchObject({
    fourWeekGrowth: 3,
    twelveWeekGrowth: 3,
    observedWeeks4: 2,
    observedWeeks12: 2,
  });
  expect(summarizePlayerGrowth(state, otherPlayerId)).toMatchObject({
    fourWeekGrowth: null,
    twelveWeekGrowth: null,
    observedWeeks4: 0,
    observedWeeks12: 0,
    trend12: [],
  });
});
```

The local helper is concrete and uses the production history shape:

```ts
function developmentWeek(
  gameDate: GameState["date"],
  weekOfYear: number,
  players: PlayerDevelopmentWeek["players"],
): PlayerDevelopmentWeek {
  return {
    gameDate,
    academicYearIndex: 0,
    weekOfYear,
    trainingMenuId: "training.balanced",
    players,
  };
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- --run tests/unit/features/team/playerHubRoster.test.ts
```

Expected: FAIL because `playerHubRoster.ts` / `summarizePlayerGrowth` does not exist.

- [ ] **Step 3: Implement minimal real-history aggregation**

Implement history extraction without inference:

```ts
function summarizeWindow(
  weeks: readonly PlayerDevelopmentWeek[],
  playerId: PlayerId,
) {
  const observed = weeks.flatMap((week) => {
    const log = week.players.find((candidate) => candidate.playerId === playerId);
    return log ? [{ gameDate: week.gameDate, growth: log.totalAbilityGrowth }] : [];
  });

  return {
    growth:
      observed.length === 0
        ? null
        : observed.reduce((sum, item) => sum + item.growth, 0),
    observed,
  };
}

export function summarizePlayerGrowth(
  state: GameState,
  playerId: PlayerId,
): PlayerGrowthSummary {
  const four = summarizeWindow(
    state.history.playerDevelopmentWeeks.slice(-4),
    playerId,
  );
  const twelve = summarizeWindow(
    state.history.playerDevelopmentWeeks.slice(-12),
    playerId,
  );

  return {
    fourWeekGrowth: four.growth,
    twelveWeekGrowth: twelve.growth,
    observedWeeks4: four.observed.length,
    observedWeeks12: twelve.observed.length,
    trend12: twelve.observed.map((item) => ({
      gameDate: item.gameDate,
      totalAbilityGrowth: item.growth,
    })),
  };
}
```

- [ ] **Step 4: Add failing filter/sort tests**

Cover all required filter families and null-last sort semantics. Use one representative assertion per filter family plus table-driven position/grade cases:

```ts
it.each([
  ["grade-1", 1],
  ["grade-2", 2],
  ["grade-3", 3],
] as const)("filters %s", (filter, grade) => {
  const result = selectPlayerHubRoster({
    state,
    selection,
    filter,
    sort: "power",
  });
  expect(result.every((item) => item.player.grade === grade)).toBe(true);
});

it.each(["OH", "MB", "OP", "S", "L"] as const)(
  "filters position-%s",
  (position) => {
    const result = selectPlayerHubRoster({
      state,
      selection,
      filter: `position-${position}`,
      sort: "power",
    });
    expect(
      result.every((item) => item.player.preferredPosition === position),
    ).toBe(true);
  },
);
```

Also assert:

```ts
expect(idsFor("starter")).toEqual(
  expect.arrayContaining([
    ...selection.rotation.map((item) => item.playerId),
    ...(selection.liberoPlayerId ? [selection.liberoPlayerId] : []),
  ]),
);
expect(idsFor("bench")).toEqual(
  expect.arrayContaining(selection.benchPlayerIds),
);
expect(idsFor("priority")).toEqual(state.teamPlanning.developmentPriorityPlayerIds);
expect(idsFor("injured")).toEqual(
  school.playerIds.filter((id) => state.players[id]!.injury !== null),
);
```

For `growth-4w`, construct three players with `5`, `0`, and no history and assert the order is `5 → 0 → null`.

- [ ] **Step 5: Run filter/sort tests and verify RED**

Run:

```bash
npm test -- --run tests/unit/features/team/playerHubRoster.test.ts
```

Expected: growth tests PASS; filter/sort tests FAIL until roster selection is implemented.

- [ ] **Step 6: Implement filtering, view-model creation and deterministic sorting**

Use the exact filter rules above. Comparator helpers must make null values sort last without converting null to zero:

```ts
function compareNullableDesc(left: number | null, right: number | null) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
}
```

After the primary comparator, apply display power desc and then player ID ascending.

- [ ] **Step 7: Run Task 1 tests and verify GREEN**

Run:

```bash
npm test -- --run tests/unit/features/team/playerHubRoster.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add src/features/team/playerHubRoster.ts tests/unit/features/team/playerHubRoster.test.ts
git commit -m "feat: add Player Hub roster selectors"
```

---

### Task 2: Add Player Hub filters, sorting, real growth UI and priority management

**Files:**
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/player-hub.css`
- Modify: `tests/unit/features/team/PlayerHubScreen.test.tsx`

**Interfaces:**

- Consumes Task 1:
  - `PlayerHubFilter`
  - `PlayerHubSort`
  - `selectPlayerHubRoster()`
  - `summarizePlayerGrowth()`
- Adds props:

```ts
interface PlayerHubScreenProps {
  // existing props remain
  planningPending?: boolean;
  onSetDevelopmentPriorities?: (
    playerIds: PlayerId[],
  ) => void | Promise<void>;
}
```

**UI contract:**

- The roster heading remains `選手一覧` and existing tabs remain `選手一覧 / 編成 / チーム状態`.
- Add two compact native selects inside a themed control surface:
  - `aria-label="選手絞り込み"`
  - `aria-label="並び替え"`
- Filter labels:
  - `全員`
  - `1年 / 2年 / 3年`
  - `OH / MB / OP / S / L`
  - `スタメン / 控え / 重点育成 / 怪我中`
- Sort labels:
  - `総合力順`
  - `将来性順`
  - `調子順`
  - `直近4週の成長順`
  - `学年順`
- Count text becomes `表示 X / 全 Y人`.
- Empty filtered result shows `条件に該当する選手はいません`.
- Every roster card shows:
  - current existing identity/growth-type/talent/condition/power data;
  - `4週 +N` when real history exists;
  - `4週 --` when it does not;
  - `重点` badge/button state.
- Priority toggle is explicit and does not alter training settings.
- When already at 3 priorities, non-priority players' add buttons are disabled; current priorities remain removable.
- `planningPending` disables all priority buttons to prevent duplicate actions.
- Detail view adds a `最近の成長` section:
  - `4週` aggregate;
  - `12週` aggregate;
  - observed week count;
  - oldest → newest compact bar trend from `trend12` only.
- If no real history exists for the selected player, show `成長履歴はまだありません` and render no fake trend bars.

- [ ] **Step 1: Write failing component tests for filter/sort controls**

Extend `renderPlayerHub` to accept optional callbacks and props instead of hard-coding only leadership:

```ts
function renderPlayerHub(
  state = createDemoGame(),
  options: {
    onAssignLeadership?: ReturnType<typeof vi.fn>;
    onSetDevelopmentPriorities?: ReturnType<typeof vi.fn>;
    planningPending?: boolean;
  } = {},
) {
  const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });
  const onAssignLeadership = options.onAssignLeadership ?? vi.fn();
  const onSetDevelopmentPriorities =
    options.onSetDevelopmentPriorities ?? vi.fn();

  const view = render(
    <PlayerHubScreen
      onAssignLeadership={onAssignLeadership}
      onChange={vi.fn()}
      onSetDevelopmentPriorities={onSetDevelopmentPriorities}
      planningPending={options.planningPending ?? false}
      selection={selection}
      state={state}
    />,
  );

  return {
    state,
    selection,
    view,
    onAssignLeadership,
    onSetDevelopmentPriorities,
  };
}
```

Add a grade-filter assertion:

```ts
fireEvent.change(screen.getByLabelText("選手絞り込み"), {
  target: { value: "grade-1" },
});
expect(
  screen.getAllByTestId("roster-player-row").every((row) =>
    within(row).getByText(/1年・/),
  ),
).toBe(true);
```

Add a growth sort assertion using controlled history where two players have known 4-week totals.

- [ ] **Step 2: Run PlayerHubScreen tests and verify RED**

Run:

```bash
npm test -- --run tests/unit/features/team/PlayerHubScreen.test.tsx
```

Expected: FAIL because the controls and selector integration do not exist.

- [ ] **Step 3: Integrate selector state and roster controls**

Add local state:

```ts
const [filter, setFilter] = useState<PlayerHubFilter>("all");
const [sort, setSort] = useState<PlayerHubSort>("power");
```

Replace the raw `players.map` rendering source with:

```ts
const rosterItems = useMemo(
  () => selectPlayerHubRoster({ state, selection, filter, sort }),
  [state, selection, filter, sort],
);
```

Keep the raw school roster only for total count and direct player lookup.

- [ ] **Step 4: Write failing priority-toggle tests**

Test addition:

```ts
const onSetDevelopmentPriorities = vi.fn();
const { state } = renderPlayerHub(createDemoGame(), {
  onSetDevelopmentPriorities,
});
const player = state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;

fireEvent.click(
  screen.getByRole("button", {
    name: `${player.lastName} ${player.firstName}を重点育成に設定`,
  }),
);
expect(onSetDevelopmentPriorities).toHaveBeenCalledWith([player.id]);
```

Test max 3 by pre-populating exactly three IDs and asserting:

```ts
expect(
  screen.getByRole("button", { name: /を重点育成に設定/ }),
).toBeDisabled();
expect(
  screen.getAllByRole("button", { name: /重点育成を解除/ })[0],
).toBeEnabled();
```

Also assert `planningPending` disables removal as well.

- [ ] **Step 5: Implement priority-toggle presentation and callback**

Use state as the authoritative displayed source; do not optimistically mutate a local priority array:

```ts
const priorityIds = state.teamPlanning.developmentPriorityPlayerIds;
const togglePriority = (playerId: PlayerId) => {
  const selected = priorityIds.includes(playerId);
  const nextIds = selected
    ? priorityIds.filter((id) => id !== playerId)
    : [...priorityIds, playerId];
  if (!selected && nextIds.length > 3) return;
  void onSetDevelopmentPriorities?.(nextIds);
};
```

The button accessible name must be exactly one of:

```ts
`${playerName(player)}の重点育成を解除`
`${playerName(player)}を重点育成に設定`
```

- [ ] **Step 6: Write failing detail-growth tests**

Create two cases:

1. no history → `成長履歴はまだありません`, zero `.player-growth-trend__bar` nodes;
2. known real history → `4週 +3`, `12週 +7`, and exactly the number of real player logs rendered as trend bars.

Example known history assertion:

```ts
expect(within(growthRegion).getByText("4週 +3")).toBeVisible();
expect(within(growthRegion).getByText("12週 +7")).toBeVisible();
expect(
  growthRegion.querySelectorAll(".player-growth-trend__bar"),
).toHaveLength(4);
```

- [ ] **Step 7: Implement detail growth summary and accessible trend**

Use `summarizePlayerGrowth(state, selectedPlayer.id)` and render each real point with an accessible date/value label:

```tsx
<div className="player-growth-trend" aria-label="直近の成長推移">
  {growth.trend12.map((point) => {
    const max = Math.max(1, ...growth.trend12.map((item) => item.totalAbilityGrowth));
    const percent = Math.max(8, Math.round((point.totalAbilityGrowth / max) * 100));
    return (
      <span
        aria-label={`${point.gameDate} 成長 +${point.totalAbilityGrowth}`}
        className="player-growth-trend__bar"
        key={point.gameDate}
        style={{ height: `${percent}%` }}
      />
    );
  })}
</div>
```

For a persisted zero-growth point the 8% minimum height is only a visual floor; its accessible label still says `+0`, so data is not fabricated.

- [ ] **Step 8: Refine mobile-first CSS**

Add styles with these layout constraints:

```css
.player-hub__controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
}

.player-hub__controls select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
}

.player-growth-trend {
  display: flex;
  align-items: end;
  min-width: 0;
  height: 64px;
  gap: 3px;
  overflow: hidden;
}

.player-growth-trend__bar {
  flex: 1 1 0;
  min-width: 3px;
  max-width: 18px;
}
```

At `max-width: 350px`, keep the control pair readable without horizontal scrolling; if two columns become too narrow, switch controls to one column rather than shrinking touch targets below 44px.

The roster card must still leave the existing individual-training chip tappable. Place the priority action inside the card metadata zone or an explicit secondary action row; do not overlap the training chip.

- [ ] **Step 9: Run Player Hub component tests and verify GREEN**

Run:

```bash
npm test -- --run tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/features/team/playerHubRoster.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 2**

```bash
git add src/features/team/PlayerHubScreen.tsx src/features/team/player-hub.css tests/unit/features/team/PlayerHubScreen.test.tsx
git commit -m "feat: upgrade Player Hub roster UI"
```

---

### Task 3: Wire development priorities through the authoritative GameApp action path

**Files:**
- Modify: `src/app/GameApp.tsx`
- Create: `tests/unit/app/GameApp.playerHubPlanning.test.tsx`

**Interfaces:**

- Consumes existing Worker action:

```ts
{ type: "set-development-priorities"; playerIds: PlayerId[] }
```

- Adds GameApp callback:

```ts
const saveDevelopmentPriorities = async (playerIds: PlayerId[]) => {
  await cloudSession.runAction(
    { type: "set-development-priorities", playerIds },
    "重点育成を保存しています…",
  );
};
```

- Passes:

```tsx
<PlayerHubScreen
  ...
  onSetDevelopmentPriorities={saveDevelopmentPriorities}
  planningPending={cloudSession.operation.status === "submitting"}
/>
```

- [ ] **Step 1: Write failing GameApp authority test**

Use the existing `GameApp.notifications.test.tsx` pattern: real `applyGameAction`, fake `GameApiClient.applyAction`, server snapshot revision increments.

After rendering, navigate to the Team tab and click the first player's priority button:

```ts
fireEvent.click(screen.getByRole("button", { name: "選手" }));
const school = serverSnapshot.state.schools[serverSnapshot.state.userSchoolId]!;
const player = serverSnapshot.state.players[school.playerIds[0]!]!;
fireEvent.click(
  screen.getByRole("button", {
    name: `${player.lastName} ${player.firstName}を重点育成に設定`,
  }),
);
```

Assert the API request:

```ts
await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(1));
expect(applyAction.mock.calls[0]![1]).toMatchObject({
  revision: 1,
  action: {
    type: "set-development-priorities",
    playerIds: [player.id],
  },
});
expect(await screen.findByRole("status")).toHaveTextContent("保存済み ✓");
```

Then assert the button changes to the remove label after the returned authoritative snapshot is adopted.

- [ ] **Step 2: Run authority test and verify RED**

Run:

```bash
npm test -- --run tests/unit/app/GameApp.playerHubPlanning.test.tsx
```

Expected: FAIL because `GameApp` does not pass `onSetDevelopmentPriorities` yet.

- [ ] **Step 3: Implement GameApp callback and prop wiring**

Add only the callback above. Do not add a dedicated API method or bypass `cloudSession.runAction`.

- [ ] **Step 4: Run authority test and Player Hub tests**

Run:

```bash
npm test -- --run tests/unit/app/GameApp.playerHubPlanning.test.tsx tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/features/team/playerHubRoster.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/app/GameApp.tsx tests/unit/app/GameApp.playerHubPlanning.test.tsx
git commit -m "feat: persist Player Hub development priorities"
```

---

### Task 4: Add mobile E2E coverage, run full verification and prepare PR14-2 handoff

**Files:**
- Create: `tests/e2e/phase14-player-hub.spec.ts`
- Modify after all checks are green: `docs/PROJECT_CONTEXT.md`

**E2E contract:**

- For each width `320, 360, 390, 414, 480`:
  - open `/`;
  - navigate to `選手`;
  - confirm `選手一覧`, `選手絞り込み`, `並び替え` are visible;
  - assert body/document/Player Hub do not overflow horizontally;
  - select `1年` and confirm at least one visible roster row and no overflow;
  - return to `全員`;
  - open first player detail and confirm `最近の成長` is visible;
  - back to roster;
  - confirm individual training action remains visible and does not overlap the bottom navigation.
- One non-width-specific test toggles priority and waits for the resulting button label change.

- [ ] **Step 1: Write the E2E test**

Use the same viewport loop style as `tests/e2e/phase13-home-command-center.spec.ts`:

```ts
for (const width of [320, 360, 390, 414, 480]) {
  test(`${width}px Player Hub fits`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "選手" }).click();

    await expect(page.getByRole("heading", { name: "選手一覧" })).toBeVisible();
    await expect(page.getByLabel("選手絞り込み")).toBeVisible();
    await expect(page.getByLabel("並び替え")).toBeVisible();

    await page.getByLabel("選手絞り込み").selectOption("grade-1");
    await expect(page.getByTestId("roster-player-row").first()).toBeVisible();

    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
      hubClient: document.querySelector(".player-hub")?.clientWidth ?? 0,
      hubScroll: document.querySelector(".player-hub")?.scrollWidth ?? 0,
    }));

    expect(layout.body).toBeLessThanOrEqual(layout.viewport);
    expect(layout.document).toBeLessThanOrEqual(layout.viewport);
    expect(layout.hubScroll).toBeLessThanOrEqual(layout.hubClient + 1);
  });
}
```

- [ ] **Step 2: Run the focused mobile E2E test and fix only PR14-2 layout defects**

Run:

```bash
npx playwright test tests/e2e/phase14-player-hub.spec.ts
```

Expected: PASS at all five widths.

Do not broaden the scope into unrelated global shell redesign unless a regression introduced by PR14-2 is proven.

- [ ] **Step 3: Run full unit/integration/build verification**

Run:

```bash
npm run verify
```

Expected: formatting, lint, type check, V2 structure, all unit/integration tests and build PASS.

- [ ] **Step 4: Run the complete mobile E2E suite**

Run the repository's CI-equivalent mobile Playwright command from `package.json` / workflow. If the workflow invokes the whole Playwright suite, run:

```bash
npx playwright test
```

Expected: PASS.

- [ ] **Step 5: Update durable project handoff after green verification**

Update `docs/PROJECT_CONTEXT.md` with these exact facts only after they are true:

- PR14-1 foundation is on `main`.
- PR14-2 adds Player Hub filter/sort, real 4/12-week growth presentation, real-data trend, and authoritative priority UI.
- PR14-3 saved-lineup UX remains next and out of PR14-2.
- Current schema remains v8.
- No fabricated history, fatigue controls or PvP leakage were introduced.

- [ ] **Step 6: Commit Task 4**

```bash
git add tests/e2e/phase14-player-hub.spec.ts docs/PROJECT_CONTEXT.md
git commit -m "test: cover Phase 14 Player Hub mobile UX"
```

- [ ] **Step 7: Final branch verification before PR**

Run again on the exact head commit that will be pushed:

```bash
npm run verify
npx playwright test
```

Expected: both PASS. Do not create/merge the PR based on an earlier commit's green result.

- [ ] **Step 8: Open PR14-2 against `main`**

Title:

```text
feat: upgrade Phase 14 Player Hub UI
```

PR body must state:

```text
Phase 14 / PR14-2 Player Hub UI.

Scope:
- mobile-first roster filters and deterministic sorting
- real 4-week / 12-week development aggregation from schema-v8 history
- compact real-data growth trend
- authoritative development-priority management (max 3)
- mobile coverage for 320/360/390/414/480

Out of scope:
- saved-lineup management UI
- pre-match saved-lineup picker
- tactics / in-match commands
- fatigue micromanagement

Verification:
- npm run verify: GREEN
- Playwright mobile/full suite: GREEN
```

- [ ] **Step 9: Require PR CI GREEN before merge**

Confirm all configured PR jobs, including dependency audit, quality and mobile E2E, are completed with `success` for the exact PR head SHA.

- [ ] **Step 10: Review final PR diff**

Check changed filenames and inspect at minimum:

- `src/features/team/playerHubRoster.ts`
- `src/features/team/PlayerHubScreen.tsx`
- `src/features/team/player-hub.css`
- `src/app/GameApp.tsx`
- all new/modified tests

Reject accidental generated files, temporary diagnostics, unrelated refactors, schema changes, saved-lineup UI or pre-match changes.

- [ ] **Step 11: Merge with expected head SHA and verify post-merge `main` CI**

After the PR is ready and review requirements are satisfied, merge using the exact expected head SHA. Then fetch the `main` push workflow for the merge commit and require dependency audit, quality and mobile E2E to complete successfully before declaring PR14-2 complete.

---

## Self-Review

### Spec coverage

- Mobile-first roster cards: Task 2 CSS/card refinement + Task 4 five-width E2E.
- Filters all / grade / position / starter / bench / priority / injured: Task 1 selector tests + Task 2 controls.
- Sort power / potential / condition / 4-week growth / grade: Task 1 deterministic comparator + Task 2 sort control.
- Player detail growth summary: Task 2.
- 4-week / 12-week aggregation: Task 1 + Task 2.
- Real-data-only compact trend: Task 1 trend points + Task 2 visualization/no-history state.
- Explicit priority-management UI: Task 2.
- Authoritative persistence: Task 3.
- No PR14-3 saved-lineup UX: explicit global/out-of-scope constraint and final diff gate.
- No fabricated history / no fatigue micromanagement / PvP privacy unchanged: explicit global constraints and selector scope.

### Placeholder scan

No `TBD`, `TODO`, “implement later”, vague “add validation”, or unspecified test steps are present. Every implementation task defines exact interfaces, behaviors, test commands and completion conditions.

### Type consistency

- `PlayerHubFilter`, `PlayerHubSort`, `PlayerGrowthSummary`, `PlayerHubRosterItem`, `summarizePlayerGrowth`, `selectPlayerHubRoster` are defined once in Task 1 and consumed under the same names in Task 2.
- `onSetDevelopmentPriorities(playerIds: PlayerId[])` is defined in Task 2 and wired with the same signature in Task 3.
- `planningPending` is optional in the component and receives `cloudSession.operation.status === "submitting"` in GameApp.
- No new persistence type or action name is introduced; `set-development-priorities` exactly matches PR14-1.
