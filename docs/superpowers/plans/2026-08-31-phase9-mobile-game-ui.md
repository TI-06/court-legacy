# Phase 9 Mobile Game UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the shared shell, Home screen, and official tournament screen as a compact smartphone-management-game UI while preserving all existing game behavior.

**Architecture:** Phase 9 is presentation-only. Shared sizing and touch tokens live in `src/ui/theme/game-theme.css`; Home keeps its existing data/callback contract but recomposes it into fewer dense zones; Tournament keeps the existing selector/domain model and renders each match through a focused one-line row component. Playwright tests define each screen's acceptance before production changes.

**Tech Stack:** React 19, TypeScript 5.9, CSS, Vite 7, Playwright 1.50, Vitest 4

**Spec:** `docs/superpowers/specs/2026-08-31-phase9-mobile-game-ui-design.md`

## Global Constraints

- Do not change game balance, tournament progression, training resolution, match simulation, persistence, API contracts, or weekly progression rules.
- Normal body text: 14px.
- Phase 9-owned shell/Home/Tournament labels and captions: never below 12px.
- Normal touch target: at least 44px. Primary action: at least 48px.
- Bottom navigation label: 12px.
- Home 360x800: `次の週へ進む` must be visible above the fixed navigation without scripted scrolling.
- Home 390x844: the compact official-match summary must be visible in the initial viewport when it exists.
- Tournament round tabs: at least 44px high and 12px text at 320px width.
- Tournament matchup format: one line, `左校 2 - 0 右校` or `左校 VS 右校`.
- Do not render `自校` or `★自校` as tournament text or as a separate row.
- Use tournament entrant `shortName` for the row; keep one line with ellipsis when necessary.
- No horizontal page/panel scrolling at 320, 360, 390, 414, or 480px.
- Preserve existing confirmation sheets, loading states, save status, and official-match execution behavior.

---

## File Map

### Shared shell
- Modify `src/ui/theme/game-theme.css` — Phase 9 tokens, compact header/nav.
- Modify `src/ui/shell/GameHeader.tsx` — school/date/year/week presentation.
- Modify `src/ui/shell/GamePageFrame.tsx` — pass the new progress label.
- Modify `src/app/GameApp.tsx` — supply `就任N年目・N週目`.
- Modify `src/ui/status/operation-status.css` — readable 12px compact save state.

### Home
- Modify `src/features/home/HomeScreen.tsx` — four-zone dashboard.
- Modify `src/features/home/home.css` — compact dashboard styles.
- Modify `src/features/home/home-week.css` — weekly CTA/state styles; preserve `.home-next-week-button`.

### Tournament
- Create `src/features/tournament/TournamentMatchRow.tsx` — single-line matchup renderer.
- Modify `src/features/tournament/TournamentScreen.tsx` — compact header, user-first ordering, inline action.
- Modify `src/features/tournament/tournament.css` — one-line rows and compact layout.

### Tests
- Create `tests/e2e/phase9-shell-ui.spec.ts`.
- Create `tests/e2e/phase9-home-ui.spec.ts`.
- Create `tests/e2e/phase9-tournament-ui.spec.ts`.
- Modify `tests/e2e/mobile-layout-audit.spec.ts`.
- Modify `tests/e2e/home-match-flow.spec.ts`.
- Modify `tests/e2e/app-shell.spec.ts`.
- Modify `tests/e2e/official-tournament-flow.spec.ts`.
- Modify `tests/e2e/official-tournament-continuity.spec.ts`.

---

### Task 1: Define Phase 9 RED acceptance tests

**Files:**
- Create: `tests/e2e/phase9-shell-ui.spec.ts`
- Create: `tests/e2e/phase9-home-ui.spec.ts`
- Create: `tests/e2e/phase9-tournament-ui.spec.ts`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts`

**Interfaces:**
- Production must later provide `data-testid="home-screen"`.
- Production must later provide `data-testid="home-team-status"`.
- Tournament retains `data-testid="tournament-bracket-match"` and adds `data-testid="tournament-match-line"` plus `data-user-match="true|false"`.

- [ ] **Step 1: Write the shell typography/touch test**

`tests/e2e/phase9-shell-ui.spec.ts`:

```ts
import { expect, test, type Locator } from "@playwright/test";

