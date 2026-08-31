# Phase 10 Training UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Training into a compact settings-only smartphone game screen with one-row team training, one-row individual assignments, compact scouting entry, and no historical result block.

**Architecture:** Preserve existing `WeeklyPlan` and scouting behavior, but recompose the Training presentation around compact rows and BottomSheet-style editing. `GameApp` continues to save plans through the existing `set-training-plan` action; this plan changes only presentation and removes the old `latestResult` dependency.

**Tech Stack:** React 19, TypeScript 5.9, CSS, Vitest 4, Testing Library, existing Phase 9 mobile shell/tokens.

**Spec:** `docs/superpowers/specs/2026-08-31-phase10-training-player-mobile-ui-design.md`

## Global Constraints

- Training is settings-only; no visible `直近の練習結果` section.
- Screen title is 18px; normal body 14px; labels/captions minimum 12px.
- Interactive controls are at least 44px; primary `この内容で設定` is 48px.
- Vertical gaps are primarily 8–12px and card radius 10–14px.
- At 390x844, the primary training setup surface should fit above the fixed navigation under normal data.
- At 360x800, the save action must remain reachable without a long scroll.
- Training rules, plan shape, menu data, scouting APIs, and recruiting economics do not change.

---

### Task 1: Freeze Training component behavior with compact-layout tests

**Files:**
- Modify: `tests/unit/features/training/TrainingFlow.test.tsx`

**Interfaces:**
- Existing `TrainingScreen` continues to consume `state`, `data`, `completed`, and `onSave`.
- `latestResult` is removed from the public prop contract.

- [ ] **Step 1: Add failing assertions for the Phase 10 surface**

```tsx
render(<TrainingScreen {...props} />);

expect(screen.getByRole("heading", { name: "育成" })).toBeInTheDocument();
expect(screen.queryByText("直近の練習結果")).not.toBeInTheDocument();
expect(screen.getByText("チーム練習")).toBeInTheDocument();
expect(screen.getAllByRole("button", { name: /個人育成/ })).toHaveLength(2);
expect(screen.getByRole("button", { name: "この内容で設定" })).toBeInTheDocument();
```

Add a completed-week case asserting the surface is read-only and the primary action communicates completion rather than opening editors.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/unit/features/training/TrainingFlow.test.tsx`

Expected: FAIL on the current large hero/result structure and old prop contract.

- [ ] **Step 3: Commit only the failing test**

```bash
git add tests/unit/features/training/TrainingFlow.test.tsx
git commit -m "test: define compact training screen behavior"
```

### Task 2: Remove historical result ownership and large Training hero

**Files:**
- Modify: `src/features/training/TrainingScreen.tsx`
- Modify: `src/features/training/training.css`
- Modify: `src/features/training/training-direct.css`
- Modify: `src/app/GameApp.tsx`

**Interfaces:**
- `TrainingScreenProps` becomes:

```ts
interface TrainingScreenProps {
  state: GameState;
  data: GameDataRegistry;
  completed: boolean;
  onSave(plan: WeeklyPlan): Promise<void> | void;
}
```

- [ ] **Step 1: Remove result-only state and props**

Delete `latestResult`, `resultsExpanded`, result aggregate calculations, and result list rendering from `TrainingScreen`.

Delete `latestResult={latestTrainingResult}` from `GameApp`. If the notification plan has already removed `latestTrainingResult`, do not reintroduce it.

- [ ] **Step 2: Replace the hero with a compact heading row**

Render:

```tsx
<header className="training-screen__header">
  <h2>育成</h2>
  <span>平均疲労 {averageFatigue}</span>
</header>
```

Use `18px` title and `12px` status text. Do not add a subtitle paragraph.

- [ ] **Step 3: Make the current focused test GREEN for removed result/hero behavior**

Run: `npm test -- tests/unit/features/training/TrainingFlow.test.tsx`

Expected: result and hero assertions PASS; row interaction assertions may still fail until Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/features/training/TrainingScreen.tsx src/features/training/training.css src/features/training/training-direct.css src/app/GameApp.tsx
git commit -m "refactor: make training a settings-only screen"
```

### Task 3: Recompose team and individual training as compact rows

**Files:**
- Modify: `src/features/training/TrainingScreen.tsx`
- Modify: `src/features/training/training.css`
- Modify: `tests/unit/features/training/TrainingFlow.test.tsx`

**Interfaces:**
- Internal editor state may use:

```ts
type TrainingEditor =
  | { type: "team-menu" }
  | { type: "individual"; index: 0 | 1 }
  | null;
```

- The saved value remains exactly `WeeklyPlan`.

