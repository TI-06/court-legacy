# Phase 10 Player and Lineup UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress roster/player detail screens for mobile and add validated touch-first lineup drag-and-drop while preserving tap fallback and existing team-selection rules.

**Architecture:** Keep `PlayerHubScreen` as the mode shell and `TeamScreen` as the lineup editor, but move selection transformations into a pure domain helper. Add `@dnd-kit/core` only for pointer/touch gesture orchestration; every successful drop produces one normal `TeamSelection` and goes through the existing `team-selection` action and server validation.

**Tech Stack:** React 19, TypeScript 5.9, CSS, `@dnd-kit/core`, Vitest 4, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-31-phase10-training-player-mobile-ui-design.md`

## Global Constraints

- Player Hub tabs remain `選手一覧`, `編成`, `チーム状態` with 44px minimum height and 12–13px labels.
- Roster rows are roughly 52–58px; player names are at least 14px and metadata at least 12px.
- Player detail name is 18px; total value is 20–22px; core abilities/state stay near the top.
- The 3x2 court fits at 320px without page-level horizontal overflow.
- Court tiles target roughly 70–82px high and do not show a separate starter-lock button under every tile.
- Bench rail may scroll horizontally; page/body may not.
- Drag is additive; tap/BottomSheet replacement remains fully usable.
- Direct rotation <-> libero drag is not implemented in Phase 10.
- One valid drop emits one `onChange(nextSelection)` call; cancelled/invalid drops emit none.
- Existing `validateTeamSelection` remains authoritative.

---

### Task 1: Add pure lineup repositioning domain helper

**Files:**
- Create: `src/domain/team/repositionTeamSelection.ts`
- Create: `tests/unit/domain/team/repositionTeamSelection.test.ts`

**Interfaces:**
- Produces:

```ts
export type TeamPlacement =
  | { type: "rotation"; slot: RotationSlot }
  | { type: "libero" }
  | { type: "bench"; playerId: PlayerId };

export interface RepositionTeamSelectionInput {
  selection: TeamSelection;
  source: TeamPlacement;
  target: TeamPlacement;
}

export function repositionTeamSelection(
  input: RepositionTeamSelectionInput,
): TeamSelection | null;
```

`null` means unsupported/invalid movement before state validation.

- [ ] **Step 1: Write failing transformation tests**

```ts
it("swaps two rotation slots without changing serving order", () => {
  const next = repositionTeamSelection({
    selection,
    source: { type: "rotation", slot: 1 },
    target: { type: "rotation", slot: 4 },
  });
  expect(next?.rotation.find((item) => item.slot === 1)?.playerId).toBe(p4);
  expect(next?.rotation.find((item) => item.slot === 4)?.playerId).toBe(p1);
  expect(next?.servingOrderPlayerIds).toEqual(selection.servingOrderPlayerIds);
});

it("swaps a bench player into rotation and replaces the server id", () => {
  const next = repositionTeamSelection({
    selection,
    source: { type: "bench", playerId: benchId },
    target: { type: "rotation", slot: 2 },
  });
  expect(next?.rotation.find((item) => item.slot === 2)?.playerId).toBe(benchId);
  expect(next?.benchPlayerIds).toContain(outgoingStarterId);
  expect(next?.servingOrderPlayerIds).toContain(benchId);
  expect(next?.servingOrderPlayerIds).not.toContain(outgoingStarterId);
});
```

Also cover bench reorder, bench <-> libero, starter-lock removal when a starter leaves rotation, and direct rotation <-> libero returning `null`.

- [ ] **Step 2: Run the new domain test and verify RED**

Run: `npm test -- tests/unit/domain/team/repositionTeamSelection.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement immutable transformations**

Clone `rotation`, `benchPlayerIds`, `servingOrderPlayerIds`, and `substitutionPolicy.starterLockPlayerIds` before mutation. Preserve stable bench position for swaps. Rotation-to-rotation changes only the two assigned player IDs. Bench-to-rotation replaces the outgoing server at its existing serving-order index.

Return `null` for unsupported direct rotation/libero drops or descriptors that cannot be resolved.

- [ ] **Step 4: Run the domain test and verify GREEN**

Run: `npm test -- tests/unit/domain/team/repositionTeamSelection.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/team/repositionTeamSelection.ts tests/unit/domain/team/repositionTeamSelection.test.ts
git commit -m "feat: add lineup repositioning rules"
```

### Task 2: Compress Player Hub roster and detail presentation

**Files:**
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/player-hub.css`
- Modify: `tests/unit/features/team/PlayerHubScreen.test.tsx`

**Interfaces:**
- Existing `PlayerHubScreen` public props remain unchanged.

- [ ] **Step 1: Add failing compact roster/detail tests**

```tsx
expect(screen.getByRole("tab", { name: "選手一覧" })).toBeInTheDocument();
expect(screen.getByText(/総合\s*67/)).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: /田中 一郎/ }));
expect(screen.getByRole("heading", { name: "田中 一郎" })).toBeInTheDocument();
expect(screen.getByText(/状態/)).toBeInTheDocument();
expect(screen.getByText(/疲労/)).toBeInTheDocument();
```

Assert roster list does not require a desktop-table header or horizontal scrolling affordance on mobile.

- [ ] **Step 2: Run Player Hub test and verify RED**

Run: `npm test -- tests/unit/features/team/PlayerHubScreen.test.tsx`

Expected: FAIL on current tall/list-detail composition.

- [ ] **Step 3: Implement dense roster rows**

Use a two-line button row similar to:

```text
12  田中 一郎          WS  2年      総合67
    178cm                           状態82