async function fontSize(locator: Locator): Promise<number> {
  return locator.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
}

test("phase9 shell keeps readable labels and compact controls", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  const navItem = page.locator(".bottom-game-nav__item").first();
  const calendar = page.getByRole("button", { name: "予定を確認" });
  const calendarBox = await calendar.boundingBox();

  expect(await fontSize(navItem)).toBeGreaterThanOrEqual(12);
  await expect(page.locator(".game-header__meta")).toContainText("就任");
  expect(await fontSize(page.locator(".game-header__meta"))).toBeGreaterThanOrEqual(12);
  expect(calendarBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(calendarBox?.height ?? 0).toBeGreaterThanOrEqual(44);
});
```

- [ ] **Step 2: Write the Home initial-viewport test**

`tests/e2e/phase9-home-ui.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("phase9 home keeps the weekly CTA in the initial 360x800 viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByTestId("home-team-status")).toBeVisible();

  const nextWeek = page.getByRole("button", { name: "次の週へ進む" });
  const nav = page.getByRole("navigation", { name: "主要メニュー" });
  const nextWeekBox = await nextWeek.boundingBox();
  const navBox = await nav.boundingBox();

  expect(nextWeekBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect((nextWeekBox?.y ?? 0) + (nextWeekBox?.height ?? 0)).toBeLessThanOrEqual(
    navBox?.y ?? 0,
  );
});

test("phase9 home exposes official summary in the initial 390x844 viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const official = page.locator(".home-official-card");
  await expect(official).toBeVisible();
  const officialBox = await official.boundingBox();
  const navBox = await page
    .getByRole("navigation", { name: "主要メニュー" })
    .boundingBox();

  expect(officialBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(officialBox?.y ?? 9999).toBeLessThan(navBox?.y ?? 0);
});
```

- [ ] **Step 3: Write the tournament one-line-row test**

`tests/e2e/phase9-tournament-ui.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("phase9 tournament uses one horizontal line per match and no self label", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "大会表を見る" }).click();

  const lines = page.getByTestId("tournament-match-line");
  await expect(lines).toHaveCount(8);
  await expect(page.getByText("自校", { exact: true })).toHaveCount(0);

  const first = lines.first();
  const leftBox = await first
    .locator(".tournament-match-row__school--home")
    .boundingBox();
  const centerBox = await first
    .locator(".tournament-match-row__center")
    .boundingBox();
  const rightBox = await first
    .locator(".tournament-match-row__school--away")
    .boundingBox();

  expect(leftBox).not.toBeNull();
  expect(centerBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  expect(Math.abs((leftBox?.y ?? 0) - (centerBox?.y ?? 0))).toBeLessThan(8);
  expect(Math.abs((rightBox?.y ?? 0) - (centerBox?.y ?? 0))).toBeLessThan(8);
});
```

- [ ] **Step 4: Strengthen the existing mobile audit**

In `tests/e2e/mobile-layout-audit.spec.ts`, delete the 414px-only `scrollIntoView` workaround. For 360, 390, and 414 widths call `expectAboveNavigation(page, ".home-next-week-button", ...)` immediately after initial Home load.

- [ ] **Step 5: Run RED**

```bash
npx playwright test tests/e2e/phase9-shell-ui.spec.ts tests/e2e/phase9-home-ui.spec.ts tests/e2e/phase9-tournament-ui.spec.ts tests/e2e/mobile-layout-audit.spec.ts --project=mobile-chromium
```

Expected: FAIL because Phase 9 hooks/layouts do not exist and the weekly CTA currently requires scrolling.

- [ ] **Step 6: Commit tests**

```bash
git add tests/e2e/phase9-shell-ui.spec.ts tests/e2e/phase9-home-ui.spec.ts tests/e2e/phase9-tournament-ui.spec.ts tests/e2e/mobile-layout-audit.spec.ts
git commit -m "test: define phase9 mobile UI acceptance"
```

---

### Task 2: Compact the shared mobile shell

**Files:**
- Modify: `src/ui/theme/game-theme.css`
- Modify: `src/ui/shell/GameHeader.tsx`
- Modify: `src/ui/shell/GamePageFrame.tsx`
- Modify: `src/app/GameApp.tsx`
- Modify: `src/ui/status/operation-status.css`
- Test: `tests/e2e/phase9-shell-ui.spec.ts`

**Interfaces:**
- Replace `GameHeaderProps.reputationLabel` with `progressLabel: string`.
- Replace `GamePageFrameProps.reputationLabel` with `progressLabel: string`.
- `GameApp` supplies `progressLabel={`就任${gameState.yearIndex}年目・${gameState.calendar.weekOfYear}週目`}`.

- [ ] **Step 1: Add shared Phase 9 tokens**

Add to `:root` in `game-theme.css`:

```css
--game-font-screen-title: 22px;
--game-font-card-title: 18px;
--game-font-heading: 16px;
--game-font-body: 14px;
--game-font-label: 12px;
--game-font-caption: 12px;
--game-font-button: 14px;
--game-space-xs: 4px;
--game-space-sm: 8px;
--game-space-md: 12px;
--game-space-lg: 16px;
--game-radius-sm: 10px;
--game-radius-card: 14px;
--game-touch: 44px;
--game-touch-primary: 48px;
--game-nav-height: 62px;
```

Do not apply these globally to Team/Training in Phase 9; only shell/Home/Tournament selectors are in scope.

- [ ] **Step 2: Change the header data contract**

`GameHeader.tsx` metadata:

```tsx
<div className="game-header__meta">
  <span>{dateLabel}</span>
  <span>{progressLabel}</span>
