# Phase 14 — Saved Lineup UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Phase 14 by letting the coach manage three named saved lineups from the normal team-selection screen and temporarily load valid saved lineups during pre-match preparation without mutating the persistent regular lineup.

**Architecture:** Reuse the schema-v8 `teamPlanning.savedLineups` foundation and its existing authoritative `save-lineup-preset` / `delete-lineup-preset` actions. Add one shared pure selector that classifies the three saved slots as empty, valid, or invalid using the existing `validateTeamSelection`; render that same validity model in `TeamScreen` and `PreMatchLineupScreen`. Normal-screen save/delete/apply are wired through `GameApp` authoritative actions, while pre-match loading only replaces `PreMatchLineupScreen` local state and never calls the persistent `team-selection` action.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, Playwright, existing Worker `game-action` flow and CSS.

**Spec:** `docs/superpowers/specs/2026-09-09-phase14-player-hub-2-design.md`

## Global Constraints

- Exactly three saved lineup slots: `1 | 2 | 3`.
- Slot names are trimmed, non-empty, and at most 24 characters; existing authoritative validation remains the source of truth.
- Saving to an occupied slot replaces that slot.
- Deleting an empty slot remains idempotent.
- A saved lineup is a snapshot; never silently substitute another player when it becomes invalid after graduation, transfer, retirement, roster changes, or other legality changes.
- Invalid saved lineups remain visible with an explicit invalid state and reason.
- Applying a valid saved lineup from the normal team-selection screen persists it through the existing authoritative `team-selection` action.
- Saving and deleting presets persist only through existing `save-lineup-preset` and `delete-lineup-preset` actions.
- Pre-match loading is temporary: selecting a saved lineup changes only `PreMatchLineupScreen` local `selection` and must not mutate `cloudSession.snapshot.teamSelection`.
- Preserve all existing generated pre-match presets: `ベスト / 1年中心 / 2年中心 / 3年中心 / 調子優先`.
- `元に戻す` still restores the persistent regular lineup passed as `baseSelection`.
- PvP opponent privacy remains unchanged.
- No schema migration, Worker route, new persistence store, fatigue control, tactics, or match-simulation rule is added in PR14-3.
- All new controls must remain usable at 320 / 360 / 390 / 414 / 480 px with no horizontal overflow or bottom-navigation collision.

---

## File Structure

- Create `src/domain/team/savedLineupSelectors.ts`
  - Shared pure slot view-model and validity classification for both normal and pre-match UI.
- Create `tests/unit/domain/team/savedLineupSelectors.test.ts`
  - Empty / valid / invalid / deterministic-slot-order tests.
- Modify `src/features/team/TeamScreen.tsx`
  - Add three saved-lineup slot cards, editable names, save/replace/delete/apply controls.
- Modify `src/features/team/team-direct.css`
  - Mobile layout for saved-lineup cards and controls.
- Modify `src/features/team/PlayerHubScreen.tsx`
  - Pass saved-lineup callbacks/pending state through the existing `編成` tab.
- Modify `src/app/GameApp.tsx`
  - Add authoritative save/delete callbacks and pass them to Player Hub.
- Create `tests/unit/features/team/TeamSavedLineups.test.tsx`
  - Component behavior for empty, occupied, invalid, save/replace/delete/apply and pending state.
- Create `tests/unit/app/GameApp.savedLineups.test.tsx`
  - Prove save/delete/apply use the authoritative action path and adopt returned server snapshots.
- Modify `src/features/match/PreMatchLineupScreen.tsx`
  - Add valid/invalid saved-lineup buttons while preserving generated presets and local-only semantics.
- Modify `src/features/match/pre-match-lineup.css`
  - Responsive saved-lineup picker styles.
- Modify `tests/unit/features/match/PreMatchLineupScreen.test.tsx`
  - Saved preset load, invalid disabled state, generated preset preservation and regular-lineup immutability.
- Create `tests/e2e/phase14-saved-lineup-ux.spec.ts`
  - Five-width normal management plus pre-match temporary-load flow.
- Modify `docs/PROJECT_CONTEXT.md`
  - Mark Phase14 PR14-3 complete only after exact-head PR CI is green.

---

### Task 1: Build a shared three-slot validity selector