- [ ] **Step 1: Write/extend failing row interaction tests**

```tsx
await user.click(screen.getByRole("button", { name: /チーム練習.*変更/ }));
expect(screen.getByRole("dialog", { name: "チーム練習を変更" })).toBeInTheDocument();

await user.click(screen.getByRole("button", { name: /個人育成 1/ }));
expect(screen.getByRole("dialog", { name: "個人育成 1" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "選手を変更" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "指示を変更" })).toBeInTheDocument();
```

Also assert the visible row itself does not render separate `選手変更` and `指示変更` buttons.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- tests/unit/features/training/TrainingFlow.test.tsx`

Expected: FAIL because the compact row/editor composition is missing.

- [ ] **Step 3: Implement compact rows and editor sheet**

Visible team row:

```text
チーム練習
基礎練習                    変更 >
成長+5 / 疲労+12 / 怪我8%
```

Visible individual row:

```text
1  田中 一郎   サーブ狙い打ち   >
```

Keep the existing pickers/menu data, but place player/instruction changes inside one assignment sheet instead of exposing two buttons on the main screen.

Use `min-height: 44px` for tappable rows and 14px player/menu names.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `npm test -- tests/unit/features/training/TrainingFlow.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/training/TrainingScreen.tsx src/features/training/training.css tests/unit/features/training/TrainingFlow.test.tsx
git commit -m "feat: add compact training setup rows"
```

### Task 4: Integrate scouting as one compact game-action row

**Files:**
- Modify: `src/features/training/TrainingScoutingEntry.tsx`
- Modify: `src/features/training/training-scouting-entry.css`
- Modify: `src/app/GameApp.tsx`
- Modify: `tests/unit/features/training/TrainingFlow.test.tsx`

**Interfaces:**
- `TrainingScoutingEntry` keeps `state` and `onOpen` and continues to call the existing scouting flow.

- [ ] **Step 1: Add a failing scouting-entry test**

Render the Training hub and assert one semantic action named `新入生スカウト`, with concise reputation/scouting-network status and no duplicate `来年度の戦力候補` or `候補を調査` headline/button pair.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/unit/features/training/TrainingFlow.test.tsx`

Expected: FAIL on duplicate/oversized scouting presentation.

- [ ] **Step 3: Implement the one-row scouting action**

Target structure:

```tsx
<button className="training-scouting-entry" onClick={onOpen} type="button">
  <span className="training-scouting-entry__title">新入生スカウト</span>
  <span className="training-scouting-entry__meta">
    評判 {reputationLabel}・スカウト網 Lv.{level}
  </span>
  <span aria-hidden="true">›</span>
</button>
```

Keep height between roughly 56–68px and all metadata at 12px or larger.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- tests/unit/features/training/TrainingFlow.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/training/TrainingScoutingEntry.tsx src/features/training/training-scouting-entry.css src/app/GameApp.tsx tests/unit/features/training/TrainingFlow.test.tsx
git commit -m "feat: compact the training scouting entry"
```

### Task 5: Lock mobile density and completed-state behavior

**Files:**
- Modify: `src/features/training/training.css`
- Modify: `src/features/training/training-direct.css`
- Modify or create: `tests/e2e/phase10-training-ui.spec.ts`

**Interfaces:**
- Consumes all prior Training tasks.

- [ ] **Step 1: Add mobile E2E checks**

Cover 320, 360, 390, and 414 widths. Assert no page-level horizontal overflow, no visible historical result section, one compact scouting row, and reachable `この内容で設定` at 360x800 without a long-scroll dependency.

- [ ] **Step 2: Run the focused E2E and inspect failures**

Run: `npx playwright test tests/e2e/phase10-training-ui.spec.ts --project=mobile`

Expected: no infrastructure failures; layout assertions should identify only Phase 10 defects.

- [ ] **Step 3: Adjust only Phase 10 Training CSS**

Use 8–12px vertical gaps, 10–14px radii, 12px minimum metadata, 14px main row text, and `min-height` rather than rigid heights so larger system fonts do not clip.

- [ ] **Step 4: Run full Training verification**

```bash
npm run format:check
npm run lint
npm run typecheck
npm test -- tests/unit/features/training/TrainingFlow.test.tsx
npm run build
npx playwright test tests/e2e/phase10-training-ui.spec.ts --project=mobile
```

Expected: all GREEN.

- [ ] **Step 5: Commit**

```bash
git add src/features/training/training.css src/features/training/training-direct.css tests/e2e/phase10-training-ui.spec.ts
git commit -m "test: lock phase10 training mobile density"
```