</div>
```

Update `GamePageFrame` props/passthrough accordingly. In `GameApp.tsx` pass:

```tsx
progressLabel={`就任${gameState.yearIndex}年目・${gameState.calendar.weekOfYear}週目`}
```

Remove `reputationLabels` from `GameApp.tsx` after confirming it has no remaining consumer.

- [ ] **Step 3: Compact header/navigation CSS without shrinking below the floor**

Use actual current markup classes (`.game-header__identity`, `.game-header__meta`, `.game-header__actions`). Core rules:

```css
.game-header {
  min-height: 60px;
  padding: max(8px, env(safe-area-inset-top)) 12px 8px;
}

.game-header__identity > p {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
}

.game-header__meta {
  display: flex;
  gap: var(--game-space-sm);
  margin-top: 2px;
  color: var(--game-text-muted);
  font-size: var(--game-font-caption);
}

.game-header__action {
  width: var(--game-touch);
  height: var(--game-touch);
}

.bottom-game-nav__item {
  min-height: 52px;
  font-size: var(--game-font-label);
}
```

Delete <=350px rules that reduce nav labels below 12px or calendar touch size below 44px.

- [ ] **Step 4: Keep operation status at 12px**

In `operation-status.css`, set `.operation-status { font-size: 12px; }`. Keep retry usable with a minimum 44px button height while normal `保存済み ✓` remains visually compact.

- [ ] **Step 5: Run and verify GREEN**

```bash
npx playwright test tests/e2e/phase9-shell-ui.spec.ts --project=mobile-chromium
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/theme/game-theme.css src/ui/shell/GameHeader.tsx src/ui/shell/GamePageFrame.tsx src/app/GameApp.tsx src/ui/status/operation-status.css
git commit -m "feat: compact phase9 mobile game shell"
```

---

### Task 3: Rebuild Home as the compact four-zone dashboard

**Files:**
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/home.css`
- Modify: `src/features/home/home-week.css`
- Modify: `tests/e2e/home-match-flow.spec.ts`
- Modify: `tests/e2e/app-shell.spec.ts`
- Modify: `tests/e2e/official-tournament-continuity.spec.ts`
- Test: `tests/e2e/phase9-home-ui.spec.ts`
- Test: `tests/e2e/mobile-layout-audit.spec.ts`