**Files:**

- Create: `src/domain/team/savedLineupSelectors.ts`
- Create: `tests/unit/domain/team/savedLineupSelectors.test.ts`

**Interfaces:**

- Consumes:
  - `GameState`
  - `SavedLineupPreset`
  - `SavedLineupSlot`
  - existing `validateTeamSelection()`
- Produces:

```ts
export type SavedLineupStatus = "empty" | "valid" | "invalid";

export interface SavedLineupSlotView {
  slot: SavedLineupSlot;
  preset: SavedLineupPreset | null;
  status: SavedLineupStatus;
  issueMessage: string | null;
}

export function selectSavedLineupSlots(
  state: GameState,
): SavedLineupSlotView[];
```

**Rules:**

- Always return exactly slots `1, 2, 3` in ascending order.
- Missing preset → `status: "empty"`, `preset: null`, `issueMessage: null`.
- Existing preset with zero `validateTeamSelection` issues → `status: "valid"`.
- Existing preset with one or more issues → `status: "invalid"`, with the first authoritative issue message copied into `issueMessage`.
- Do not mutate or repair the stored selection.
- Do not clone or rewrite players when validating.

- [ ] **Step 1: Write failing selector tests**

Create fixtures from `createDemoGame()` and `autoSelectTeam()`.

```ts
it("always returns three ordered empty slots", () => {
  const state = createDemoGame();
  expect(selectSavedLineupSlots(state)).toEqual([
    { slot: 1, preset: null, status: "empty", issueMessage: null },
    { slot: 2, preset: null, status: "empty", issueMessage: null },
    { slot: 3, preset: null, status: "empty", issueMessage: null },
  ]);
});
```

Add a valid preset:

```ts
const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });
state.teamPlanning.savedLineups = [
  { slot: 2, name: "守備重視", selection: structuredClone(selection) },
];
expect(selectSavedLineupSlots(state)[1]).toMatchObject({
  slot: 2,
  status: "valid",
  issueMessage: null,
});
```

Create an invalid snapshot by removing one saved starter from the current school roster after saving:

```ts
const removedId = selection.rotation[0]!.playerId;
state.teamPlanning.savedLineups = [
  { slot: 1, name: "旧スタメン", selection: structuredClone(selection) },
];
state.schools[state.userSchoolId]!.playerIds = state.schools[
  state.userSchoolId
]!.playerIds.filter((id) => id !== removedId);

const invalid = selectSavedLineupSlots(state)[0]!;
expect(invalid.status).toBe("invalid");
expect(invalid.issueMessage).toBeTruthy();
expect(invalid.preset?.selection.rotation[0]?.playerId).toBe(removedId);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- --run tests/unit/domain/team/savedLineupSelectors.test.ts
```

Expected: FAIL because `savedLineupSelectors.ts` does not exist.

- [ ] **Step 3: Implement the minimal selector**

```ts
import type { GameState } from "../model/GameState";
import type {
  SavedLineupPreset,
  SavedLineupSlot,
} from "./teamPlanningTypes";
import { validateTeamSelection } from "./validateTeamSelection";

export type SavedLineupStatus = "empty" | "valid" | "invalid";

export interface SavedLineupSlotView {
  slot: SavedLineupSlot;
  preset: SavedLineupPreset | null;
  status: SavedLineupStatus;
  issueMessage: string | null;
}

const slots = [1, 2, 3] as const satisfies readonly SavedLineupSlot[];

export function selectSavedLineupSlots(
  state: GameState,
): SavedLineupSlotView[] {
  return slots.map((slot) => {
    const preset =
      state.teamPlanning.savedLineups.find((candidate) => candidate.slot === slot) ??
      null;
    if (!preset) {
      return { slot, preset: null, status: "empty", issueMessage: null };
    }

    const issues = validateTeamSelection({
      state,
      schoolId: state.userSchoolId,
      selection: preset.selection,
    });
    return {
      slot,
      preset,
      status: issues.length === 0 ? "valid" : "invalid",
      issueMessage: issues[0]?.message ?? null,
    };
  });
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npm test -- --run tests/unit/domain/team/savedLineupSelectors.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/domain/team/savedLineupSelectors.ts tests/unit/domain/team/savedLineupSelectors.test.ts
git commit -m "feat: classify saved lineup slots"
```

