# Phase 13 Home Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current collection-style Home dashboard with a mobile-first weekly coaching command center that derives its summary, tasks, news, and week-advance warning from existing game state while preserving save compatibility and the current authoritative match flow.

**Architecture:** Build a pure `GameState -> HomeCommandCenterModel` selector in `src/features/home/homeCommandCenter.ts`, render that model through a focused `HomeCommandCenter` presentation component, and keep `HomeScreen` as the small React container for notification/warning sheet state. `GameApp` owns navigation and authoritative actions. No new persistence schema, generic notification feed, Worker endpoint, or match simulation path is introduced.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Testing Library, Playwright, Vite, existing Cloudflare Worker game action architecture.

**Spec:** `docs/superpowers/specs/2026-09-08-phase13-home-command-center-design.md`

## Global Constraints

- Start implementation from `docs/phase13-home-command-center-design` and create an isolated feature branch/worktree named `feat/phase13-home-command-center`.
- Do not modify `GameState.schemaVersion` or add persisted Home task/news arrays.
- Do not add a Home-specific Worker endpoint.
- Do not change match simulation authority or temporary pre-match lineup persistence semantics.
- Do not expose private PvP opponent player data.
- Do not reintroduce fatigue management into Home.
- Do not invent prefectural or national rank; that belongs to Phase 17.
- Render at most 5 coaching task cards and 3 coaching news items.
- Player concerns: at most 2 cards; sort severity desc, grade desc, player ID asc.
- Assistant-coach recommendation: academic weeks 1-8 inclusive only when no current-year contract exists.
- Significant growth: newest training result only, `totalAbilityGrowth >= 5`.
- Cohesion news: `abs(cohesion - previousCohesion) >= 3`.
- The only Phase 13 week-advance warning is an unanswered incoming practice-match offer.
- Rename the dominant Home CTA from `次の週へ進む` to `今週を進める`; update all affected tests/copy consistently.
- Supported mobile widths remain 320 / 360 / 390 / 414 / 480 px with no horizontal page overflow.

---

## File Map

### Create

- `src/features/home/homeCommandCenter.ts` — pure Home view-model selector and public Home command types.
- `src/features/home/HomeCommandCenter.tsx` — stateless summary/task/news renderer.
- `src/features/home/home-command-center.css` — Phase 13 Home layout and task/news styling.
- `tests/unit/features/home/homeCommandCenter.test.ts` — pure selector coverage.
- `tests/unit/app/GameApp.homeCommandCenter.test.tsx` — Home command navigation/warning integration.
- `tests/e2e/phase13-home-command-center.spec.ts` — command-center interaction and warning E2E.

### Modify

- `src/features/home/HomeScreen.tsx` — replace inline dashboard derivation with selector + presentation component; own notification and week-warning sheets.
- `src/features/home/home.css` — remove/prune obsolete Home card styles still superseded by Phase 13 layout; retain only shared Home styles still used.
- `src/features/team/PlayerHubScreen.tsx` — optional initial player focus for concern deep-links.
- `src/features/school/SchoolNavigationState.ts` — expose a general school-view request helper while preserving the existing scouting-compatible API.
- `src/app/GameApp.tsx` — pass `gameData`, handle `HomeCommandAction`, preserve existing pre-match/authoritative actions.
- `tests/unit/features/home/HomeScreen.test.tsx` — rewrite expectations around the command-center contract and new CTA copy.
- `tests/unit/features/team/PlayerHubScreen.test.tsx` — verify initial player focus.
- `tests/unit/features/school/SchoolScreen.test.tsx` — verify requested staff/facility view still works after helper generalization.
- `tests/unit/app/GameApp.officialTournament.test.tsx` — use the Phase 13 due-match task / `今週を進める` wording.
- `tests/unit/app/GameAppActions.test.tsx` — update Home CTA wording in existing cloud-action regression tests.
- `tests/e2e/phase9-home-ui.spec.ts` — replace obsolete Home selectors with command-center selectors.
- `tests/e2e/home-match-flow.spec.ts` — update Home CTA/news selectors and preserve pre-match progression coverage.
- `tests/e2e/mobile-layout-audit.spec.ts` — audit the new sticky CTA and command-center layout at all five widths.