**Interfaces:**
- Keep all existing `HomeScreenProps` inputs/callbacks.
- Root emits `data-testid="home-screen"`.
- Team strip emits `data-testid="home-team-status"`.
- Preserve `.home-next-week-button`.
- Preserve the accessible `大会表を見る` button name.

- [ ] **Step 1: Replace seven vertical sections with four zones**

Root:

```tsx
<main className="app-content home-screen" data-testid="home-screen">
```

Render only:
1. `.home-week-card`
2. `.home-team-status`
3. `.home-official-card` when `nextOfficial` exists
4. `.home-recent-status` only when a recent result or actionable alert exists

Delete the separate `監督ホーム` hero, action-list section, week-progress section, and verbose healthy-state report blocks.

- [ ] **Step 2: Build the week card with precise existing state**

Use the authoritative weekly plan as the training state. `GameState.weeklySchedule.trainingPlan` always represents the saved plan for the current week, so do not invent a new saved/unsaved domain flag.

```ts
const trainingStatus = trainingCompleted ? "完了 ✓" : "設定済";
const practiceStatus = practiceMatchCompleted
  ? "完了 ✓"
  : state.weeklySchedule.practiceMatch.scheduledOpponentId
    ? "対戦決定"
    : "未決定";
```

The week card contains opponent, strength, both status labels, three quick actions, and the weekly CTA. Preserve existing callback behavior and disable only the practice action when `practiceMatchCompleted` is true.

- [ ] **Step 3: Build the four-metric status strip**

Render four real items: 評判, 疲労, 部員, 結束. Each item contains a 12px label, 20px value, and 12px caption. At >=360px use four columns; at 320px use 2x2.

- [ ] **Step 4: Compact the official card**

Upcoming state: show timing, tournament, round/opponent, and `大会表を見る` in roughly 80-100px. Due state may expand enough to make the CTA prominent. Remove repeated prose.

- [ ] **Step 5: Collapse result/alerts**

Show at most one recent-match line and one alert line. Show the alert only when `injuredCount > 0 || fatigueWarningCount > 0`. Do not repeat healthy-state prose already represented by metrics.

- [ ] **Step 6: Apply Phase 9 Home CSS**

Use 8px main grid gap and 12-14px card padding. No `font-size` below 12px in `home.css` or `home-week.css`. Primary weekly CTA remains 48px+. At 320px rearrange the status strip rather than shrinking text.

- [ ] **Step 7: Update stale Home E2E selectors**

In `home-match-flow.spec.ts`, `app-shell.spec.ts`, and `official-tournament-continuity.spec.ts`, replace `監督ホーム` heading assertions with:

```ts
await expect(page.getByTestId("home-screen")).toBeVisible();
```

For the Home practice action use:

```ts
await page
  .locator(".home-week-card")
  .getByRole("button", { name: "試合", exact: true })
  .click();
```

- [ ] **Step 8: Run and verify Home GREEN**

```bash
npx playwright test tests/e2e/phase9-home-ui.spec.ts tests/e2e/home-match-flow.spec.ts tests/e2e/app-shell.spec.ts tests/e2e/official-tournament-continuity.spec.ts tests/e2e/mobile-layout-audit.spec.ts --project=mobile-chromium
```

Expected: Home tests and mobile audit pass. If the audit reaches Tournament and fails only on the not-yet-implemented row layout, run the Home-specific tests plus the audit with `--grep "home"` and record the Tournament failure for Task 4; do not weaken Home assertions.

- [ ] **Step 9: Commit**

```bash
git add src/features/home/HomeScreen.tsx src/features/home/home.css src/features/home/home-week.css tests/e2e/home-match-flow.spec.ts tests/e2e/app-shell.spec.ts tests/e2e/official-tournament-continuity.spec.ts
git commit -m "feat: rebuild home as compact game dashboard"
```

---

### Task 4: Convert tournament matches to single-line rows

**Files:**
- Create: `src/features/tournament/TournamentMatchRow.tsx`
- Modify: `src/features/tournament/TournamentScreen.tsx`
- Modify: `src/features/tournament/tournament.css`
- Modify: `tests/e2e/official-tournament-flow.spec.ts`
- Test: `tests/e2e/phase9-tournament-ui.spec.ts`
- Test: `tests/e2e/mobile-layout-audit.spec.ts`

