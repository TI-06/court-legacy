# Phase21 PR21-1 Fullscreen Events and Personality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace choice-based BottomSheet events with a dedicated fullscreen event experience and expose each player's existing public personality in both Player Hub and event actor cards, without changing simulation balance.

**Architecture:** Keep event selection/resolution domain behavior unchanged in PR21-1. `FullscreenEventExperience` owns choice/result presentation while `EventDialog` becomes a compatibility wrapper. A pure personality-presentation selector maps existing coefficients to qualitative labels. `GameDataRegistry` is passed into Player Hub and already exists in the event flow. Relationship labels/special tags are intentionally added in PR21-2 after their canonical presentation model exists.

**Tech Stack:** React 19, TypeScript 5.9, Vitest, Testing Library, CSS, existing `GameDataRegistry`, existing event pipeline.

**Spec:** `docs/superpowers/specs/2026-09-15-phase21-player-relationships-fullscreen-events-design.md`

## Global Constraints

- Every `PendingEvent` requiring a choice uses fullscreen presentation; ordinary informational notifications remain compact.
- Choice and result states both use the fullscreen flow; no event-choice/result `BottomSheet` remains.
- Use `100dvh`, safe-area insets, readable mobile text, scrollable center content, and easy-to-reach 2-4 choice actions.
- Mandatory pending events remain non-dismissible until a valid choice resolves.
- Actor cards show name, grade, position, school/emblem, and public personality name. PR21-2 later adds relationship labels/tags.
- Result state shows selected action, involved players, and all visible result codes, then explicit `結果を確認した` confirmation.
- No new match-stat, relationship, or training-growth behavior in PR21-1.
- Personality is public immediately and qualitative; do not expose raw coefficients.
- Respect `state.settings.reducedMotion` and `prefers-reduced-motion`.
- TDD required. Before PR: focused tests, typecheck, lint, format, `npm run verify`, branch safe gate. Intentional RED Actions must verify expected failure but make the workflow conclude success.

---

## File Structure

- Create `src/domain/player/playerPersonalityPresentation.ts`.
- Create `src/features/home/FullscreenEventExperience.tsx`.
- Create `src/features/home/fullscreen-event.css`.
- Modify `src/features/home/EventDialog.tsx`.
- Modify `src/features/team/PlayerHubScreen.tsx`, `src/features/team/player-hub.css`.
- Modify `src/app/GameApp.tsx` to pass registry into Player Hub.
- Create `tests/unit/domain/player/playerPersonalityPresentation.test.ts`.
- Modify `tests/unit/features/home/EventDialog.test.tsx`.
- Modify `tests/unit/features/team/PlayerHubScreen.test.tsx`.

---

### Task 1: Pure personality presentation

**Files:**

- Create: `src/domain/player/playerPersonalityPresentation.ts`
- Create: `tests/unit/domain/player/playerPersonalityPresentation.test.ts`

**Interface:**

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

Exact thresholds:

```text
trainingStability >= 6 => 安定; <= -6 => 波あり; else 標準
relationshipGrowth >= 6 => 得意; <= -3 => 苦手; else 標準
pressureModifier >= 6 => 強い; <= -6 => 弱い; else 標準
moraleVolatility <= 35 => 安定; >= 65 => 揺れやすい; else 標準
```

- [ ] **Step 1: Write failing threshold tests** for positive/neutral/negative boundaries.
- [ ] **Step 2: Run RED:** `npx vitest run tests/unit/domain/player/playerPersonalityPresentation.test.ts`.
- [ ] **Step 3: Implement only the pure mapping above.**
- [ ] **Step 4: Run GREEN + typecheck.**

```bash
npx vitest run tests/unit/domain/player/playerPersonalityPresentation.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/player/playerPersonalityPresentation.ts tests/unit/domain/player/playerPersonalityPresentation.test.ts
git commit -m "feat: add player personality presentation"
```

### Task 2: Public personality in Player Hub

**Files:**

- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/team/player-hub.css`
- Modify: `src/app/GameApp.tsx`
- Modify: `tests/unit/features/team/PlayerHubScreen.test.tsx`

**Interface:** `PlayerHubScreenProps` gains `data: GameDataRegistry`.

- [ ] **Step 1: Add failing detail-screen assertions** for heading `性格`, personality name/description, and qualitative pressure/relationship/training/morale tendencies.
- [ ] **Step 2: Run RED:** `npx vitest run tests/unit/features/team/PlayerHubScreen.test.tsx`.
- [ ] **Step 3: Resolve `selectedPlayer.personalityId` from registry and render the personality section after growth/talent and before recent growth.** Raw coefficients never render.
- [ ] **Step 4: Pass the existing registry from `GameApp.tsx` and update all PlayerHub test render helpers.**
- [ ] **Step 5: Run GREEN + typecheck.**

```bash
npx vitest run tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/domain/player/playerPersonalityPresentation.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/features/team/PlayerHubScreen.tsx src/features/team/player-hub.css src/app/GameApp.tsx tests/unit/features/team/PlayerHubScreen.test.tsx
git commit -m "feat: show player personality in Player Hub"
```

### Task 3: Fullscreen event choice state with personality actor cards

**Files:**

- Create: `src/features/home/FullscreenEventExperience.tsx`
- Create: `src/features/home/fullscreen-event.css`
- Modify: `src/features/home/EventDialog.tsx`
- Modify: `tests/unit/features/home/EventDialog.test.tsx`

**Interface:**

```ts
interface FullscreenEventExperienceProps {
  state: GameState;
  data: GameDataRegistry;
  onChoose: (choiceId: string) => void | Promise<void>;
}
```

Top-level contract:

```tsx
<div
  aria-labelledby="fullscreen-event-title"
  aria-modal="true"
  data-phase="choice"
  data-testid="fullscreen-event"
  role="dialog"
