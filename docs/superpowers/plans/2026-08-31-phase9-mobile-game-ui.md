# Phase 9 Mobile Game UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the shared mobile shell, Home screen, and official tournament screen so Court Legacy behaves like a compact smartphone management game: readable 12px+ typography, primary actions visible without unnecessary scrolling, and tournament matches shown as single-line `A 2 - 0 B` rows.

**Architecture:** Keep all game/domain behavior unchanged. Phase 9 is a presentation-layer refactor: shared sizing/touch tokens live in `game-theme.css`, Home composes its existing data into fewer dense zones, and Tournament renders the existing `TournamentBracketMatchView` data through a focused single-line row component. Playwright tests define viewport, typography, navigation, and interaction acceptance before each UI change.

**Tech Stack:** React 19, TypeScript 5.9, CSS, Vite 7, Playwright 1.50, Vitest 4

**Spec:** `docs/superpowers/specs/2026-08-31-phase9-mobile-game-ui-design.md`

## Global Constraints

- No game-balance, tournament progression, training, match, persistence, or API behavior changes.
- Body text uses 14px as the normal baseline.
- No Phase 9 Home/Tournament/shared-shell text may render below 12px.
- Normal touch controls are at least 44px; primary actions are at least 48px.
- Bottom navigation labels are 12px.
- Home at 360x800 must show `次の週へ進む` above the fixed bottom navigation without scrolling.
- Home at 390x844 should expose the official-match summary in the initial viewport.
- Tournament round tabs remain 44px minimum height and 12px text at 320px width.
- Tournament matches use one horizontal row: left school / score or VS / right school.
- Do not render `自校` or `★自校` as a separate tournament row/label. Highlight only through typography/color/background/accent.
- Use `shortName` in tournament rows and keep every row on one line with ellipsis when required.
- No horizontal page or tournament-panel scrolling at 320, 360, 390, 414, or 480px.
- Existing confirmation, loading, save, and official-match start behavior must continue to work.

---

## File Structure

### Shared shell

- Modify `src/ui/theme/game-theme.css` — shared Phase 9 typography/spacing/touch tokens, compact sticky header, compact bottom navigation.
- Modify `src/ui/shell/GameHeader.tsx` — present date plus year/week context in the compact header.
- Modify `src/ui/shell/GamePageFrame.tsx` — replace reputation-only secondary context with the explicit season progress label required by Phase 9.
- Modify `src/app/GameApp.tsx` — provide `就任N年目・N週目` to the shell.
- Modify `src/ui/status/operation-status.css` — keep save/retry status readable at the 12px minimum without increasing header height.

### Home

- Modify `src/features/home/HomeScreen.tsx` — collapse seven vertical blocks into the week card, team-status strip, official summary, and compact recent/alert block.
- Modify `src/features/home/home.css` — compact Home layout and typography.
- Modify `src/features/home/home-week.css` — merge week progression styling into the main week card while preserving `.home-next-week-button`.

### Tournament

- Create `src/features/tournament/TournamentMatchRow.tsx` — one focused renderer for a single match row and optional inline official-match action state.
- Modify `src/features/tournament/TournamentScreen.tsx` — compact header/current strip, self-first sorting, row rendering, and removal of duplicate bottom action card.
- Modify `src/features/tournament/tournament.css` — one-line match grid and compact tournament layout.

### Tests

- Create `tests/e2e/phase9-mobile-ui.spec.ts` — explicit Phase 9 acceptance tests.
- Modify `tests/e2e/mobile-layout-audit.spec.ts` — enforce initial-view Home acceptance without manual scroll and tournament no-overflow behavior at all five widths.
- Modify `tests/e2e/home-match-flow.spec.ts` — stop depending on removed `監督ホーム` heading.
- Modify `tests/e2e/app-shell.spec.ts` — stop depending on removed Home heading and verify compact shell context.
- Modify `tests/e2e/official-tournament-flow.spec.ts` — verify single-line rows, no user-marker label, round tabs, and inline official CTA.
- Modify `tests/e2e/official-tournament-continuity.spec.ts` — replace removed Home-heading assertions while preserving tournament continuity coverage.

---

### Task 1: Add Phase 9 acceptance tests and prove RED

