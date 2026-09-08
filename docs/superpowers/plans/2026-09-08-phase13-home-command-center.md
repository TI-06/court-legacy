# Phase 13 Home Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current collection-style Home dashboard with a mobile-first weekly coaching command center derived from existing game state, while preserving save compatibility and the current server-authoritative match flow.

**Architecture:** Add a pure `GameState -> HomeCommandCenterModel` selector, render it through a stateless `HomeCommandCenter`, keep `HomeScreen` as the small container for notification/warning sheet state, and keep `GameApp` responsible for navigation and authoritative actions. No new save schema, generic Home feed, Worker endpoint, or match simulation path is introduced.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Testing Library, Playwright, Vite, existing Cloudflare Worker action flow.

**Spec:** `docs/superpowers/specs/2026-09-08-phase13-home-command-center-design.md`

## Global Constraints

- Implement from an isolated worktree/branch `feat/phase13-home-command-center` created from `docs/phase13-home-command-center-design`.
- Do not modify `GameState.schemaVersion` or persist Home tasks/news.
- Do not add a Home-specific Worker endpoint.
- Do not change pre-match, match simulation authority, temporary lineup persistence, or PvP privacy.
- Do not add prefectural/national rank before Phase 17.
- Do not reintroduce fatigue management into Home.
- Task cards: max 5. News items: max 3.
- Player concerns: max 2; severity desc, grade desc, player ID asc.
- Assistant-coach recommendation: academic week 1-8 inclusive only if no current-year contract.
- Significant growth: newest training result only, `totalAbilityGrowth >= 5`.
- Cohesion news: `abs(cohesion - previousCohesion) >= 3`.
- The only Phase 13 week-advance warning is an unanswered incoming practice offer.
- Rename Home CTA `次の週へ進む` -> `今週を進める` and update affected copy/tests.
- Home must fit 320 / 360 / 390 / 414 / 480 px with no horizontal page overflow.

## File Map

### Create

- `src/features/home/homeCommandCenter.ts`
- `src/features/home/HomeCommandCenter.tsx`
- `src/features/home/home-command-center.css`
- `tests/unit/features/home/homeCommandCenter.test.ts`
- `tests/unit/app/GameApp.homeCommandCenter.test.tsx`
- `tests/e2e/phase13-home-command-center.spec.ts`

### Modify

- `src/features/home/HomeScreen.tsx`
- `src/features/home/home.css`
- `src/features/team/PlayerHubScreen.tsx`
- `src/features/school/SchoolNavigationState.ts`
- `src/app/GameApp.tsx`
- `tests/unit/features/home/HomeScreen.test.tsx`
- `tests/unit/features/team/PlayerHubScreen.test.tsx`
- `tests/unit/features/school/SchoolScreen.test.tsx`
- `tests/unit/app/GameApp.officialTournament.test.tsx`
- `tests/unit/app/GameAppActions.test.tsx`
- `tests/e2e/phase9-home-ui.spec.ts`
- `tests/e2e/home-match-flow.spec.ts`
- `tests/e2e/mobile-layout-audit.spec.ts`

### Must remain unchanged

- `src/domain/model/GameState.ts`
- persisted notification shape in `src/domain/notifications/gameNotifications.ts`
- `worker/game/actionSchema.ts`
- `worker/game/applyServerGameAction.ts`
- `worker/routes/pvpChallenge.ts`

---

# Task 1: Pure Home command-center selector

**Files:** create `src/features/home/homeCommandCenter.ts`, create `tests/unit/features/home/homeCommandCenter.test.ts`.

## Public contract

Use one UI-oriented action union; do not build a second router:

```ts
export type HomeCommandPriority =
  "critical" | "attention" | "normal" | "complete";

export type HomeCommandAction =
  | { target: "team" }
  | { target: "player"; playerId: PlayerId }
  | { target: "school"; view: "facilities" | "staff" }
  | { target: "scouting" }
  | { target: "practice" }
  | { target: "tournament" }
  | { target: "start-week-match" };

export interface HomeSummary {
  dateLabel: string;
  weekLabel: string;
  schoolName: string;
  strength: number;
  strengthGrade: string;
  condition: { label: string; icon: string; colorToken: string };
  cohesion: number;
  cohesionTrend: CohesionTrend;
  official: null | {
    competitionLabel: string;
    detailLabel: string;
    timingLabel: string;
    due: boolean;
  };
}

interface HomeBaseTask {
  id: string;
  priority: HomeCommandPriority;
  category:
    | "official"
    | "practice"
    | "training"
    | "player"
    | "injury"
    | "facility"
    | "staff"
    | "scouting";
  title: string;
  detail: string;
}

export type HomeCommandTask =
  | (HomeBaseTask & {
      kind: "action";
      action?: HomeCommandAction;
      actionLabel?: string;
      complete?: boolean;
    })
  | (HomeBaseTask & {
      kind: "practice-offer";
      offer: {
        schoolId: SchoolId;
        schoolName: string;
        strength: number | null;
        strengthGrade: string | null;
        growthRating: number;
        loadRating: number;
      };
    });

export type HomeCommandNews =
  | {
      id: string;
      kind: "training-result";
      title: string;
      detail: string;
      notification: TrainingResultNotification;
    }
  | {
      id: string;
      kind: "growth";
      title: string;
      detail: string;
      playerId: PlayerId;
    }
  | { id: string; kind: "match"; title: string; detail: string }
  | { id: string; kind: "cohesion"; title: string; detail: string };

export interface HomeCommandCenterModel {
  summary: HomeSummary;
  tasks: HomeCommandTask[];
  news: HomeCommandNews[];
  advance: {
    requiresConfirmation: boolean;
    reason: "practice-offer" | null;
  };
}

export function selectHomeCommandCenter(input: {
  state: GameState;
  data: Pick<GameDataRegistry, "trainingMenus">;
  homeStrength: number;
}): HomeCommandCenterModel;
```

The standalone `TrainingScreen` is currently not connected to the app's top-level navigation. Phase 13 must not create a new navigation layer just to use it. The Home training task emits `{ target: "team" }` and leads to the existing player/individual-training workflow. Reconnecting `TrainingScreen` is a separate future change.

- [ ] **RED:** create selector tests with `createDemoGame()` and explicit state mutations.

Minimum assertions:

```ts
function select(state = createDemoGame(), homeStrength = 8120) {
  return selectHomeCommandCenter({ state, data: gameData, homeStrength });
}

it("does not invent a prefectural rank", () => {
  const model = select();
  expect(model.summary.schoolName).toBe("青葉");
  expect(model.summary.strength).toBe(8120);
  expect(JSON.stringify(model.summary)).not.toMatch(/県.*位|全国.*位/);
});

it("warns only for an unanswered practice offer", () => {
  const state = createDemoGame();
  expect(select(state).advance).toEqual({
    requiresConfirmation: true,
    reason: "practice-offer",
  });
  state.weeklySchedule.practiceMatch.incomingOffer = null;
  expect(select(state).advance).toEqual({
    requiresConfirmation: false,
    reason: null,
  });
});

it.each([1, 8])("recommends a coach in academic week %i", (week) => {
  const state = createDemoGame();
  state.calendar.weekOfYear = week;
  state.schoolManagement.assistantCoach = null;
  expect(select(state).tasks.some((task) => task.category === "staff")).toBe(
    true,
  );
});

it("stops the coach recommendation after week 8", () => {
  const state = createDemoGame();
  state.calendar.weekOfYear = 9;
  state.schoolManagement.assistantCoach = null;
  expect(select(state).tasks.some((task) => task.category === "staff")).toBe(
    false,
  );
});
```

In the same test file cover: future official summary, due official critical task, scheduled practice task, training configured/completed states, concern ordering and max 2, one/multiple injury aggregation, affordable facility aggregation, current-year coach suppression, unread training result, growth threshold 5 and tie by player ID, latest user-school match, cohesion threshold 3, task priority order, max 5 tasks, max 3 news, deterministic IDs/order.

- [ ] Run and confirm RED:

```bash
npm test -- tests/unit/features/home/homeCommandCenter.test.ts
```

- [ ] **GREEN:** implement the pure selector. Reuse:
  - `isWeeklyActionCompleted`
  - `getPlayerConditionPresentation`
  - `selectHomeTrainingNotifications`
  - `calculateSelectionStrength`
  - `schoolStrengthToGrade`
  - `FACILITY_DEFINITIONS` / `evaluateFacilityUpgrade`
  - `autoSelectTeam`
  - `selectNextOfficialEvent`