---

### Task 2: Add normal-screen saved lineup management and authoritative persistence

**Files:**

- Modify: `src/features/team/TeamScreen.tsx`
- Modify: `src/features/team/team-direct.css`
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/app/GameApp.tsx`
- Create: `tests/unit/features/team/TeamSavedLineups.test.tsx`
- Create: `tests/unit/app/GameApp.savedLineups.test.tsx`

**Interfaces:**

Add to `TeamScreenProps`:

```ts
onSaveLineupPreset?: (
  slot: SavedLineupSlot,
  name: string,
  selection: TeamSelection,
) => void | Promise<void>;
onDeleteLineupPreset?: (slot: SavedLineupSlot) => void | Promise<void>;
planningPending?: boolean;
```

Add matching pass-through props to `PlayerHubScreenProps`:

```ts
onSaveLineupPreset?: (
  slot: SavedLineupSlot,
  name: string,
  selection: TeamSelection,
) => void | Promise<void>;
onDeleteLineupPreset?: (slot: SavedLineupSlot) => void | Promise<void>;
```

`GameApp` authoritative callbacks:

```ts
const saveLineupPreset = async (
  slot: SavedLineupSlot,
  name: string,
  selection: TeamSelection,
) => {
  await cloudSession.runAction(
    { type: "save-lineup-preset", slot, name, selection },
    "保存編成を保存しています…",
  );
};

const deleteLineupPreset = async (slot: SavedLineupSlot) => {
  await cloudSession.runAction(
    { type: "delete-lineup-preset", slot },
    "保存編成を削除しています…",
  );
};
```

Normal-screen apply reuses existing `onChange(preset.selection)`, which already maps to the authoritative `team-selection` action in `GameApp`.

**UI contract:**

- Add a `保存編成` panel before `交代方針` so it is visible after the court/bench area but before lower controls.
- Render exactly three cards labelled `スロット1 / スロット2 / スロット3`.
- Each card contains a text input with `aria-label="保存編成名 スロットN"`, `maxLength={24}`.
- Empty slot:
  - status `未保存`;
  - primary action `現在の編成を保存`;
  - save disabled when the trimmed name is empty or planning is pending.
- Valid occupied slot:
  - status `使用可能`;
  - actions `適用 / 上書き保存 / 削除`;
  - `適用` calls `onChange(structuredClone(preset.selection))`;
  - `上書き保存` sends current `selection`, not the stored preset selection.
- Invalid occupied slot:
  - status `再設定が必要`;
  - show `issueMessage`;
  - `適用` disabled;
  - `上書き保存` remains enabled when the current lineup is valid and the name is non-empty, allowing the coach to repair the slot;
  - `削除` remains enabled.
- Pending disables all save/delete/apply operations.
- Do not modify saved slot state optimistically; displayed slot contents come from `state.teamPlanning.savedLineups` after server snapshot adoption.

- [ ] **Step 1: Write failing TeamScreen component tests**

Create `TeamSavedLineups.test.tsx` with a helper that renders `TeamScreen` using `createDemoGame()` and `autoSelectTeam()`.

Assert empty slots:

```ts
expect(screen.getByRole("heading", { name: "保存編成" })).toBeVisible();
expect(screen.getAllByText("未保存")).toHaveLength(3);
expect(screen.getAllByRole("button", { name: "現在の編成を保存" })).toHaveLength(3);
```

Fill slot 1 and save:

```ts
fireEvent.change(screen.getByLabelText("保存編成名 スロット1"), {
  target: { value: "  ベストメンバー  " },
});
fireEvent.click(
  within(screen.getByTestId("saved-lineup-slot-1")).getByRole("button", {
    name: "現在の編成を保存",
  }),
);
expect(onSaveLineupPreset).toHaveBeenCalledWith(
  1,
  "ベストメンバー",
  selection,
);
```

Pre-populate one valid slot and assert `適用 / 上書き保存 / 削除`.

For apply, make the saved preset differ from the current selection with `repositionTeamSelection`, click `適用`, and assert `onChange` receives the preset snapshot and the stored preset object is unchanged.

For invalid state, remove one saved starter from the school roster and assert:

```ts
expect(screen.getByText("再設定が必要")).toBeVisible();
expect(screen.getByRole("button", { name: "適用" })).toBeDisabled();
expect(screen.getByRole("button", { name: "削除" })).toBeEnabled();
```

Add a pending test where every saved-lineup action button is disabled.

- [ ] **Step 2: Run TeamScreen tests and verify RED**

Run:

```bash
npm test -- --run tests/unit/features/team/TeamSavedLineups.test.tsx
```

Expected: FAIL because the saved-lineup panel and callbacks do not exist.

- [ ] **Step 3: Implement the saved-lineup panel**

In `TeamScreen`, derive:

```ts
const savedLineupSlots = useMemo(
  () => selectSavedLineupSlots(state),
  [state],
);
const [savedLineupNames, setSavedLineupNames] = useState<Record<
  SavedLineupSlot,
  string