### Explicitly do not modify

- `src/domain/model/GameState.ts`
- `src/domain/notifications/gameNotifications.ts` persistence shape
- `worker/game/actionSchema.ts`
- `worker/game/applyServerGameAction.ts`
- `worker/routes/pvpChallenge.ts`

---

# Task 1: Build the pure Home command-center selector

**Files:**

- Create: `src/features/home/homeCommandCenter.ts`
- Create: `tests/unit/features/home/homeCommandCenter.test.ts`

**Interfaces:**

Implement the public presentation contract with these shapes (field naming may be adjusted only if all consumers/tests change together):

```ts
export type HomeCommandPriority =
  | "critical"
  | "attention"
  | "normal"
  | "complete";

export type HomeCommandAction =
  | { target: "team" }
  | { target: "player"; playerId: PlayerId }
  | { target: "school"; view: "facilities" | "staff" }
  | { target: "scouting" }
  | { target: "practice" }
  | { target: "tournament" }
  | { target: "start-week-match" };

export interface HomeOfficialSummary {
  competitionLabel: string;
  detailLabel: string;
  timingLabel: string;
  due: boolean;
}

export interface HomeSummary {
  dateLabel: string;
  weekLabel: string;
  schoolName: string;
  strength: number;
  strengthGrade: string;
  condition: {
    label: string;
    icon: string;
    colorToken: string;
  };
  cohesion: number;
  cohesionTrend: CohesionTrend;
  official: HomeOfficialSummary | null;
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
  | {
      id: string;
      kind: "match";
      title: string;
      detail: string;
    }
  | {
      id: string;
      kind: "cohesion";
      title: string;
      detail: string;
    };

export interface HomeAdvanceState {
  requiresConfirmation: boolean;
  reason: "practice-offer" | null;
}

export interface HomeCommandCenterModel {
  summary: HomeSummary;
  tasks: HomeCommandTask[];
  news: HomeCommandNews[];
  advance: HomeAdvanceState;
}

export interface SelectHomeCommandCenterInput {
  state: GameState;
  data: Pick<GameDataRegistry, "trainingMenus">;
  homeStrength: number;
}

export function selectHomeCommandCenter(
  input: SelectHomeCommandCenterInput,
): HomeCommandCenterModel;
```

The independent `training` route from the design sketch is intentionally not introduced: the current app has no top-level training tab even though `TrainingScreen` exists. The Phase 13 training task uses `{ target: "team" }`, which leads to the existing player/individual-training workflow. Reconnecting the unused standalone Training screen is outside this phase.

- [ ] **RED — add selector tests before implementation.** Use `createDemoGame()` fixtures and explicit state mutations. Cover the fixed thresholds/order with table-driven tests rather than one giant snapshot.