**Interfaces:**

`TournamentMatchRow.tsx` exports:

```ts
interface TournamentMatchRowProps {
  match: TournamentBracketMatchView;
  userEntrantId: string | null;
  action: ReactNode | null;
}

export function TournamentMatchRow(props: TournamentMatchRowProps): JSX.Element;
```

- Article keeps `data-testid="tournament-bracket-match"`.
- Horizontal line adds `data-testid="tournament-match-line"`.
- Article adds `data-user-match={match.userInMatch ? "true" : "false"}`.

- [ ] **Step 1: Put the user's match first within the selected round**

```ts
const visibleMatches = stage.matches
  .filter((match) => match.round === selectedRound)
  .sort((left, right) => Number(right.userInMatch) - Number(left.userInMatch));
```

This is display-only and must not mutate tournament state.

- [ ] **Step 2: Implement the focused one-line renderer**

Determine user side with entrant IDs:

```ts
const userIsHome = match.home?.entrantId === userEntrantId;
const userIsAway = match.away?.entrantId === userEntrantId;
const center =
  match.homeSetsWon === null || match.awaySetsWon === null
    ? "VS"
    : `${match.homeSetsWon} - ${match.awaySetsWon}`;
```

Render exactly three columns: left `shortName`, center score/VS, right `shortName`. Set `title` to each entrant's full `displayName`. Apply `.is-user` only to the matching school side. Do not render `自校` or `tournament-user-marker`.

- [ ] **Step 3: Move the official action into the current user match article**

In `TournamentScreen`, build `action` only for the selected/current user match. Reuse the existing rules:
- due + training incomplete: blocking note and disabled `公式戦を開始`.
- due + training complete + not pending: enabled `公式戦を開始`.
- pending: existing progress status.

Delete the standalone `.tournament-action` block so opponent/timing is not duplicated below the bracket.

- [ ] **Step 4: Compact tournament header and current-position strip**

Use one header row with a 44px back control and 18px tournament title; keep `aria-label="試合メニューへ戻る"`. Below it show `現在` and `次戦` in a compact strip. Remove the old separate back-text row and large next-card blocks.

- [ ] **Step 5: Implement the row CSS**

```css
.tournament-match-row__line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px minmax(0, 1fr);
  align-items: center;
  min-height: 52px;
  gap: 8px;
}

.tournament-match-row__school {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-match-row__school--away {
  text-align: right;
}

.tournament-match-row__school.is-user {
  color: var(--game-accent);
  font-weight: 900;
}

.tournament-match-row__center {
  font-size: 18px;
  font-weight: 900;
  text-align: center;
  white-space: nowrap;
}
```

At 320px reduce gaps/padding only. Do not reduce school text below 14px or center text below 12px.

- [ ] **Step 6: Keep round tabs readable at every width**

Use `min-height: var(--game-touch)` and `font-size: var(--game-font-label)`. Remove the current <=360px rule that shrinks tabs to `0.67rem`.

- [ ] **Step 7: Update official tournament flow test**

Keep existing 8/4 match-count and round-tab checks. Replace marker expectations with:

```ts
await expect(page.getByText("自校", { exact: true })).toHaveCount(0);
await expect(page.getByTestId("tournament-match-line")).toHaveCount(8);
```

For the due-match CTA scope to:

```ts
const userMatch = page.locator('[data-user-match="true"]');
await expect(userMatch.getByRole("button", { name: "公式戦を開始" })).toBeDisabled();
```

Keep the existing confirmation and persistence assertions unchanged.

- [ ] **Step 8: Run and verify GREEN**

```bash
npx playwright test tests/e2e/phase9-tournament-ui.spec.ts tests/e2e/official-tournament-flow.spec.ts tests/e2e/official-tournament-continuity.spec.ts tests/e2e/mobile-layout-audit.spec.ts --project=mobile-chromium
npm run typecheck
```

Expected: PASS at 320/360/390/414/480 with no horizontal overflow.

- [ ] **Step 9: Commit**