>>({ 1: "", 2: "", 3: "" });
```

Synchronize occupied names from authoritative state without overwriting an actively typed value for empty slots. A simple deterministic rule is acceptable: when an occupied preset is rendered, its input value comes from `savedLineupNames[slot] || preset.name`; after a server replacement the authoritative preset name is displayed.

Before callback invocation trim the name:

```ts
const saveSlot = (slot: SavedLineupSlot, fallbackName: string | null) => {
  const name = (savedLineupNames[slot] || fallbackName || "").trim();
  if (!name || planningPending) return;
  void onSaveLineupPreset?.(slot, name, selection);
};
```

For `適用`:

```ts
if (slotView.status === "valid" && slotView.preset && !planningPending) {
  onChange(structuredClone(slotView.preset.selection));
}
```

Do not repair invalid presets on apply.

- [ ] **Step 4: Add responsive CSS and rerun TeamScreen tests**

Use a three-card grid on wide mobile/desktop and one column at `max-width: 420px`:

```css
.saved-lineup-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.saved-lineup-card {
  display: grid;
  min-width: 0;
  gap: 7px;
  padding: 10px;
}

.saved-lineup-card input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
}

.saved-lineup-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

@media (max-width: 420px) {
  .saved-lineup-grid {
    grid-template-columns: 1fr;
  }
}
```

Run:

```bash
npm test -- --run tests/unit/features/team/TeamSavedLineups.test.tsx tests/unit/features/team/TeamSelectionFlow.test.tsx
```

Expected: PASS and existing lineup controls remain green.

- [ ] **Step 5: Write failing GameApp authority tests**

Create `GameApp.savedLineups.test.tsx` using the same real-`applyGameAction` fake-server pattern as `GameApp.playerHubPlanning.test.tsx`.

Case A — save:

1. render `GameApp` with empty saved lineups;
2. navigate `選手 → 編成`;
3. enter `速攻型` in slot 1;
4. click `現在の編成を保存`;
5. assert first `api.applyAction` request:

```ts
expect(applyAction.mock.calls[0]![1]).toMatchObject({
  revision: 1,
  action: {
    type: "save-lineup-preset",
    slot: 1,
    name: "速攻型",
    selection: serverSnapshot.teamSelection,
  },
});
```

6. wait for `保存済み ✓` and authoritative UI state `使用可能`.

Case B — delete:

1. start with slot 1 saved;
2. click `削除`;
3. assert `delete-lineup-preset` with correct slot and next revision;
4. wait for `未保存` after server snapshot adoption.

Case C — apply:

1. start with a valid slot whose saved selection differs from current persistent selection;
2. click `適用`;
3. assert the request action is exactly `team-selection` with the saved selection;
4. wait for the returned snapshot and verify the court reflects the saved lineup.

- [ ] **Step 6: Run GameApp authority tests and verify RED**

Run:

```bash
npm test -- --run tests/unit/app/GameApp.savedLineups.test.tsx
```

Expected: FAIL because `GameApp` does not wire save/delete callbacks yet.

- [ ] **Step 7: Wire `GameApp → PlayerHubScreen → TeamScreen`**

Import `SavedLineupSlot` in `GameApp`, add the two callbacks above, and pass:

```tsx
<PlayerHubScreen
  ...
  onSaveLineupPreset={saveLineupPreset}
  onDeleteLineupPreset={deleteLineupPreset}
  planningPending={cloudSession.operation.status === "submitting"}