```ts
import { createDemoGame, gameData } from "../../../../src/app/createDemoGame";
import { markWeeklyActionCompleted } from "../../../../src/domain/calendar/weekProgression";
import { matchId, type GameDate } from "../../../../src/domain/model/identifiers";
import type { TrainingResultNotification } from "../../../../src/domain/notifications/gameNotifications";
import { selectHomeCommandCenter } from "../../../../src/features/home/homeCommandCenter";

function select(state = createDemoGame(), homeStrength = 8120) {
  return selectHomeCommandCenter({ state, data: gameData, homeStrength });
}

describe("selectHomeCommandCenter", () => {
  it("builds a weekly summary without inventing a prefectural rank", () => {
    const model = select();
    expect(model.summary.schoolName).toBe("青葉");
    expect(model.summary.strength).toBe(8120);
    expect(JSON.stringify(model.summary)).not.toMatch(/県.*位|全国.*位/);
  });

  it("warns only for an unanswered incoming practice offer", () => {
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

  it("limits player concerns to two and sorts severity, grade, id", () => {
    const state = createDemoGame();
    const ids = state.schools[state.userSchoolId]!.playerIds.slice(0, 3);
    state.teamDynamics.playerConcerns = {
      [ids[0]!]: [{ code: "playing-time", severity: 2 }],
      [ids[1]!]: [{ code: "role-mismatch", severity: 3 }],
      [ids[2]!]: [{ code: "team-slump", severity: 3 }],
    };
    const concerns = select(state).tasks.filter(
      (task) => task.category === "player",
    );
    expect(concerns).toHaveLength(2);
    expect(concerns.every((task) => task.priority === "attention")).toBe(true);
  });

  it.each([1, 8])("recommends an annual coach in week %i", (week) => {
    const state = createDemoGame();
    state.calendar.weekOfYear = week;
    state.schoolManagement.assistantCoach = null;
    expect(select(state).tasks.some((task) => task.category === "staff")).toBe(true);
  });

  it("does not recommend an annual coach after week 8", () => {
    const state = createDemoGame();
    state.calendar.weekOfYear = 9;
    state.schoolManagement.assistantCoach = null;
    expect(select(state).tasks.some((task) => task.category === "staff")).toBe(false);
  });

  it("uses the >=5 weekly growth threshold and the >=3 cohesion threshold", () => {
    const state = createDemoGame();
    const player = state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;
    const notification: TrainingResultNotification = {
      id: "training-threshold",
      type: "training-result",
      createdGameDate: state.date,
      academicYearIndex: state.yearIndex,
      weekOfYear: state.calendar.weekOfYear,
      readAtGameDate: null,
      payload: {
        teamTrainingMenuName: "バランス練習",
        totalAbilityGrowth: 5,
        totalFatigueChange: 0,
        injuredCount: 0,
        players: [{
          playerId: player.id,
          displayName: `${player.lastName} ${player.firstName}`,
          grade: player.grade,
          preferredPosition: player.preferredPosition,
          totalAbilityGrowth: 5,
          fatigueChange: 0,
          conditionChange: 0,
          trustChange: 0,
          injured: false,
          abilityChanges: {},
        }],
      },
    };
    state.notifications.items = [notification];
    state.teamDynamics.previousCohesion = 70;
    state.teamDynamics.cohesion = 73;
    const kinds = select(state).news.map((item) => item.kind);
    expect(kinds).toContain("training-result");
    expect(kinds).toContain("growth");
    expect(kinds).toContain("cohesion");
  });

  it("caps task/news output at 5/3 with deterministic ordering", () => {
    const first = select(createDemoGame());
    const second = select(createDemoGame());
    expect(first.tasks.length).toBeLessThanOrEqual(5);
    expect(first.news.length).toBeLessThanOrEqual(3);
    expect(first.tasks.map((item) => item.id)).toEqual(
      second.tasks.map((item) => item.id),
    );
    expect(first.news.map((item) => item.id)).toEqual(
      second.news.map((item) => item.id),
    );
  });
});
```

Add focused tests in the same file for: future official summary vs due official task, scheduled practice task, configured/completed training, one-vs-multiple injury aggregation, affordable facility aggregation, current-year coach already contracted, latest user-school match outcome, read training notification priority, growth tie by player ID, cohesion delta below 3, and task priority `critical -> attention -> normal -> complete`.

- [ ] Run the new selector test and confirm RED because the module does not exist.

```bash
npm test -- tests/unit/features/home/homeCommandCenter.test.ts
```

Expected: module resolution / missing export failure.

- [ ] **GREEN — implement the pure selector.** Reuse existing selectors/evaluators:

```ts
import { isWeeklyActionCompleted } from "../../domain/calendar/weekProgression";
import { getPlayerConditionPresentation } from "../../domain/player/playerCondition";
import { selectHomeTrainingNotifications } from "../../domain/notifications/gameNotifications";
import { calculateSelectionStrength } from "../../domain/selectors/matchSelectors";
import { schoolStrengthToGrade } from "../../domain/selectors/ratingGrades";
import { FACILITY_DEFINITIONS, evaluateFacilityUpgrade } from "../../domain/school/facilityUpgrade";
import { autoSelectTeam } from "../../domain/team/autoSelectTeam";
import { selectNextOfficialEvent } from "../../domain/tournament/tournamentSelectors";
```

