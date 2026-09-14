# Phase21 PR21-1 Fullscreen Events and Personality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace choice-based BottomSheet events with a fullscreen event experience and expose each player's existing personality in Player Hub without changing simulation balance.

**Architecture:** Keep event selection/resolution domain behavior unchanged in PR21-1. Introduce a focused `FullscreenEventExperience` presentation component that owns the choice/result UI state while `EventDialog` becomes a thin compatibility wrapper. Add a pure personality-presentation selector backed by `GameDataRegistry` and pass registry data into Player Hub through the existing app composition.

**Tech Stack:** React 19, TypeScript 5.9, Vitest, Testing Library, CSS, existing `GameDataRegistry`, existing event pipeline.

**Spec:** `docs/superpowers/specs/2026-09-15-phase21-player-relationships-fullscreen-events-design.md`

## Global Constraints

- Choice-based manager/player/relationship/captaincy/rivalry events use a fullscreen experience; ordinary informational notifications remain compact.
- The event screen uses the full viewport with `100dvh`, safe-area handling, readable mobile typography, a scrollable content region, and a reachable action region.
- Mandatory pending events remain non-dismissible until a valid choice resolves.
- The result is shown in-place in the same fullscreen experience after resolution.
- No new direct match-stat or training-growth modifier is introduced in PR21-1.
- Personality is public from the beginning; show qualitative tendencies, not raw coefficient numbers.
- Respect `state.settings.reducedMotion` and `prefers-reduced-motion`.
- Use TDD. Do not open the PR until focused tests, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run verify` are green on the branch safe gate.
- For an intentional RED GitHub Actions check, the workflow job must convert the expected test failure into workflow success so the user does not receive a failure-email notification.

---

## File Structure

- Create `src/domain/player/playerPersonalityPresentation.ts`: pure conversion from `PersonalityDefinition` to qualitative UI labels.
- Create `src/features/home/FullscreenEventExperience.tsx`: fullscreen choice/result event UI.
- Create `src/features/home/fullscreen-event.css`: fullscreen event layout, safe areas, reduced-motion behavior.
- Modify `src/features/home/EventDialog.tsx`: compatibility wrapper delegating to `FullscreenEventExperience`; remove BottomSheet dependency from event choice/result path.
- Modify `src/features/team/PlayerHubScreen.tsx`: accept `data: GameDataRegistry` and render personality card.
- Modify `src/app/GameApp.tsx`: pass the already-available `data` registry into Player Hub.
- Modify `src/features/team/player-hub.css`: personality section styling.
- Modify `tests/unit/features/home/EventDialog.test.tsx`: assert fullscreen semantics, choice flow, result flow, mandatory behavior.
- Create `tests/unit/domain/player/playerPersonalityPresentation.test.ts`: qualitative mapping tests.
- Modify `tests/unit/features/team/PlayerHubScreen.test.tsx`: assert public personality details.

---

### Task 1: Personality presentation selector

**Files:**
- Create: `src/domain/player/playerPersonalityPresentation.ts`
- Create: `tests/unit/domain/player/playerPersonalityPresentation.test.ts`

**Interfaces:**
- Consumes: `PersonalityDefinition` from `src/domain/validation/gameDataSchema.ts`.
- Produces:

```ts
export interface PlayerPersonalityPresentation {
  name: string;
  description: string;
  trainingStability: "安定" | "標準" | "波あり";
  relationshipBuilding: "得意" | "標準" | "苦手";
  pressureResponse: "強い" | "標準" | "弱い";
  moraleVolatility: "安定" | "標準" | "揺れやすい";
}

export function getPlayerPersonalityPresentation(
  personality: PersonalityDefinition,
): PlayerPersonalityPresentation;
```

- [ ] **Step 1: Write the failing selector test**

```ts
it("maps existing coefficients to qualitative personality tendencies", () => {
  const result = getPlayerPersonalityPresentation({
    id: "personality.test",
    name: "負けず嫌い",
    description: "競争で火が付く",
    trainingStability: 8,
    moraleVolatility: 74,
    relationshipGrowth: -4,
    pressureModifier: 9,
    tags: ["rivalry"],
  });

  expect(result).toMatchObject({
    name: "負けず嫌い",
    trainingStability: "安定",
    relationshipBuilding: "苦手",
    pressureResponse: "強い",
    moraleVolatility: "揺れやすい",
  });
});
```

Threshold contract for the implementation:

```ts
trainingStability >= 6 => "安定"
trainingStability <= -6 => "波あり"
relationshipGrowth >= 6 => "得意"
relationshipGrowth <= -3 => "苦手"
pressureModifier >= 6 => "強い"
pressureModifier <= -6 => "弱い"
moraleVolatility <= 35 => "安定"
moraleVolatility >= 65 => "揺れやすい"
otherwise => "標準"
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/domain/player/playerPersonalityPresentation.test.ts`

Expected: FAIL because `playerPersonalityPresentation.ts` does not exist.

- [ ] **Step 3: Implement the pure selector using the exact thresholds above**

```ts
export function getPlayerPersonalityPresentation(
  personality: PersonalityDefinition,
): PlayerPersonalityPresentation {
  return {
    name: personality.name,
    description: personality.description,
    trainingStability: personality.trainingStability >= 6
      ? "安定"
      : personality.trainingStability <= -6
        ? "波あり"
        : "標準",
    relationshipBuilding: personality.relationshipGrowth >= 6
      ? "得意"
      : personality.relationshipGrowth <= -3
        ? "苦手"
        : "標準",
    pressureResponse: personality.pressureModifier >= 6
      ? "強い"
      : personality.pressureModifier <= -6
        ? "弱い"
        : "標準",
    moraleVolatility: personality.moraleVolatility <= 35
      ? "安定"
      : personality.moraleVolatility >= 65
        ? "揺れやすい"
        : "標準",
  };
}
```

- [ ] **Step 4: Re-run focused test and typecheck**

Run:

```bash
npx vitest run tests/unit/domain/player/playerPersonalityPresentation.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/player/playerPersonalityPresentation.ts tests/unit/domain/player/playerPersonalityPresentation.test.ts
git commit -m "feat: add player personality presentation"
```

### Task 2: Expose personality on Player Hub

**Files:**
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/team/player-hub.css`
- Modify: `tests/unit/features/team/PlayerHubScreen.test.tsx`