**Files:**
- Create: `tests/e2e/phase9-mobile-ui.spec.ts`
- Modify: `tests/e2e/mobile-layout-audit.spec.ts`

**Interfaces:**
- Consumes: existing `data-testid="tournament-bracket-match"`, `.home-next-week-button`, fixed `navigation[aria-label="主要メニュー"]`.
- Produces: stable Phase 9 test hooks `data-testid="home-screen"`, `data-testid="home-team-status"`, `data-testid="tournament-match-line"`, `data-user-match="true|false"` that implementation tasks must provide.

- [ ] **Step 1: Write the failing Home initial-viewport test**

Create `tests/e2e/phase9-mobile-ui.spec.ts` with helpers that compare element bounding boxes and computed font sizes. The Home test must use the actual viewport, without calling `scrollIntoView`:

```ts
import { expect, test, type Locator } from "@playwright/test";

async function fontSize(locator: Locator): Promise<number> {
  return locator.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
}

test("phase9 home keeps the weekly CTA in the initial 360x800 viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("home-screen")).toBeVisible();
  const nextWeek = page.getByRole("button", { name: "次の週へ進む" });
  const nav = page.getByRole("navigation", { name: "主要メニュー" });
  const nextWeekBox = await nextWeek.boundingBox();
  const navBox = await nav.boundingBox();

  expect(nextWeekBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect((nextWeekBox?.y ?? 0) + (nextWeekBox?.height ?? 0)).toBeLessThanOrEqual(
    navBox?.y ?? 0,
  );

  await expect(page.getByTestId("home-team-status")).toBeVisible();
});
```

- [ ] **Step 2: Add the Phase 9 typography floor test**

Add assertions for the selectors Phase 9 owns. Do not scan legacy Team/Training text in this phase:

```ts
test("phase9 shell home and tournament owned labels stay at 12px or larger", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  for (const selector of [
    ".bottom-game-nav__item",
    ".game-header__meta",
    ".home-week-card__label",
    ".home-team-status__label",
  ]) {
    expect(await fontSize(page.locator(selector).first()), selector).toBeGreaterThanOrEqual(12);
  }

  await page.getByRole("button", { name: "大会表を見る" }).click();
  for (const selector of [
    ".tournament-round-tabs button",
    ".tournament-match-row__school",
    ".tournament-match-row__center",
  ]) {
    expect(await fontSize(page.locator(selector).first()), selector).toBeGreaterThanOrEqual(12);
  }
});
```

- [ ] **Step 3: Add the tournament single-line-row test**

```ts
test("phase9 tournament renders each match as one horizontal row", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "大会表を見る" }).click();

  const rows = page.getByTestId("tournament-match-line");
  await expect(rows).toHaveCount(8);
  await expect(page.getByTestId("tournament-user-path")).toHaveCount(0);

  const first = rows.first();
  const left = first.locator(".tournament-match-row__school--home");
  const center = first.locator(".tournament-match-row__center");
  const right = first.locator(".tournament-match-row__school--away");
  const [leftBox, centerBox, rightBox] = await Promise.all([
    left.boundingBox(),
    center.boundingBox(),
    right.boundingBox(),
  ]);

  expect(leftBox).not.toBeNull();
  expect(centerBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  expect(Math.abs((leftBox?.y ?? 0) - (centerBox?.y ?? 0))).toBeLessThan(8);
  expect(Math.abs((rightBox?.y ?? 0) - (centerBox?.y ?? 0))).toBeLessThan(8);
});
```

- [ ] **Step 4: Strengthen `mobile-layout-audit.spec.ts`**

Remove the current 414px-only `scrollIntoView` workaround for `.home-next-week-button`. At 360, 390, and 414 widths, call `expectAboveNavigation` directly after initial Home load. Keep the existing overflow inspector at all five widths.

- [ ] **Step 5: Run the new tests and verify RED**

Run:

```bash
npx playwright test tests/e2e/phase9-mobile-ui.spec.ts tests/e2e/mobile-layout-audit.spec.ts --project=mobile-chromium
```

Expected: FAIL because the Phase 9 hooks/classes do not yet exist and Home requires scrolling to reach the weekly CTA.

- [ ] **Step 6: Commit the RED tests**