/>
```

Inside `PlayerHubScreen` pass them only to the existing `TeamScreen` branch:

```tsx
<TeamScreen
  onChange={onChange}
  onDeleteLineupPreset={onDeleteLineupPreset}
  onSaveLineupPreset={onSaveLineupPreset}
  pending={planningPending}
  planningPending={planningPending}
  selection={selection}
  state={state}
/>
```

Do not create a separate API method or local optimistic saved-lineup store.

- [ ] **Step 8: Run Task 2 focused suites and verify GREEN**

Run:

```bash
npm test -- --run \
  tests/unit/features/team/TeamSavedLineups.test.tsx \
  tests/unit/features/team/TeamSelectionFlow.test.tsx \
  tests/unit/app/GameApp.savedLineups.test.tsx \
  tests/unit/app/GameApp.playerHubPlanning.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add \
  src/features/team/TeamScreen.tsx \
  src/features/team/team-direct.css \
  src/features/team/PlayerHubScreen.tsx \
  src/app/GameApp.tsx \
  tests/unit/features/team/TeamSavedLineups.test.tsx \
  tests/unit/app/GameApp.savedLineups.test.tsx
git commit -m "feat: manage saved lineups from Player Hub"
```

---

### Task 3: Load saved lineups temporarily during pre-match preparation

**Files:**

- Modify: `src/features/match/PreMatchLineupScreen.tsx`
- Modify: `src/features/match/pre-match-lineup.css`
- Modify: `tests/unit/features/match/PreMatchLineupScreen.test.tsx`

**Interfaces:**

- Consumes `selectSavedLineupSlots(state)` from Task 1.
- No new callback is added to `PreMatchLineupScreenProps`.
- Saved lineup loading remains an internal `setSelection(structuredClone(...))` operation.

**UI contract:**

- Keep the existing `編成プリセット / 今回の起用` section and all generated buttons unchanged.
- Add a compact `保存編成` subsection in the same pre-match preset area, clearly separate from generated presets.
- Empty slots show `スロットN 未保存` and are disabled.
- Valid slots show the stored name and are enabled.
- Invalid slots remain visible, show `再設定が必要`, include the issue reason, and are disabled.
- Clicking a valid saved lineup clones its stored selection into local `selection`.
- Clicking a generated preset after a saved lineup still works and replaces only local selection.
- `元に戻す` always restores `baseSelection`, not the last saved lineup.
- Starting the match sends the current local selection through `onStart`.
- `baseSelection`, `state.teamPlanning.savedLineups[*].selection`, and persistent `GameApp` team selection remain unchanged by loading.

- [ ] **Step 1: Extend pre-match tests with a failing valid-saved-lineup case**

Create a saved lineup that differs from `baseSelection`, assign it to slot 1, render, and assert the button exists:

```ts
expect(screen.getByRole("button", { name: "保存編成 速攻型" })).toBeVisible();
```

Click it and then start:

```ts
fireEvent.click(screen.getByRole("button", { name: "保存編成 速攻型" }));
fireEvent.click(screen.getByRole("button", { name: "この編成で試合開始" }));
expect(onStart).toHaveBeenCalledWith(savedSelection);
expect(selection).toEqual(originalBase);
expect(state.teamPlanning.savedLineups[0]!.selection).toEqual(savedSelection);
```

- [ ] **Step 2: Add failing invalid and generated-preset-preservation tests**

Invalid slot:

```ts
const invalidButton = screen.getByRole("button", {
  name: /保存編成 旧スタメン 再設定が必要/,
});
expect(invalidButton).toBeDisabled();
expect(screen.getByText(/再設定が必要/)).toBeVisible();
```

Preserve generated presets:

```ts
for (const label of ["ベスト", "1年中心", "2年中心", "3年中心", "調子優先"]) {
  expect(screen.getByRole("button", { name: label })).toBeVisible();
}
```

Also click saved lineup → generated `調子優先` → `元に戻す` → start and assert `onStart` receives `baseSelection`.

- [ ] **Step 3: Run pre-match tests and verify RED**

Run:

```bash
npm test -- --run tests/unit/features/match/PreMatchLineupScreen.test.tsx
```

Expected: existing tests PASS, new saved-lineup tests FAIL.

- [ ] **Step 4: Implement the saved-lineup picker**

Derive:

```ts
const savedLineupSlots = useMemo(
  () => selectSavedLineupSlots(state),
  [state],
);
```

Render after the generated preset grid:

```tsx
<div className="pre-match-lineup__saved-presets" aria-label="保存編成">
  {savedLineupSlots.map((slot) => (
    <button
      aria-label={
        slot.status === "valid" && slot.preset
          ? `保存編成 ${slot.preset.name}`
          : slot.status === "invalid" && slot.preset
            ? `保存編成 ${slot.preset.name} 再設定が必要`
            : `保存編成 スロット${slot.slot} 未保存`
      }
      disabled={pending || slot.status !== "valid" || !slot.preset}
      key={slot.slot}
      onClick={() => {
        if (slot.status === "valid" && slot.preset) {
          setSelection(structuredClone(slot.preset.selection));
        }
      }}
      type="button"
    >
      <span>スロット{slot.slot}</span>
      <strong>{slot.preset?.name ?? "未保存"}</strong>
      {slot.status === "invalid" ? <small>再設定が必要</small> : null}
    </button>
  ))}