```

Name 14px, metadata 12px, whole row clickable, no reading/furigana line if it increases row height.

- [ ] **Step 4: Compact player detail header and core stats**

Target:

```text
< 選手一覧
田中 一郎                         総合 67
2年・WS・178cm
```

Keep ability bars and move `状態 / 疲労 / 士気 / 役割 / 信頼` immediately after the ability section. Use `min-height` rather than rigid detail heights.

- [ ] **Step 5: Run focused test and verify GREEN**

Run: `npm test -- tests/unit/features/team/PlayerHubScreen.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/team/PlayerHubScreen.tsx src/features/team/player-hub.css tests/unit/features/team/PlayerHubScreen.test.tsx
git commit -m "feat: compact player roster and detail views"
```

### Task 3: Compress the lineup court and move starter lock into slot editing

**Files:**
- Modify: `src/features/team/TeamScreen.tsx`
- Modify: `src/features/team/team.css`
- Modify: `src/features/team/team-direct.css`
- Modify: `tests/unit/features/team/TeamSelectionFlow.test.tsx`

**Interfaces:**
- Existing `onChange(selection: TeamSelection)` remains the save boundary.

- [ ] **Step 1: Add failing compact-court tests**

Assert six court slot buttons are rendered, each contains slot/player/position/overall information, no six duplicated `先発固定` buttons appear, and tap still opens the existing player/slot editor.

- [ ] **Step 2: Run the Team selection test and verify RED**

Run: `npm test -- tests/unit/features/team/TeamSelectionFlow.test.tsx`

Expected: FAIL on current tall court tile/starter-lock layout.

- [ ] **Step 3: Implement compact 3x2 court tiles**

Target tile content:

```text
4  佐藤
MB   65
```

Use roughly 70–82px minimum tile height depending on viewport. Active starter lock is shown as a compact icon/text state in the tile, but editing the lock occurs in the tap sheet for that player.

- [ ] **Step 4: Compact the bench rail**

Use component-local horizontal scrolling only. Bench cards are approximately 104–124px wide with 12px minimum text. Ensure parent containers use `min-width: 0` and body does not overflow.

- [ ] **Step 5: Run focused test and verify GREEN**

Run: `npm test -- tests/unit/features/team/TeamSelectionFlow.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/team/TeamScreen.tsx src/features/team/team.css src/features/team/team-direct.css tests/unit/features/team/TeamSelectionFlow.test.tsx
git commit -m "refactor: compact the mobile lineup court"
```

### Task 4: Add dnd-kit and touch-first drag interaction

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/features/team/TeamScreen.tsx`
- Create: `src/features/team/LineupDragLayer.tsx`
- Modify: `src/features/team/team.css`
- Modify: `tests/unit/features/team/TeamSelectionFlow.test.tsx`

**Interfaces:**
- Consumes: `repositionTeamSelection()` from Task 1.
- `LineupDragLayer` receives authoritative `selection`, `disabled`, `onDropSelection(nextSelection)`, and render data needed for overlay labels.

- [ ] **Step 1: Install the single new interaction dependency**

Run:

```bash
npm install @dnd-kit/core
```

Do not add sortable or a UI framework.

- [ ] **Step 2: Add failing drag integration tests**

At component level, test the drop handler independently of browser geometry by invoking the exposed drag-end transformation path with source/target descriptors. Assert one valid court swap calls `onChange` once, bench-to-court calls once with the expected selection, unsupported rotation-to-libero calls zero times, and disabled/submitting state ignores drag starts.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm test -- tests/unit/features/team/TeamSelectionFlow.test.tsx tests/unit/domain/team/repositionTeamSelection.test.ts`

Expected: FAIL because the drag layer is missing.

- [ ] **Step 4: Implement DndContext with touch/pointer activation constraints**

Use `PointerSensor` with a small movement threshold for mouse/pointer and `TouchSensor` with approximately 200ms delay plus movement tolerance. Keep tap handlers on court/bench items so touch drag is not the only path.

On drag end:

```ts
const next = repositionTeamSelection({ selection, source, target });
if (!next) return;
const issues = validateTeamSelection({
  state,
  schoolId: state.userSchoolId,
  selection: next,
});
if (issues.length > 0) return;
onChange(next);
```

Do not mutate optimistic selection locally beyond the drag overlay; visible authoritative state follows the existing saved snapshot.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the same command as Step 3.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/features/team/TeamScreen.tsx src/features/team/LineupDragLayer.tsx src/features/team/team.css tests/unit/features/team/TeamSelectionFlow.test.tsx
git commit -m "feat: add touch drag lineup editing"
```

### Task 5: Lock Player/Lineup mobile behavior with E2E

**Files:**
- Modify or create: `tests/e2e/phase10-player-lineup.spec.ts`

**Interfaces:**
- Consumes all prior Player/Lineup tasks.

- [ ] **Step 1: Add mobile E2E scenarios**

Cover:

1. roster/detail audit at 320, 360, 390, and 414 widths;
2. no page-level horizontal overflow;
3. tap replacement still works;
4. long-press drag court -> court saves and survives reload;
5. long-press drag bench -> court saves and survives reload;
6. cancelled drag makes no saved change;
7. drag overlay never covers the fixed bottom navigation in a way that blocks completion.

- [ ] **Step 2: Run focused E2E and verify failures are behavior-specific**

Run: `npx playwright test tests/e2e/phase10-player-lineup.spec.ts --project=mobile`

Expected: no infrastructure failures.

- [ ] **Step 3: Fix only Player/Lineup Phase 10 defects**

Do not alter match simulation, team-selection domain validation, PvP publication, or tactics behavior.

- [ ] **Step 4: Run subsystem and full quality verification**

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright test tests/e2e/phase10-player-lineup.spec.ts --project=mobile
```

Expected: all GREEN.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/phase10-player-lineup.spec.ts
git commit -m "test: cover phase10 player lineup mobile UX"
```