```bash
git add tests/e2e/phase9-mobile-ui.spec.ts tests/e2e/mobile-layout-audit.spec.ts
git commit -m "test: define phase9 mobile UI acceptance"
```

---

### Task 2: Add shared mobile-game tokens and compact shell

**Files:**
- Modify: `src/ui/theme/game-theme.css`
- Modify: `src/ui/shell/GameHeader.tsx`
- Modify: `src/ui/shell/GamePageFrame.tsx`
- Modify: `src/app/GameApp.tsx`
- Modify: `src/ui/status/operation-status.css`
- Test: `tests/e2e/phase9-mobile-ui.spec.ts`
- Test: `tests/e2e/app-shell.spec.ts`

**Interfaces:**
- Produces `GameHeaderProps.progressLabel: string`.
- `GamePageFrame` consumes `progressLabel` and passes it to `GameHeader`.
- `GameApp` supplies `progressLabel={`${gameState.yearIndex}年目・${gameState.calendar.weekOfYear}週目`}`.

- [ ] **Step 1: Add shared Phase 9 CSS tokens**

At `:root` in `game-theme.css`, add:

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

Do not globally override all legacy feature typography. Apply the tokens only to the shell and Phase 9 Home/Tournament selectors.

- [ ] **Step 2: Change the header data contract**

Replace `reputationLabel` in `GameHeaderProps` / `GamePageFrameProps` with `progressLabel`. Keep `dateLabel` and operation status.

Expected header metadata:

```tsx
<div className="game-header__meta">
  <span>{dateLabel}</span>
  <span>{progressLabel}</span>
</div>
```

In `GameApp.tsx`:

```tsx
progressLabel={`就任${gameState.yearIndex}年目・${gameState.calendar.weekOfYear}週目`}
```

Remove the now-unused local `reputationLabels` map from `GameApp.tsx` if no other reference remains.

- [ ] **Step 3: Compact the shell CSS**

Set the header target to 58-64px excluding safe-area growth, retain 44px calendar touch target, set metadata and operation status to 12px, and set bottom-nav labels to 12px. At <=350px do not shrink header button or nav text below the global floor.

Key rules:

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

- [ ] **Step 4: Keep operation status compact and readable**

Update `operation-status.css` so `.operation-status` uses `font-size: 12px`, does not force a 32px+ visual block, and retry controls still have a 44px effective touch target when present.

- [ ] **Step 5: Run focused tests**

```bash
npx playwright test tests/e2e/phase9-mobile-ui.spec.ts tests/e2e/app-shell.spec.ts --project=mobile-chromium
npm run typecheck
```

Expected: typography-floor assertions for shared shell pass; Home/Tournament layout assertions may remain RED until Tasks 3-4.

- [ ] **Step 6: Commit**

```bash
git add src/ui/theme/game-theme.css src/ui/shell/GameHeader.tsx src/ui/shell/GamePageFrame.tsx src/app/GameApp.tsx src/ui/status/operation-status.css tests/e2e/app-shell.spec.ts
git commit -m "feat: compact phase9 mobile game shell"
```

---

### Task 3: Rebuild Home into a four-zone game dashboard

**Files:**
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/home.css`
- Modify: `src/features/home/home-week.css`
- Modify: `tests/e2e/home-match-flow.spec.ts`
- Modify: `tests/e2e/app-shell.spec.ts`
- Modify: `tests/e2e/official-tournament-continuity.spec.ts`
- Test: `tests/e2e/phase9-mobile-ui.spec.ts`
- Test: `tests/e2e/mobile-layout-audit.spec.ts`

**Interfaces:**
- Preserve all existing `HomeScreenProps` callbacks and state inputs.
- Preserve `.home-next-week-button` for stable automation.
- Produce `data-testid="home-screen"` on the root and `data-testid="home-team-status"` on the status strip.

- [ ] **Step 1: Replace the Home markup with the compact zones**

Root:

```tsx
<main className="app-content home-screen" data-testid="home-screen">
```

Zone order:

1. `.home-week-card`
2. `.home-team-status`
3. compact `.home-official-card` when `nextOfficial` exists
4. `.home-recent-status` only when there is a recent result or actionable injury/fatigue alert

Remove the standalone `監督ホーム` hero, standalone action-list section, standalone week-progress section, and verbose report cards.

- [ ] **Step 2: Build the week card**

The week card must contain opponent, strength, training state, practice-match state, three quick actions, and `.home-next-week-button`:

```tsx
<section className="home-week-card" aria-labelledby="home-week-heading">
  <div className="home-week-card__top">
    <div>
      <span className="home-week-card__label">今週</span>
      <h2 id="home-week-heading">練習試合</h2>
    </div>
    <span className="home-week-card__strength">戦力 {homeStrength}</span>
  </div>
  <strong className="home-week-card__opponent">{opponent.name}</strong>
  <div className="home-week-card__states">
    <span>練習 {trainingCompleted ? "完了 ✓" : "設定待ち"}</span>
    <span>試合 {practiceMatchCompleted ? "完了 ✓" : "未実施"}</span>
  </div>
  <div className="home-week-card__actions">
    <button onClick={onOpenTraining} type="button">育成</button>
    <button onClick={onOpenTeam} type="button">編成</button>
    <button disabled={practiceMatchCompleted} onClick={onOpenMatch} type="button">試合</button>
  </div>
  <button className="home-next-week-button" onClick={onAdvanceWeek} type="button">
    次の週へ進む
  </button>