Internally assign each task/news candidate a numeric priority and stable ID, sort deterministically, then slice to 5/3. Never mutate `GameState`.

Treat an old-year assistant coach as no current contract:

```ts
const contract = state.schoolManagement.assistantCoach;
const hasCurrentCoach = contract?.contractYearIndex === state.yearIndex;
```

- [ ] Run focused tests and typecheck:

```bash
npm test -- tests/unit/features/home/homeCommandCenter.test.ts
npm run typecheck
```

- [ ] Commit:

```bash
git add src/features/home/homeCommandCenter.ts tests/unit/features/home/homeCommandCenter.test.ts
git commit -m "feat: derive Phase 13 home command model"
```

---

# Task 2: Command-center Home UI

**Files:** create `HomeCommandCenter.tsx`, create `home-command-center.css`, modify `HomeScreen.tsx`, `home.css`, `HomeScreen.test.tsx`.

## Component boundary

```ts
interface HomeCommandCenterProps {
  model: HomeCommandCenterModel;
  operationPending: boolean;
  onCommand: (action: HomeCommandAction) => void;
  onAcceptPracticeOffer: () => void;
  onDeclinePracticeOffer: () => void;
  onOpenTrainingNotification: (
    notification: TrainingResultNotification,
  ) => void;
}

interface HomeScreenProps {
  state: GameState;
  data: Pick<GameDataRegistry, "trainingMenus">;
  homeStrength: number;
  onCommand: (action: HomeCommandAction) => void;
  onAdvanceWeek: () => void;
  onAcceptPracticeOffer?: () => void;
  onDeclinePracticeOffer?: () => void;
  operationPending?: boolean;
  onMarkNotificationRead: (notificationId: string) => Promise<void> | void;
}
```

Remove Home props that are derivable from `GameState`: `opponent`, `latestMatch`, `trainingCompleted`, `practiceMatchCompleted`, and direct `onOpenX` callbacks.

- [ ] **RED:** rewrite `HomeScreen.test.tsx` around the new hierarchy:

```tsx
expect(screen.getByTestId("home-command-summary")).toBeVisible();
expect(screen.getByText("今週の監督タスク")).toBeVisible();
expect(screen.getByRole("button", { name: "今週を進める" })).toBeVisible();
expect(screen.queryByText(/県\d+位/)).toBeNull();
```

Add tests that:

- practice offer renders exactly `断る` / `受ける`;
- ordinary task emits its exact `HomeCommandAction`;
- training-result news opens the existing `TrainingResultNotificationSheet` and marks unread as read;
- no-task state shows `今週の準備は整っています`;
- no-news state omits the section.

- [ ] Run and confirm RED:

```bash
npm test -- tests/unit/features/home/HomeScreen.test.tsx
```

- [ ] **GREEN:** implement `HomeCommandCenter.tsx` with stable selectors:

```tsx
<section data-testid="home-command-summary" className="home-command-summary" />
<section className="home-command-tasks" aria-labelledby="home-command-tasks-heading" />
<article data-testid="home-command-task" className="home-command-task" />
<section className="home-command-news" aria-labelledby="home-command-news-heading" />
<button data-testid="home-command-news" />
```

Keep `id="home-week-heading"`. Keep an accessible `大会表を見る` action from the official summary. Ordinary tasks have at most one action; `practice-offer` is the sole two-button task.

- [ ] **GREEN:** make `HomeScreen` derive the model and own only local UI state:
  - selected training notification;
  - week-advance warning open/closed.

Reuse existing `StickyActionBar` and `BottomSheet`. Wrap the sticky control:

```tsx
<div className="home-command-advance" data-testid="home-command-advance">
  <StickyActionBar
    disabled={operationPending}
    label="今週を進める"
    onClick={requestAdvance}
  />
</div>
```

Warning sheet:

```tsx
<BottomSheet
  open={advanceWarningOpen}
  title="未回答の申し込みがあります"
  description="練習試合の申し込みが未回答です。このまま次週へ進みますか？"
  onClose={() => setAdvanceWarningOpen(false)}
>
  <button type="button" onClick={() => setAdvanceWarningOpen(false)}>
    戻る
  </button>
  <button type="button" onClick={confirmAdvance}>
    そのまま進む
  </button>
</BottomSheet>
```

`requestAdvance` opens this sheet only when `model.advance.requiresConfirmation`; otherwise it immediately calls the existing `onAdvanceWeek`.

- [ ] **GREEN:** add `home-command-center.css`:
  - one compact summary card;
  - 3-cell strength/condition/cohesion grid at every supported width;
  - single-column tasks/news;
  - no horizontal scrolling;
  - 44px-ish touch targets;
  - bottom spacing sufficient for sticky action bar + bottom navigation;
  - long player/school names ellipsize.

Prune obsolete Home card CSS only after new tests are GREEN. Do not change training-result sheet CSS without a demonstrated regression.

- [ ] Verify:

```bash
npm test -- tests/unit/features/home/HomeScreen.test.tsx tests/unit/features/home/homeCommandCenter.test.ts
npm run lint
npm run typecheck
```

- [ ] Commit:

```bash
git add src/features/home/HomeCommandCenter.tsx src/features/home/HomeScreen.tsx src/features/home/home-command-center.css src/features/home/home.css tests/unit/features/home/HomeScreen.test.tsx
git commit -m "feat: rebuild Home as coaching command center"
```

---

# Task 3: App navigation and deep-links

**Files:** modify `GameApp.tsx`, `PlayerHubScreen.tsx`, `SchoolNavigationState.ts`; create `GameApp.homeCommandCenter.test.tsx`; modify related team/school/app tests.

- [ ] **RED:** add `PlayerHubScreen` initial-focus test:

```tsx
render(
  <PlayerHubScreen
    initialPlayerId={player.id}
    onAssignLeadership={vi.fn()}
    onChange={vi.fn()}
    selection={selection}
    state={state}
  />,
);
expect(
  screen.getByRole("heading", {
    name: `${player.lastName} ${player.firstName}`,
  }),
).toBeVisible();
```

- [ ] **RED:** create `GameApp.homeCommandCenter.test.tsx` using the same auth/API fixture pattern as `GameAppActions.test.tsx`. Cover:
  1. a severity-3 player concern -> `確認` opens that player's detail;
  2. `設備を見る` -> School facilities;
  3. `スタッフを見る` -> School staff;
  4. unanswered offer -> `今週を進める` shows warning and makes no API call until `そのまま進む`;
  5. ordinary bottom-nav Team entry does not reopen a previously deep-linked player.

- [ ] Update `GameApp.officialTournament.test.tsx` so the due official task's `試合準備` button enters the existing pre-match screen before any API call. After `この編成で試合開始`, retain the existing assertion that `advance-week` is sent with `matchSelection`.

- [ ] Run and confirm RED:

```bash
npm test -- tests/unit/app/GameApp.homeCommandCenter.test.tsx tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/app/GameApp.officialTournament.test.tsx
```

- [ ] **GREEN:** add optional `initialPlayerId?: PlayerId | null` to `PlayerHubScreenProps` and initialize local `selectedPlayerId` from it. Do not persist it.

- [ ] **GREEN:** generalize `SchoolNavigationState` while preserving existing callers:

```ts
let requestedSchoolView: Exclude<SchoolView, "scouting"> | null = null;

export function requestSchoolView(view: Exclude<SchoolView, "scouting">): void {
  requestedSchoolView = view;
}

export const requestSchoolViewAfterScouting = requestSchoolView;

export function consumeSchoolViewAfterScouting(): SchoolView {
  return requestedSchoolView ?? "facilities";
}
```

- [ ] **GREEN:** in `GameApp`, add transient `teamInitialPlayerId` and one `handleHomeCommand` switch:

```ts
const [teamInitialPlayerId, setTeamInitialPlayerId] = useState<PlayerId | null>(
  null,
);

const handleHomeCommand = (action: HomeCommandAction) => {
  switch (action.target) {
    case "team":
      setTeamInitialPlayerId(null);
      setActiveTab("team");
      return;
    case "player":
      setTeamInitialPlayerId(action.playerId);
      setActiveTab("team");
      return;
    case "school":
      requestSchoolView(action.view);
      setActiveTab("school");
      return;
    case "scouting":
      setActiveTab("school");
      openScouting();
      return;
    case "practice":
      openFreshPracticeMatch();
      return;
    case "tournament":
      openOfficialTournament();
      return;
    case "start-week-match":
      advanceWeek();
      return;
  }
};
```