Use internal candidate records with a numeric `sortOrder` and stable `id`; sort by priority weight then `sortOrder` then `id`, then slice to 5. Sort news by fixed priority then ID and slice to 3. Do not mutate `GameState`.

For coach validity, treat a contract from another `yearIndex` as not contracted for the current academic year:

```ts
const currentCoach = state.schoolManagement.assistantCoach;
const hasCurrentCoach = currentCoach?.contractYearIndex === state.yearIndex;
```

For latest match, select only matches involving `state.userSchoolId`, sort by date descending then match ID string ascending, and use persisted display names when the opponent school is missing rather than inventing data.

- [ ] Run selector tests until GREEN.

```bash
npm test -- tests/unit/features/home/homeCommandCenter.test.ts
```

- [ ] Run typecheck for the new public contract.

```bash
npm run typecheck
```

- [ ] Commit Task 1.

```bash
git add src/features/home/homeCommandCenter.ts tests/unit/features/home/homeCommandCenter.test.ts
git commit -m "feat: derive Phase 13 home command model"
```

---

# Task 2: Replace the monolithic Home markup with the command-center UI

**Files:**

- Create: `src/features/home/HomeCommandCenter.tsx`
- Create: `src/features/home/home-command-center.css`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/home.css`
- Modify: `tests/unit/features/home/HomeScreen.test.tsx`

**Interfaces:**

`HomeCommandCenter` is stateless and receives the derived model:

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
```

Reduce `HomeScreenProps` to inputs/actions it truly owns:

```ts
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

`opponent`, `latestMatch`, `trainingCompleted`, and `practiceMatchCompleted` no longer belong in Home props; they are derived from `GameState`.

- [ ] **RED — rewrite `HomeScreen.test.tsx` for the Phase 13 contract.** Preserve tests for the training result sheet, but assert the new hierarchy and copy.

```tsx
it("renders week/objective/team snapshot before coaching tasks", () => {
  const props = createProps();
  render(<HomeScreen {...props} />);

  expect(screen.getByTestId("home-command-summary")).toBeVisible();
  expect(screen.getByRole("heading", { name: /第1週/ })).toBeVisible();
  expect(screen.getByText("今週の監督タスク")).toBeVisible();
  expect(screen.getByRole("button", { name: "今週を進める" })).toBeVisible();
  expect(screen.queryByText(/県\d+位/)).toBeNull();
});

it("renders an incoming practice offer as the two-button exception", () => {
  const props = createProps();
  render(<HomeScreen {...props} />);
  const task = screen.getByRole("region", { name: "練習試合の申し込み" });
  fireEvent.click(within(task).getByRole("button", { name: "受ける" }));
  fireEvent.click(within(task).getByRole("button", { name: "断る" }));
  expect(props.onAcceptPracticeOffer).toHaveBeenCalledOnce();
  expect(props.onDeclinePracticeOffer).toHaveBeenCalledOnce();
});