</section>
```

Keep behavior equivalent to existing buttons; only presentation/copy is simplified.

- [ ] **Step 3: Build the four-column team-status strip**

At >=360px use four columns. At 320px switch to 2x2. Each item uses 12px label/caption and 20px value.

```tsx
<section className="home-team-status" data-testid="home-team-status" aria-label="チーム状況">
  <article>
    <span className="home-team-status__label">評判</span>
    <strong>{school.reputationPoints}</strong>
    <small>{reputationLabels[school.reputation]}</small>
  </article>
  ...
</section>
```

- [ ] **Step 4: Compact the official-match card**

Keep the existing `大会表を見る` accessible button name so other flows continue to find it. Do not repeat explanatory text. For due matches, strengthen the CTA visually; for upcoming matches, fit the tournament name, timing, round/opponent, and button in roughly 80-100px.

- [ ] **Step 5: Collapse recent result and alerts**

Render at most one recent-result line plus one alert line. Only show the alert when `injuredCount > 0 || fatigueWarningCount > 0`. Do not repeat `平均疲労`, `怪我なし`, or other healthy-state prose already visible in the status strip.

- [ ] **Step 6: Implement Home CSS density**

Use `gap: 8px` for the Home grid, 12-14px card padding, 14px body, 12px labels/captions, and 48px primary weekly button. Do not use `font-size` below 12px in `home.css` or `home-week.css`.

The 360x800 initial viewport test must pass without a scripted scroll.

- [ ] **Step 7: Update Home-dependent E2E selectors**

Replace assertions such as:

```ts
page.getByRole("heading", { name: "監督ホーム" })
```

with:

```ts
page.getByTestId("home-screen")
```

In `home-match-flow.spec.ts`, the practice-match action is now `試合`; scope it to `.home-week-card` so it does not collide with bottom navigation:

```ts
await page.locator(".home-week-card").getByRole("button", { name: "試合", exact: true }).click();
```

- [ ] **Step 8: Run Home tests and verify GREEN**

```bash
npx playwright test tests/e2e/phase9-mobile-ui.spec.ts tests/e2e/home-match-flow.spec.ts tests/e2e/app-shell.spec.ts tests/e2e/official-tournament-continuity.spec.ts tests/e2e/mobile-layout-audit.spec.ts --project=mobile-chromium
```

Expected: Home initial-view, typography, behavior, and no-overflow assertions pass. Tournament single-line assertions may still be RED until Task 4.

- [ ] **Step 9: Commit**

```bash
git add src/features/home/HomeScreen.tsx src/features/home/home.css src/features/home/home-week.css tests/e2e/home-match-flow.spec.ts tests/e2e/app-shell.spec.ts tests/e2e/official-tournament-continuity.spec.ts
git commit -m "feat: rebuild home as compact game dashboard"
```

---

### Task 4: Render official tournament matches as compact single-line rows

**Files:**
- Create: `src/features/tournament/TournamentMatchRow.tsx`
- Modify: `src/features/tournament/TournamentScreen.tsx`
- Modify: `src/features/tournament/tournament.css`
- Modify: `tests/e2e/official-tournament-flow.spec.ts`
- Test: `tests/e2e/phase9-mobile-ui.spec.ts`
- Test: `tests/e2e/mobile-layout-audit.spec.ts`

**Interfaces:**

Create:

```ts
interface TournamentMatchRowProps {
  match: TournamentBracketMatchView;
  userEntrantId: string | null;
  isCurrentUserMatch: boolean;
  due: boolean;
  trainingCompleted: boolean;
  pending: boolean;
  canStart: boolean;
  onRequestStart: () => void;
}
```

`TournamentMatchRow` must preserve `data-testid="tournament-bracket-match"` on its article and add `data-testid="tournament-match-line"` to the horizontal line.

- [ ] **Step 1: Sort the selected round with the user's match first**

In `TournamentScreen.tsx`:

```ts
const visibleMatches = stage.matches
  .filter((match) => match.round === selectedRound)
  .sort((left, right) => Number(right.userInMatch) - Number(left.userInMatch));