**Interfaces:**
- Consumes: `GameDataRegistry`, `getPlayerPersonalityPresentation`.
- Produces: `PlayerHubScreenProps.data: GameDataRegistry` and a visible `aria-label="性格"` section on player detail.

- [ ] **Step 1: Add a failing UI test**

Render a selected player whose `personalityId` resolves in the standard test registry and assert:

```ts
expect(screen.getByRole("heading", { name: "性格" })).toBeInTheDocument();
expect(screen.getByText("負けず嫌い")).toBeInTheDocument();
expect(screen.getByText(/競争/)).toBeInTheDocument();
expect(screen.getByText(/プレッシャー/)).toBeInTheDocument();
```

- [ ] **Step 2: Run focused UI test and verify RED**

Run: `npx vitest run tests/unit/features/team/PlayerHubScreen.test.tsx`

Expected: personality assertions fail.

- [ ] **Step 3: Add `data` prop and render personality card**

Use:

```ts
const personality = data.personalities.get(selectedPlayer.personalityId);
const personalityPresentation = personality
  ? getPlayerPersonalityPresentation(personality)
  : null;
```

Render the section after development/talent and before recent growth. Do not display raw numeric coefficients.

- [ ] **Step 4: Pass `data` from `GameApp.tsx` and update every test render helper**

All `PlayerHubScreen` call sites must provide the same registry instance already available to the app. Test helpers use the repository's standard test registry rather than hand-built duplicate personality data.

- [ ] **Step 5: Run focused tests**

```bash
npx vitest run tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/domain/player/playerPersonalityPresentation.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/team/PlayerHubScreen.tsx src/app/GameApp.tsx src/features/team/player-hub.css tests/unit/features/team/PlayerHubScreen.test.tsx
git commit -m "feat: show player personality in Player Hub"
```

### Task 3: Fullscreen event choice state

**Files:**
- Create: `src/features/home/FullscreenEventExperience.tsx`
- Create: `src/features/home/fullscreen-event.css`
- Modify: `src/features/home/EventDialog.tsx`
- Modify: `tests/unit/features/home/EventDialog.test.tsx`

**Interfaces:**
- Consumes the existing `EventDialogProps` contract:

```ts
interface FullscreenEventExperienceProps {
  state: GameState;
  data: GameDataRegistry;
  onChoose: (choiceId: string) => void | Promise<void>;
}
```

- Produces a top-level element with `role="dialog"`, `aria-modal="true"`, `data-testid="fullscreen-event"`, and `data-phase="choice" | "result"`.

- [ ] **Step 1: Change EventDialog tests to describe fullscreen behavior**

Add assertions:

```ts
const dialog = screen.getByRole("dialog", { name: event.title });
expect(dialog).toHaveAttribute("aria-modal", "true");
expect(screen.getByTestId("fullscreen-event")).toHaveAttribute("data-phase", "choice");
expect(screen.queryByTestId("bottom-sheet")).not.toBeInTheDocument();
```

Also keep existing choice-label, actor-name, and rendered-story assertions.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run tests/unit/features/home/EventDialog.test.tsx`

Expected: fullscreen assertions fail while existing event behavior remains green.

- [ ] **Step 3: Implement `FullscreenEventExperience` choice state**

Structure:

```tsx
<div
  aria-labelledby="fullscreen-event-title"
  aria-modal="true"
  className="fullscreen-event"
  data-phase="choice"
  data-testid="fullscreen-event"
  role="dialog"
>
  <header className="fullscreen-event__header">...</header>
  <main className="fullscreen-event__content">...</main>
  <footer className="fullscreen-event__actions">...</footer>