it("opens the existing training result sheet from coaching news", () => {
  const props = createPropsWithUnreadTrainingResult();
  render(<HomeScreen {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /今週の練習結果/ }));
  expect(screen.getByRole("dialog", { name: "今週の練習結果" })).toBeVisible();
  expect(props.onMarkNotificationRead).toHaveBeenCalledWith("training-unread");
});
```

Also assert: empty task state, no-news omission, task action emits the exact discriminated `HomeCommandAction`, completed task styling does not displace active tasks, and long text remains in truncatable elements rather than creating nested horizontal scrollers.

- [ ] Run Home component tests and confirm RED.

```bash
npm test -- tests/unit/features/home/HomeScreen.test.tsx
```

- [ ] **GREEN — implement `HomeCommandCenter.tsx`.** Render these stable test hooks/classes:

```tsx
<section data-testid="home-command-summary" className="home-command-summary" />
<section aria-labelledby="home-command-tasks-heading" className="home-command-tasks" />
<article data-testid="home-command-task" className="home-command-task" />
<section aria-labelledby="home-command-news-heading" className="home-command-news" />
<button data-testid="home-command-news" />
```

Keep `id="home-week-heading"` on the week heading for existing E2E continuity. Keep `大会表を見る` available from the official summary. Render ordinary tasks with at most one action. Render `practice-offer` with exactly the existing `断る` / `受ける` controls.

- [ ] **GREEN — make `HomeScreen` a thin container.** It should:

1. derive the model with `selectHomeCommandCenter({ state, data, homeStrength })`;
2. own `selectedNotification` state;
3. own `advanceWarningOpen` state;
4. render `HomeCommandCenter`;
5. render existing `TrainingResultNotificationSheet`;
6. render an existing `StickyActionBar` with label `今週を進める`;
7. render an existing `BottomSheet` for the practice-offer warning.

Warning logic:

```ts
const requestAdvance = () => {
  if (model.advance.requiresConfirmation) {
    setAdvanceWarningOpen(true);
    return;
  }
  onAdvanceWeek();
};

const confirmAdvance = () => {
  setAdvanceWarningOpen(false);
  onAdvanceWeek();
};
```

Warning sheet copy must be exactly discoverable by accessible roles:

```tsx
<BottomSheet
  open={advanceWarningOpen}
  title="未回答の申し込みがあります"
  description="練習試合の申し込みが未回答です。このまま次週へ進みますか？"
  onClose={() => setAdvanceWarningOpen(false)}
>
  <button type="button" onClick={() => setAdvanceWarningOpen(false)}>戻る</button>
  <button type="button" onClick={confirmAdvance}>そのまま進む</button>
</BottomSheet>
```

- [ ] **GREEN — add mobile-first CSS.** The top summary uses one compact card; team strength/condition/cohesion stay `repeat(3, minmax(0, 1fr))` even at 320 px. Tasks/news are single-column. Add bottom padding so the sticky action bar never obscures content. No horizontal `overflow-x: auto` is allowed on Home.

The wrapper around `StickyActionBar` must expose a Home-specific selector for E2E:

```tsx
<div className="home-command-advance" data-testid="home-command-advance">
  <StickyActionBar ... />
</div>
```

- [ ] Remove obsolete markup/styles only after new tests are GREEN. Keep `training-result-notification.css` untouched unless a real regression requires it.

- [ ] Run focused Home tests.

```bash
npm test -- tests/unit/features/home/HomeScreen.test.tsx tests/unit/features/home/homeCommandCenter.test.ts
```

- [ ] Run lint/typecheck.

```bash
npm run lint
npm run typecheck
```

- [ ] Commit Task 2.

```bash
git add src/features/home/HomeCommandCenter.tsx src/features/home/HomeScreen.tsx src/features/home/home-command-center.css src/features/home/home.css tests/unit/features/home/HomeScreen.test.tsx
git commit -m "feat: rebuild Home as coaching command center"
```

---

# Task 3: Wire Home commands into existing app navigation without a second router

**Files:**

- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/features/school/SchoolNavigationState.ts`
- Create: `tests/unit/app/GameApp.homeCommandCenter.test.tsx`
- Modify: `tests/unit/features/team/PlayerHubScreen.test.tsx`
- Modify: `tests/unit/features/school/SchoolScreen.test.tsx`
- Modify: `tests/unit/app/GameApp.officialTournament.test.tsx`
- Modify: `tests/unit/app/GameAppActions.test.tsx`

- [ ] **RED — add player deep-link coverage.** Extend `PlayerHubScreenProps` test expectations before implementation:

```tsx
it("opens a requested player detail on first mount", () => {
  const state = createDemoGame();
  const player = state.players[state.schools[state.userSchoolId]!.playerIds[0]!]!;
  const selection = autoSelectTeam({ state, schoolId: state.userSchoolId });

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
    screen.getByRole("heading", { name: `${player.lastName} ${player.firstName}` }),
  ).toBeVisible();
});
```