```

Sorting is presentation-only; do not mutate domain state.

- [ ] **Step 2: Create `TournamentMatchRow.tsx`**

Determine which side is the user from `userEntrantId` and entrant IDs. Render one 3-column line:

```tsx
<div className="tournament-match-row__line" data-testid="tournament-match-line">
  <span
    className={`tournament-match-row__school tournament-match-row__school--home${userIsHome ? " is-user" : ""}`}
    title={match.home?.displayName ?? "未定"}
  >
    {match.home?.shortName ?? "未定"}
  </span>
  <strong className="tournament-match-row__center">
    {score ? `${match.homeSetsWon} - ${match.awaySetsWon}` : "VS"}
  </strong>
  <span
    className={`tournament-match-row__school tournament-match-row__school--away${userIsAway ? " is-user" : ""}`}
    title={match.away?.displayName ?? "未定"}
  >
    {match.away?.shortName ?? "未定"}
  </span>
</div>
```

Do not render `tournament-user-marker` or the text `自校`.

- [ ] **Step 3: Move official-match status/action inline**

Only for `isCurrentUserMatch`, append a compact action/status region below the one-line matchup. When `due && !trainingCompleted`, show the existing blocking explanation. When `due && trainingCompleted`, show the existing `公式戦を開始` button. When `pending`, show the existing progress status text.

The standalone `.tournament-action` section in `TournamentScreen.tsx` must be deleted to eliminate duplicated opponent/timing information.

- [ ] **Step 4: Compact tournament header/current-position strip**

Replace the separate `試合メニューへ戻る` text row with a 44px back control placed beside the 18px tournament heading. Preserve a readable accessible name, e.g. `aria-label="試合メニューへ戻る"`.

Add a compact current-position strip directly below the header:

```text
現在 1回戦    次戦 城南商業
```

Use 12px labels and 14px strong values.

- [ ] **Step 5: Implement the single-line CSS grid**

Core rules:

```css
.tournament-match-row {
  min-width: 0;
  padding: 0 10px;
  background: var(--game-panel);
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: var(--game-radius-card);
}

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

At 320px keep the three columns; reduce horizontal gap/padding, not font size. Never introduce horizontal scrolling.

- [ ] **Step 6: Keep round tabs readable**

Use `min-height: var(--game-touch)` and `font-size: var(--game-font-label)` for all four tabs, including <=360px media rules. Remove any existing 0.67rem shrink rule.

- [ ] **Step 7: Update official tournament E2E**

Preserve the existing checks for 8 first-round and 4 quarterfinal matches. Add:

```ts
await expect(page.getByTestId("tournament-user-path")).toHaveCount(0);
await expect(page.getByTestId("tournament-match-line")).toHaveCount(8);
```

For due-match tests, locate `公式戦を開始` within the user match article when possible:

```ts
const userMatch = page.locator('[data-user-match="true"]');
await expect(userMatch.getByRole("button", { name: "公式戦を開始" })).toBeDisabled();
```

- [ ] **Step 8: Run tournament tests and verify GREEN**

```bash
npx playwright test tests/e2e/phase9-mobile-ui.spec.ts tests/e2e/official-tournament-flow.spec.ts tests/e2e/official-tournament-continuity.spec.ts tests/e2e/mobile-layout-audit.spec.ts --project=mobile-chromium
npm run typecheck
```