</div>
```

Render invalid reason as nearby visible text tied to the card; do not expose or infer missing player details beyond the existing validation message.

- [ ] **Step 5: Add mobile CSS and verify pre-match tests GREEN**

```css
.pre-match-lineup__saved-presets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
}

.pre-match-lineup__saved-presets button {
  display: grid;
  min-width: 0;
  min-height: 64px;
  gap: 3px;
}

@media (max-width: 420px) {
  .pre-match-lineup__saved-presets {
    grid-template-columns: 1fr;
  }
}
```

Run:

```bash
npm test -- --run tests/unit/features/match/PreMatchLineupScreen.test.tsx tests/unit/features/match/PreMatchComparisonRadar.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add \
  src/features/match/PreMatchLineupScreen.tsx \
  src/features/match/pre-match-lineup.css \
  tests/unit/features/match/PreMatchLineupScreen.test.tsx
git commit -m "feat: load saved lineups before matches"
```

---

### Task 4: Add five-width E2E, run full verification and finish Phase 14

**Files:**

- Create: `tests/e2e/phase14-saved-lineup-ux.spec.ts`
- Modify after all checks are green: `docs/PROJECT_CONTEXT.md`

**E2E contract:**

For each width `320, 360, 390, 414, 480`:

1. open `/`;
2. navigate `選手 → 編成`;
3. verify `保存編成` and all three slot cards are visible with no horizontal overflow;
4. enter `E2E編成` into slot 1 and save current lineup;
5. wait for `保存済み ✓` and slot 1 `使用可能`;
6. navigate to `試合`, schedule a practice match using the same robust helper logic as `home-match-flow.spec.ts`;
7. return `ホーム`, press `今週を進める`, and enter `試合準備`;
8. verify existing generated preset `ベスト` remains visible;
9. verify saved preset button `保存編成 E2E編成` is visible and clickable;
10. click saved preset, then `元に戻す`, then saved preset again to prove both paths remain usable;
11. assert no horizontal overflow at normal team screen and pre-match screen;
12. click `この編成で試合開始` and verify the match-digest screen appears.

The test does not need to prove database internals; the authoritative unit/integration test from Task 2 covers exact action payloads. E2E proves the full user-visible path is reachable at all target widths.

- [ ] **Step 1: Write the five-width E2E file**

Reuse the `schedulePracticeMatch(page)` logic from `tests/e2e/home-match-flow.spec.ts` in this new file and include:

```ts
async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(layout.body).toBeLessThanOrEqual(layout.viewport);
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
}
```

The slot locator must use `data-testid="saved-lineup-slot-1"` so the same UI is unambiguous at all widths.

- [ ] **Step 2: Run focused E2E and fix only PR14-3 regressions**

Run:

```bash
npx playwright test tests/e2e/phase14-saved-lineup-ux.spec.ts
```

Expected: PASS at 320 / 360 / 390 / 414 / 480.

Do not redesign unrelated shell, tournament, training, or match-result UI.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run verify
npx playwright test
```