- [ ] **RED — add Home navigation integration tests** in `GameApp.homeCommandCenter.test.tsx` using the same auth/API fixture style as `GameAppActions.test.tsx`.

Cover these paths explicitly:

```tsx
it("opens a concerned player's detail from Home", () => {
  // arrange one severity-3 concern on a known player
  // click the Home task action labelled "確認"
  // assert that player's heading is visible in PlayerHub
});

it("opens the requested school subsection from Home", () => {
  // arrange an affordable facility and no current coach
  // click "設備を見る" -> School Facilities tab is active
  // return Home, click "スタッフを見る" -> Staff tab is active
});

it("does not advance while the practice-offer warning is awaiting confirmation", () => {
  // initial demo state has an incoming offer
  // click "今週を進める"
  // assert warning dialog visible and applyAction not called
  // click "戻る", still no API call
  // reopen and click "そのまま進む"
  // assert advance-week is submitted exactly once
});
```

For due official integration, update the existing official fixture (`weekOfYear: 9`, `advanceOfficialTournamentsThroughWeek`) and assert the task action itself reaches pre-match:

```tsx
fireEvent.click(screen.getByRole("button", { name: "試合準備" }));
expect(applyAction).not.toHaveBeenCalled();
expect(screen.getByRole("heading", { name: "試合準備" })).toBeVisible();
```

After `この編成で試合開始`, keep the existing assertion that the server receives `advance-week` with `matchSelection`.

- [ ] Run new/updated integration tests and confirm RED.

```bash
npm test -- tests/unit/app/GameApp.homeCommandCenter.test.tsx tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/app/GameApp.officialTournament.test.tsx
```

- [ ] **GREEN — add optional initial player focus.** In `PlayerHubScreen.tsx`:

```ts
interface PlayerHubScreenProps {
  // existing props...
  initialPlayerId?: PlayerId | null;
}

const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(
  initialPlayerId ?? null,
);
```

Do not persist this focus in `GameState`.

- [ ] **GREEN — generalize the school view request helper without breaking scouting.** Preserve backwards compatibility:

```ts
let requestedSchoolView: Exclude<SchoolView, "scouting"> | null = null;

export function requestSchoolView(
  view: Exclude<SchoolView, "scouting">,
): void {
  requestedSchoolView = view;
}

export const requestSchoolViewAfterScouting = requestSchoolView;

export function consumeSchoolViewAfterScouting(): SchoolView {
  return requestedSchoolView ?? "facilities";
}
```

Do not add another persisted navigation field.

- [ ] **GREEN — add `handleHomeCommand` in `GameApp`.** Import `HomeCommandAction` and `requestSchoolView`. Add transient player focus state:

```ts
const [teamInitialPlayerId, setTeamInitialPlayerId] =
  useState<PlayerId | null>(null);

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

Pass `initialPlayerId={teamInitialPlayerId}` when rendering `PlayerHubScreen`.

When the user enters the Team tab through the ordinary bottom navigation, clear `teamInitialPlayerId` so a stale Home deep-link cannot reopen a player later. Keep existing tab-reset semantics for match/scouting state.

Pass Home only the new contract:

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

Remove obsolete Home-only `opponent`, `latestMatch`, `trainingCompleted`, `practiceMatchCompleted`, and direct `onOpenX` props, but retain those values elsewhere in `GameApp` if other screens use them.

- [ ] Update existing copy assertions from `次の週へ進む` to `今週を進める` only where they refer to the Home CTA. Tournament instructional text should also use the new Home CTA wording so UI copy is internally consistent.

- [ ] Run focused app/team/school tests.

```bash
npm test -- \
  tests/unit/app/GameApp.homeCommandCenter.test.tsx \
  tests/unit/app/GameApp.officialTournament.test.tsx \
  tests/unit/app/GameAppActions.test.tsx \
  tests/unit/features/team/PlayerHubScreen.test.tsx \
  tests/unit/features/school/SchoolScreen.test.tsx