Pass `initialPlayerId={teamInitialPlayerId}` to `PlayerHubScreen`. When Team is entered through ordinary bottom navigation, clear the transient player ID first.

Pass the new Home props only:

```tsx
<HomeScreen
  data={gameData}
  homeStrength={homeStrength}
  onAcceptPracticeOffer={() => void acceptPracticeOffer()}
  onAdvanceWeek={advanceWeek}
  onCommand={handleHomeCommand}
  onDeclinePracticeOffer={() => void declinePracticeOffer()}
  onMarkNotificationRead={markNotificationRead}
  operationPending={cloudSession.operation.status === "submitting"}
  state={gameState}
/>
```

- [ ] Update existing Home CTA copy assertions (`次の週へ進む` -> `今週を進める`) in `GameAppActions.test.tsx`, official tournament test, and any user-facing instructional text that explicitly names the Home CTA.

- [ ] Verify focused tests, then full unit suite:

```bash
npm test -- tests/unit/app/GameApp.homeCommandCenter.test.tsx tests/unit/app/GameApp.officialTournament.test.tsx tests/unit/app/GameAppActions.test.tsx tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/features/school/SchoolScreen.test.tsx
npm test
```

- [ ] Commit:

```bash
git add src/app/GameApp.tsx src/features/team/PlayerHubScreen.tsx src/features/school/SchoolNavigationState.ts tests/unit/app/GameApp.homeCommandCenter.test.tsx tests/unit/app/GameApp.officialTournament.test.tsx tests/unit/app/GameAppActions.test.tsx tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/features/school/SchoolScreen.test.tsx
git commit -m "feat: route Home coaching commands"
```

---

# Task 4: E2E and mobile migration

**Files:** create `phase13-home-command-center.spec.ts`; modify `phase9-home-ui.spec.ts`, `home-match-flow.spec.ts`, `mobile-layout-audit.spec.ts`.

- [ ] **RED:** create the Phase 13 E2E baseline:

```ts
for (const width of [320, 360, 390, 414, 480]) {
  test(`${width}px Home command center fits`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 900 });
    await page.goto("/");
    await expect(page.getByTestId("home-command-summary")).toBeVisible();
    await expect(page.getByText("今週の監督タスク")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "今週を進める" }),
    ).toBeVisible();

    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(layout.body).toBeLessThanOrEqual(layout.viewport);
    expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  });
}

test("unanswered practice offer warns before week advance", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "今週を進める" }).click();
  const dialog = page.getByRole("dialog", {
    name: "未回答の申し込みがあります",
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "戻る" }).click();
  await expect(dialog).toHaveCount(0);
});
```

Add one E2E deep-link using a management task visible in the demo (`設備を見る` or `スタッフを見る`) and assert the requested School view opens. Do not make E2E depend on a concern that default demo data may not contain.

- [ ] Run and confirm RED:

```bash
npm run test:e2e -- tests/e2e/phase13-home-command-center.spec.ts
```

- [ ] **GREEN:** migrate legacy Home E2E references:
  - `phase9-home-ui.spec.ts`: use `home-command-summary`, `.home-command-advance`, and `今週を進める`; stop relying on `.home-official-card`.
  - `home-match-flow.spec.ts`: preserve `#home-week-heading`; use `今週を進める`; find training news by accessible `今週の練習結果` rather than `.home-notification-list`; keep pre-match -> digest -> result at all 5 widths.
  - `mobile-layout-audit.spec.ts`: replace `.home-next-week-button` with `.home-command-advance`; use `今週を進める`; explicitly assert no horizontal scroll on `.home-screen`; keep existing pre-match and training-result-sheet audits.

- [ ] Run focused E2E:

```bash
npm run test:e2e -- tests/e2e/phase13-home-command-center.spec.ts tests/e2e/phase9-home-ui.spec.ts tests/e2e/home-match-flow.spec.ts tests/e2e/mobile-layout-audit.spec.ts
```