Expected: formatting, lint, type check, V2 structure, unit/integration tests, build and complete Playwright suite PASS.

- [ ] **Step 4: Update durable project handoff**

After exact-head verification is green, update `docs/PROJECT_CONTEXT.md` to state:

- Phase14 PR14-1 foundation is on main;
- PR14-2 Player Hub UI is on main;
- PR14-3 saved-lineup UX adds normal-screen three-slot management and temporary pre-match loading;
- schema remains v8;
- saved lineup invalidation never silently repairs missing players;
- normal apply persists through `team-selection`;
- pre-match load remains temporary and does not overwrite persistent `teamSelection`;
- generated pre-match presets remain available;
- Phase14 is complete and Phase15 Team Tactics is next.

- [ ] **Step 5: Commit Task 4**

```bash
git add tests/e2e/phase14-saved-lineup-ux.spec.ts docs/PROJECT_CONTEXT.md
git commit -m "test: cover Phase 14 saved lineup UX"
```

- [ ] **Step 6: Push/open PR and require exact-head CI GREEN**

PR title:

```text
feat: finish Phase 14 saved lineup UX
```

PR body:

```text
Phase 14 / PR14-3 Saved Lineup UX.

Scope:
- three named saved-lineup slots in normal team selection
- save / replace / delete / apply through existing authoritative actions
- explicit invalid-preset state after roster changes
- temporary saved-lineup loading in pre-match preparation
- existing generated pre-match presets preserved
- 320/360/390/414/480 mobile coverage

Invariants:
- no schema change
- no silent player substitution
- no persistent teamSelection mutation from pre-match preset loading
- PvP opponent privacy unchanged

Verification:
- npm run verify: GREEN
- full Playwright suite: GREEN
```

Require PR `dependency-audit`, `quality`, and `mobile-e2e` to complete with `success` on the exact PR head.

- [ ] **Step 7: Final diff review and merge**

Review changed files and reject:

- schema/model migration changes;
- new Worker routes or duplicate saved-lineup persistence;
- optimistic local persistence for saved slots;
- silent invalid-preset repair;
- generated pre-match preset removal;
- persistent regular-lineup mutation caused by pre-match loading;
- temporary formatter/debug files.

Merge with expected head SHA only after review and PR CI are green.

- [ ] **Step 8: Verify post-merge main CI**

Fetch the `main` push workflow for the merge SHA and require:

- `dependency-audit` → success;
- `quality` → success;
- `mobile-e2e` → success.

Do not declare Phase14 complete before all three are green on `main`.

---

## Self-Review

### Spec coverage

- Three named saved-lineup slots: Task 2.
- Save / replace / delete / apply from normal selection: Task 2.
- Invalid preset after graduation/roster changes: Task 1 shared selector + Task 2/3 UI.
- No silent substitution: Task 1 classification only, no repair path.
- Pre-match temporary load: Task 3.
- Existing generated pre-match presets preserved: Task 3 tests + Task 4 E2E.
- Persistent `teamSelection` unchanged by pre-match loading: Task 3 unit assertions and architecture boundary.
- Authoritative save/delete/apply: Task 2 GameApp authority tests.
- PvP privacy unchanged: no opponent data flow is touched.
- No schema/fatigue/tactics scope: global constraints + final diff gate.
- Mobile usability at 320/360/390/414/480: Task 4.

### Placeholder scan

No `TBD`, `TODO`, “implement later”, vague validation steps, or unspecified test commands remain. Every task has explicit files, signatures, failure expectations and verification commands.

### Type consistency

- `SavedLineupSlot` remains the existing `1 | 2 | 3` type from `teamPlanningTypes.ts`.
- `selectSavedLineupSlots(state)` is defined once in Task 1 and consumed under the same name in TeamScreen and PreMatchLineupScreen.
- Save callback signature is consistently `(slot, name, selection)` from TeamScreen through PlayerHubScreen to GameApp.
- Delete callback signature is consistently `(slot)`.
- Pre-match does not gain save/delete/apply callbacks; its saved preset load remains local `setSelection` only.
- Existing authoritative action names remain exactly `save-lineup-preset`, `delete-lineup-preset`, and `team-selection`.