>
```

- [ ] **Step 1: Add failing fullscreen tests** asserting `role=dialog`, `aria-modal=true`, `data-phase=choice`, event title/body, 2-4 choices, and no dismiss control while pending.
- [ ] **Step 2: Add failing actor-card assertion** that the involved player's public personality name appears in the event screen.
- [ ] **Step 3: Run RED:** `npx vitest run tests/unit/features/home/EventDialog.test.tsx`.
- [ ] **Step 4: Implement fullscreen structure.** Header: category/title. Content: larger actor cards + story. Actions: choice buttons. Resolve actor personality through `data.personalities` and show public personality name only; do not show raw coefficients.
- [ ] **Step 5: Make `EventDialog` a thin wrapper** returning `<FullscreenEventExperience {...props} />`; remove BottomSheet dependency from this path.
- [ ] **Step 6: Add required CSS:** fixed inset0, `min-height:100dvh`, safe-area padding, `overflow:hidden`; center content `overflow-y:auto`; action region sticky/bottom reachable; event body >=1rem on mobile; buttons >=48px.
- [ ] **Step 7: Run GREEN + typecheck and commit.**

```bash
npx vitest run tests/unit/features/home/EventDialog.test.tsx
npm run typecheck
git add src/features/home/FullscreenEventExperience.tsx src/features/home/fullscreen-event.css src/features/home/EventDialog.tsx tests/unit/features/home/EventDialog.test.tsx
git commit -m "feat: make choice events fullscreen"
```

### Task 4: In-place fullscreen result and accessibility

**Files:**

- Modify: `src/features/home/FullscreenEventExperience.tsx`
- Modify: `src/features/home/fullscreen-event.css`
- Modify: `tests/unit/features/home/EventDialog.test.tsx`

**Result contract:** when latest occurrence matches the locally selected event+choice, keep fullscreen mounted with `data-phase="result"` and show selected action, actor names, formatted visible results, and `結果を確認した`.

- [ ] **Step 1: Add failing result-state test**: choose, rerender with matching occurrence/pending null, expect `data-phase=result`, `選んだ対応`, result code such as `士気 +3`, and confirmation button.
- [ ] **Step 2: Add mismatch regression**: unrelated latest occurrence must not be shown as this choice result.
- [ ] **Step 3: Run RED.**
- [ ] **Step 4: Move the existing selected-resolution matching logic into fullscreen component and implement result view.**
- [ ] **Step 5: Implement focus/background behavior:** remember prior focus, focus first choice, lock/restore `document.body.style.overflow`, return focus on unmount/confirmation where meaningful.
- [ ] **Step 6: Apply `fullscreen-event--reduced-motion` when game setting is on and `@media (prefers-reduced-motion: reduce)` in CSS.**
- [ ] **Step 7: Run GREEN + typecheck and commit.**

```bash
npx vitest run tests/unit/features/home/EventDialog.test.tsx
npm run typecheck
git add src/features/home/FullscreenEventExperience.tsx src/features/home/fullscreen-event.css tests/unit/features/home/EventDialog.test.tsx
git commit -m "feat: show event results in fullscreen flow"
```

### Task 5: PR21-1 verification gate

- [ ] **Step 1: Focused suites**

```bash
npx vitest run tests/unit/domain/player/playerPersonalityPresentation.test.ts tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/features/home/EventDialog.test.tsx
```

- [ ] **Step 2: Static/full checks**

```bash
npm run typecheck
npm run lint
npm run format:check
npm run verify
```

- [ ] **Step 3: Branch-only safe gate before PR.** Run focused suites + `npm run verify`; delete temporary workflow before opening PR. Expected RED demonstrations must conclude workflow success after checking expected failure.
- [ ] **Step 4: Final diff review:** no schema bump, no relationship gameplay modifier, no match-engine change, no informational-notification fullscreen conversion, no temporary workflow.
- [ ] **Step 5: Commit only if verification found an actual regression, with a failing test first.**