If layout fails, fix the actual overflow/overlap. Do not weaken the auditor, remove a supported width, or add horizontal scrolling to conceal the defect.

- [ ] Run static checks:

```bash
npm run format:check
npm run lint
npm run typecheck
```

- [ ] Commit:

```bash
git add tests/e2e/phase13-home-command-center.spec.ts tests/e2e/phase9-home-ui.spec.ts tests/e2e/home-match-flow.spec.ts tests/e2e/mobile-layout-audit.spec.ts
git commit -m "test: cover Phase 13 Home command center"
```

---

# Task 5: Final verification and PR readiness

No feature scope expansion in this task. Only fix regressions demonstrated by verification.

- [ ] Confirm forbidden persistence/server files are unchanged:

```bash
git diff docs/phase13-home-command-center-design...HEAD -- src/domain/model/GameState.ts src/domain/notifications/gameNotifications.ts worker/game/actionSchema.ts worker/game/applyServerGameAction.ts worker/routes/pvpChallenge.ts
```

Expected: no diff.

- [ ] Run repository verification:

```bash
npm run verify
```

Expected: formatting, lint, typecheck, unit/integration tests, and production build GREEN.

- [ ] Run full Playwright suite:

```bash
npm run test:e2e
```

Expected: all tests GREEN, including Home at 320/360/390/414/480.

- [ ] Review the final file list:

```bash
git diff --name-status docs/phase13-home-command-center-design...HEAD
```

Only the approved spec/plan plus files listed in this plan should appear.

- [ ] Inspect critical diffs:

```bash
git diff docs/phase13-home-command-center-design...HEAD -- src/features/home/homeCommandCenter.ts src/features/home/HomeCommandCenter.tsx src/features/home/HomeScreen.tsx src/app/GameApp.tsx src/features/team/PlayerHubScreen.tsx src/features/school/SchoolNavigationState.ts
```

Verify:

- deterministic task/news ordering and 5/3 caps;
- no rank fabrication;
- only practice-offer warning;
- due official action reaches existing pre-match before API simulation;
- normal week advance remains available;
- no stale player deep-link on normal Team navigation;
- no horizontal Home scrolling.

- [ ] If verification reveals a defect, rerun the smallest failing test, make only the demonstrated fix, stage only the concrete files changed by that fix, commit them as `fix: stabilize Phase 13 Home regressions`, then rerun both `npm run verify` and `npm run test:e2e`. Skip the fix commit when there is no defect.

## PR / Merge Runbook

After all tasks are GREEN:

1. Push `feat/phase13-home-command-center`.
2. Open one PR to `main`: `feat: add Phase 13 Home command center`.
3. PR body summarizes: derived Home model/no migration; weekly summary; max-5 tasks; max-3 news; practice-offer warning; player/school deep-links; preserved pre-match authority; 320/360/390/414/480 validation.
4. Require PR CI jobs `dependency-audit`, `quality`, and `mobile-e2e` all GREEN.
5. Inspect changed filenames and critical diffs; reject temp workflows/artifacts or unrelated refactors.
6. Merge with the current expected feature head SHA.
7. Verify the resulting `main` push workflow, not only the PR workflow.
8. Completion requires all required `main` jobs GREEN.

## Definition of Done

- Home is a weekly command center, not the legacy independent-card collection.
- Week/date, next official objective, strength, condition, and cohesion are immediately readable.
- Task/news ordering is deterministic and capped at 5/3.
- Concern/growth/cohesion/coach-window thresholds match the approved spec.
- No prefectural/national rank appears before Phase 17.
- Incoming practice offer is the only week-advance confirmation condition.
- `今週を進める` is usable and does not overlap bottom navigation.
- Due official/practice matches still go through existing pre-match + server `advance-week`.
- Training-result detail/read behavior still works.
- Concern task can open the relevant player detail.
- School tasks can open facilities/staff without persisted navigation state.
- Existing saves remain schema-compatible.
- Unit/integration tests GREEN.
- `npm run verify` GREEN.
- Playwright E2E GREEN at 320/360/390/414/480.
- PR CI GREEN.
- Merged to `main`.
- `main` push CI GREEN.