</div>
```

Reuse `renderEventText`, actor identity, `SchoolEmblem`, and current disabled/resolving behavior. Do not add a close button while `pendingEvent` exists.

- [ ] **Step 4: Make `EventDialog` a thin wrapper**

```tsx
export function EventDialog(props: EventDialogProps) {
  return <FullscreenEventExperience {...props} />;
}
```

Remove `BottomSheet` imports from the event path.

- [ ] **Step 5: Add viewport/safe-area CSS**

Required CSS properties:

```css
.fullscreen-event {
  position: fixed;
  inset: 0;
  z-index: 1000;
  min-height: 100dvh;
  padding-top: env(safe-area-inset-top);
  padding-right: env(safe-area-inset-right);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  overflow: hidden;
}

.fullscreen-event__content {
  min-height: 0;
  overflow-y: auto;
}

.fullscreen-event__actions {
  position: sticky;
  bottom: 0;
}
```

Do not force event text below `1rem` on mobile and keep choice touch targets at least 48px high.

- [ ] **Step 6: Re-run focused tests and commit**

```bash
npx vitest run tests/unit/features/home/EventDialog.test.tsx
npm run typecheck
git add src/features/home/FullscreenEventExperience.tsx src/features/home/fullscreen-event.css src/features/home/EventDialog.tsx tests/unit/features/home/EventDialog.test.tsx
git commit -m "feat: make choice events fullscreen"
```

### Task 4: Fullscreen in-place result state and accessibility

**Files:**
- Modify: `src/features/home/FullscreenEventExperience.tsx`
- Modify: `src/features/home/fullscreen-event.css`
- Modify: `tests/unit/features/home/EventDialog.test.tsx`

**Interfaces:**
- Consumes: latest matching `EventOccurrence` from `state.eventMemory.history` after `onChoose` resolves.
- Produces: `data-phase="result"`, visible selected action, visible result codes, explicit `結果を確認した` button.

- [ ] **Step 1: Add failing result-state assertions**

Simulate choice, rerender with `pendingEvent=null` plus matching history occurrence, then assert:

```ts
expect(screen.getByTestId("fullscreen-event")).toHaveAttribute("data-phase", "result");
expect(screen.getByText("選んだ対応")).toBeInTheDocument();
expect(screen.getByText("士気 +3")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "結果を確認した" })).toBeInTheDocument();
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npx vitest run tests/unit/features/home/EventDialog.test.tsx`

Expected: result-phase assertions fail.

- [ ] **Step 3: Move existing result matching logic into fullscreen component**

Preserve the current safety rule: only show result state when the latest occurrence matches the event ID and selected choice ID stored before resolution. Clicking `結果を確認した` clears only local resolution UI state.

- [ ] **Step 4: Add focus/background/reduced-motion behavior**

Implementation requirements:

```ts
useEffect(() => {
  const previous = document.activeElement as HTMLElement | null;
  firstActionRef.current?.focus();
  return () => previous?.focus();
}, []);
```

Lock background scrolling while mounted and restore the previous `document.body.style.overflow` on cleanup. Apply a `fullscreen-event--reduced-motion` class when `state.settings.reducedMotion` is true. CSS must also use `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 5: Test mandatory dismissal and focus semantics**

Assert no generic close button exists during choice phase, result confirmation is present only after a matching result, and the first actionable choice receives focus.

- [ ] **Step 6: Run focused tests and commit**

```bash
npx vitest run tests/unit/features/home/EventDialog.test.tsx
npm run typecheck
git add src/features/home/FullscreenEventExperience.tsx src/features/home/fullscreen-event.css tests/unit/features/home/EventDialog.test.tsx
git commit -m "feat: show event results in fullscreen flow"
```

### Task 5: PR21-1 verification gate

**Files:**
- No production-code additions unless verification identifies a defect.
- Update tests only if the defect requires a regression test first.

**Interfaces:**
- Produces a branch that is safe to open as PR21-1.

- [ ] **Step 1: Run focused suites**

```bash
npx vitest run tests/unit/domain/player/playerPersonalityPresentation.test.ts tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/features/home/EventDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run static checks**

```bash
npm run typecheck
npm run lint
npm run format:check
```

Expected: PASS with zero warnings.

- [ ] **Step 3: Run full verification**

```bash
npm run verify
```

Expected: PASS.

- [ ] **Step 4: Run branch safe gate in GitHub Actions before opening PR**

The temporary branch-only workflow must run the focused suites and `npm run verify`. Delete the temporary workflow before PR creation. If an intentional RED test is demonstrated, capture its exit code and assert that failure was expected so the workflow itself concludes success.

- [ ] **Step 5: Review final diff**

Confirm PR21-1 contains no schema-version bump, no relationship gameplay modifier, no match-engine change, and no temporary workflow file.

- [ ] **Step 6: Commit any final formatting-only changes**

```bash
git add -A
git commit -m "chore: finalize Phase21 fullscreen event UI"
```

Skip this commit if there are no final changes.