```

- [ ] Run full unit suite to catch callback/copy fallout.

```bash
npm test
```

- [ ] Commit Task 3.

```bash
git add src/app/GameApp.tsx src/features/team/PlayerHubScreen.tsx src/features/school/SchoolNavigationState.ts tests/unit/app/GameApp.homeCommandCenter.test.tsx tests/unit/app/GameApp.officialTournament.test.tsx tests/unit/app/GameAppActions.test.tsx tests/unit/features/team/PlayerHubScreen.test.tsx tests/unit/features/school/SchoolScreen.test.tsx
git commit -m "feat: route Home coaching commands"
```

---

# Task 4: Add Phase 13 E2E coverage and migrate legacy Home selectors

**Files:**

- Create: `tests/e2e/phase13-home-command-center.spec.ts`
- Modify: `tests/e2e/phase9-home-ui.spec.ts`
- Modify: `tests/e2e/home-match-flow.spec.ts`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts`

- [ ] **RED — add a dedicated Phase 13 E2E spec.** Initial demo state already exposes an incoming practice offer, so use it to prove the warning path without test-only production hooks.

```ts
import { expect, test } from "@playwright/test";

for (const width of [320, 360, 390, 414, 480]) {
  test(`${width}px Home command center keeps the primary CTA usable`, async ({ page }) => {
    await page.setViewportSize({ width, height: width <= 360 ? 800 : 900 });
    await page.goto("/");

    await expect(page.getByTestId("home-command-summary")).toBeVisible();
    await expect(page.getByText("今週の監督タスク")).toBeVisible();
    await expect(page.getByRole("button", { name: "今週を進める" })).toBeVisible();

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  });
}

test("unanswered practice offer warns before week advance", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "今週を進める" }).click();
  const dialog = page.getByRole("dialog", { name: "未回答の申し込みがあります" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "戻る" }).click();
  await expect(dialog).toHaveCount(0);
});
```

Add one navigation E2E for a visible management task (`設備を見る` or `スタッフを見る`, whichever the demo selector emits first) and assert the School tab/view opens. Do not make E2E depend on a player concern that the default demo may not contain.

- [ ] Run the new spec and confirm RED before migrating old selectors.

```bash
npm run test:e2e -- tests/e2e/phase13-home-command-center.spec.ts
```

- [ ] **GREEN — migrate existing Home E2E selectors/copy.** Required updates:

`phase9-home-ui.spec.ts`
- replace `.home-official-card` with `[data-testid="home-command-summary"]` + accessible official summary text;
- replace `次の週へ進む` with `今週を進める`;
- verify `.home-command-advance` stays above bottom nav.

`home-match-flow.spec.ts`
- keep `#home-week-heading` week-change assertion;
- replace `次の週へ進む` with `今週を進める`;
- after a match, find training news by accessible `今週の練習結果` rather than `.home-notification-list`;
- preserve all five viewport widths and the pre-match -> digest -> result flow.

`mobile-layout-audit.spec.ts`
- replace `.home-next-week-button` with `.home-command-advance`;
- use `今週を進める`;
- keep `expectLayoutFits` at 320/360/390/414/480;
- explicitly call `expectNoHorizontalScroll(page, ".home-screen", ...)` for Home;
- preserve the existing pre-match layout audit and training-result sheet audit.

- [ ] Run the focused E2E set.

```bash
npm run test:e2e -- \
  tests/e2e/phase13-home-command-center.spec.ts \
  tests/e2e/phase9-home-ui.spec.ts \
  tests/e2e/home-match-flow.spec.ts \
  tests/e2e/mobile-layout-audit.spec.ts
```

- [ ] If a layout test fails, fix only the concrete overflow/overlap source. Do not weaken `expectLayoutFits`, remove supported widths, or add horizontal scrolling to hide the issue.

- [ ] Run formatting/lint/type checks after E2E edits.

```bash
npm run format:check
npm run lint
npm run typecheck
```

- [ ] Commit Task 4.

```bash
git add tests/e2e/phase13-home-command-center.spec.ts tests/e2e/phase9-home-ui.spec.ts tests/e2e/home-match-flow.spec.ts tests/e2e/mobile-layout-audit.spec.ts
git commit -m "test: cover Phase 13 Home command center"
```