Expected: all focused Phase 9 Home/Tournament assertions pass at 320/360/390/414/480 widths.

- [ ] **Step 9: Commit**

```bash
git add src/features/tournament/TournamentMatchRow.tsx src/features/tournament/TournamentScreen.tsx src/features/tournament/tournament.css tests/e2e/official-tournament-flow.spec.ts
git commit -m "feat: compact official tournament match rows"
```

---

### Task 5: Align remaining E2E with the new UI contract

**Files:**
- Modify as evidenced by failures only: `tests/e2e/*.spec.ts`
- Do not change production behavior in this task unless a real regression is demonstrated.

**Interfaces:**
- Home identity hook: `data-testid="home-screen"`.
- Home practice action: `.home-week-card` scoped `button[name="試合"]`.
- Tournament match hook: `data-testid="tournament-bracket-match"` remains stable.
- Tournament line hook: `data-testid="tournament-match-line"`.
- Tournament self state: `data-user-match="true"`.

- [ ] **Step 1: Run the full mobile E2E suite**

```bash
npm run test:e2e
```

- [ ] **Step 2: Classify every failure before editing**

For each failure, decide whether it is:

1. stale selector/copy expectation caused by the approved Phase 9 UI,
2. CSS/layout regression,
3. functional behavior regression.

Only category 1 is fixed by changing the test. Categories 2-3 require the relevant production fix and a focused rerun.

- [ ] **Step 3: Remove stale `監督ホーム` dependencies**

Search:

```bash
rg '監督ホーム|練習試合へ|tournament-user-path' tests/e2e
```

Replace Home identity checks with `getByTestId("home-screen")`; replace old Home action text with the scoped new control; remove marker expectations because Phase 9 explicitly forbids a user label.

- [ ] **Step 4: Run the full E2E suite again**

```bash
npm run test:e2e
```

Expected: all E2E tests pass.

- [ ] **Step 5: Commit test alignment separately**

```bash
git add tests/e2e
git commit -m "test: align e2e with phase9 mobile UI"
```

---

### Task 6: Final quality, mobile audit, and delivery verification

**Files:**
- Modify only if verification exposes a concrete issue.

**Interfaces:**
- Final acceptance is the combination of static quality gates, unit tests, full Playwright E2E, and five-width mobile audit.

- [ ] **Step 1: Run formatting check**

```bash
npm run format:check
```

Expected: PASS. If it fails, run `npm run format`, inspect the diff, then rerun `npm run format:check`.

- [ ] **Step 2: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: PASS for both.

- [ ] **Step 3: Run unit tests**

```bash
npm test
```

Expected: PASS with no domain-test changes needed for a presentation-only phase.

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run full mobile E2E**

```bash
npm run test:e2e
```

Expected: PASS.

- [ ] **Step 6: Run the explicit five-width Phase 9 audit once more**

```bash
npx playwright test tests/e2e/phase9-mobile-ui.spec.ts tests/e2e/mobile-layout-audit.spec.ts tests/e2e/official-tournament-flow.spec.ts --project=mobile-chromium
```

Expected: PASS at 320, 360, 390, 414, and 480px with no horizontal overflow; 360x800 Home weekly CTA is visible above the fixed nav without scripted scrolling.

- [ ] **Step 7: Review the production diff against the spec**

```bash
git diff main...HEAD -- src/ui/theme/game-theme.css src/ui/shell src/features/home src/features/tournament tests/e2e
```

Verify explicitly:

- no Home/Tournament/shell font below 12px,
- no `自校`/`★自校` tournament label,
- match row reads left school / score or VS / right school,
- self highlighting affects the user's side only,
- no duplicate standalone next-match action card,
- no domain/API/persistence logic changed.

- [ ] **Step 8: Commit any final verified formatting-only changes**

```bash
git add -A
git commit -m "style: finalize phase9 mobile UI"
```

Skip this commit if there are no remaining changes.

- [ ] **Step 9: Push branch and require CI GREEN before merge**

Push `feature/phase9-mobile-game-ui`, open/update the Phase 9 pull request, and do not merge until the repository Quality and mobile E2E checks are GREEN. After merge, verify the `main` push workflow is GREEN before declaring Phase 9 complete.