```bash
git add src/features/tournament/TournamentMatchRow.tsx src/features/tournament/TournamentScreen.tsx src/features/tournament/tournament.css tests/e2e/official-tournament-flow.spec.ts
git commit -m "feat: compact official tournament match rows"
```

---

### Task 5: Align the remaining known E2E contracts

**Files:**
- Modify: `tests/e2e/home-match-flow.spec.ts`
- Modify: `tests/e2e/app-shell.spec.ts`
- Modify: `tests/e2e/official-tournament-flow.spec.ts`
- Modify: `tests/e2e/official-tournament-continuity.spec.ts`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts`
- Modify additional `tests/e2e/*.spec.ts` only when a full-suite failure proves it still references removed Phase 9 copy/markup.

**Interfaces:**
- Home identity: `data-testid="home-screen"`.
- Home practice action: `.home-week-card` scoped `試合` button.
- Tournament match: `data-testid="tournament-bracket-match"`.
- Tournament line: `data-testid="tournament-match-line"`.
- User match: `data-user-match="true"`.

- [ ] **Step 1: Run full E2E**

```bash
npm run test:e2e
```

- [ ] **Step 2: Classify each failure before editing**

Classify as stale approved-UI expectation, layout regression, or behavior regression. Only stale approved-UI expectations are fixed test-only. Layout/behavior regressions require production fixes plus focused reruns.

- [ ] **Step 3: Find remaining removed copy/hooks**

```bash
rg '監督ホーム|練習試合へ|tournament-user-path' tests/e2e
```

Replace only proven stale references using the interfaces above. Do not weaken score, revision, persistence, confirmation, or navigation assertions.

- [ ] **Step 4: Run full E2E again**

```bash
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 5: Commit alignment**

```bash
git add tests/e2e
git commit -m "test: align e2e with phase9 mobile UI"
```

---

### Task 6: Final quality and merge verification

**Files:**
- Modify only if a verification failure proves a concrete issue.

**Interfaces:**
- Completion requires local/static checks, all unit tests, all Playwright E2E, CI GREEN, and post-merge `main` GREEN.

- [ ] **Step 1: Format**

```bash
npm run format:check
```

If it fails, run `npm run format`, inspect the diff, then rerun `npm run format:check`.

- [ ] **Step 2: Static quality**

```bash
npm run lint
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Unit tests**

```bash
npm test
```

Expected: PASS with no domain-test behavior changes.

- [ ] **Step 4: Production build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Full E2E**

```bash
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 6: Explicit Phase 9 mobile audit**

```bash
npx playwright test tests/e2e/phase9-shell-ui.spec.ts tests/e2e/phase9-home-ui.spec.ts tests/e2e/phase9-tournament-ui.spec.ts tests/e2e/mobile-layout-audit.spec.ts tests/e2e/official-tournament-flow.spec.ts --project=mobile-chromium
```

Expected: PASS; no page/tournament horizontal overflow; 360x800 weekly CTA is initially visible; one-line tournament rows remain intact at 320px.

- [ ] **Step 7: Review production diff**

```bash
git diff main...HEAD -- src/ui/theme/game-theme.css src/ui/shell src/ui/status src/features/home src/features/tournament tests/e2e
```

Confirm all of the following before PR:
- Phase 9 shell/Home/Tournament owned text is 12px+.
- No tournament `自校`/`★自校` label exists.
- Match rows are left school / score-or-VS / right school.
- Only the user's school side gets self emphasis.
- The duplicate standalone tournament next-match action card is gone.
- Domain/API/persistence code is unchanged except the presentation props required by the shell.

- [ ] **Step 8: Commit any final formatting-only diff**

```bash
git status --short
```

If there are verified formatting-only changes:

```bash
git add -A
git commit -m "style: finalize phase9 mobile UI"
```

If clean, do not create an empty commit.

- [ ] **Step 9: Push, PR, CI, merge, post-merge verification**

Push `feature/phase9-mobile-game-ui`, open/update the Phase 9 PR, require repository Quality and mobile E2E checks to be GREEN, merge only after both are GREEN, then verify the `main` push workflow is GREEN before declaring Phase 9 complete.