---

# Task 5: Final regression verification and PR readiness

**Files:** No feature scope expansion. Only fix regressions demonstrated by the commands below.

- [ ] Confirm no unintended persistence/API changes exist.

```bash
git diff docs/phase13-home-command-center-design...HEAD -- \
  src/domain/model/GameState.ts \
  src/domain/notifications/gameNotifications.ts \
  worker/game/actionSchema.ts \
  worker/game/applyServerGameAction.ts \
  worker/routes/pvpChallenge.ts
```

Expected: no diff.

- [ ] Run the repository verification gate.

```bash
npm run verify
```

Expected: formatting, lint, typecheck, unit/integration tests, and production build all GREEN.

- [ ] Run the mobile E2E suite used by CI.

```bash
npm run test:e2e
```

Expected: all Playwright tests GREEN, including 320/360/390/414/480 Home command-center states.

- [ ] Review the final file list for accidental artifacts or unrelated refactors.

```bash
git diff --name-status docs/phase13-home-command-center-design...HEAD
```

Expected feature footprint is limited to the spec/plan plus files listed in this implementation plan.

- [ ] Inspect critical diffs before PR creation:

```bash
git diff docs/phase13-home-command-center-design...HEAD -- \
  src/features/home/homeCommandCenter.ts \
  src/features/home/HomeCommandCenter.tsx \
  src/features/home/HomeScreen.tsx \
  src/app/GameApp.tsx \
  src/features/team/PlayerHubScreen.tsx \
  src/features/school/SchoolNavigationState.ts
```

Check specifically:
- task/news limits and deterministic sorting;
- no invented rank;
- warning only for unanswered practice offer;
- due official action enters existing pre-match before API simulation;
- normal week advance remains available;
- no stale player deep-link on normal Team navigation;
- no horizontal Home scrolling.

- [ ] If verification fixes required code, rerun the smallest failing test first, then rerun `npm run verify` and `npm run test:e2e` before claiming completion. Commit only verified fixes.

```bash
git add <verified-fix-files>
git commit -m "fix: stabilize Phase 13 Home regressions"
```

Skip this commit if no fixes are required.

---

## PR / Merge Runbook

After all tasks are GREEN:

1. Push `feat/phase13-home-command-center`.
2. Open one PR to `main` titled `feat: add Phase 13 Home command center`.
3. PR body must summarize:
   - derived Home view model, no save migration;
   - weekly summary + max-5 coaching tasks + max-3 news;
   - practice-offer advance warning;
   - player/school deep-links;
   - preserved pre-match authoritative flow;
   - mobile widths 320/360/390/414/480.
4. Wait for PR CI: `dependency-audit`, `quality`, `mobile-e2e` all GREEN.
5. Inspect changed filenames and critical diffs; ensure no temp workflows/artifacts.
6. Mark ready if created draft, then merge with the current expected head SHA.
7. Verify the resulting `main` push workflow, not only the PR workflow.
8. Completion requires `main` CI GREEN for all required jobs.

## Definition of Done

Phase 13 is complete only when all are true:

- Home opens as the weekly command center rather than independent legacy cards.
- Week/date, next official objective, strength, condition, and cohesion are readable immediately.
- Task ordering is deterministic and capped at 5.
- News ordering is deterministic and capped at 3.
- Concern / growth / cohesion / coach-window thresholds match the approved spec.
- No prefectural/national rank appears before Phase 17.
- Incoming practice offer is the only week-advance confirmation condition.
- `今週を進める` remains usable and does not overlap bottom navigation.
- Due official/practice simulation still goes through existing pre-match and server-authoritative `advance-week`.
- Existing training-result detail and read-state behavior still works.
- Player concern tasks can open the relevant player detail.
- School management tasks can open facilities/staff without new persisted navigation state.
- Existing saves remain schema-compatible.
- Unit/integration tests GREEN.
- `npm run verify` GREEN.
- Playwright E2E GREEN at 320/360/390/414/480.
- PR CI GREEN.
- `main` merge completed.
- `main` push CI GREEN.
