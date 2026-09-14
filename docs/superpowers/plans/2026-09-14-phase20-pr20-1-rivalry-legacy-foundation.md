# Phase20 PR20-1 Rivalry & Legacy Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing bounded match/rivalry history into readable head-to-head records, school legacy presentation, and compact PVE pre-match rivalry context without changing match strength or PvP contracts.

**Architecture:** Add a pure `rivalryHistory` domain selector over `GameState.history.matches` and `world.rivalryScores`, then consume that selector from narrowly scoped school and PVE pre-match presentation components. Keep all labels derived and keep historical facts limited to data actually persisted in `HistoricalMatchSummary`; no save-schema change is required.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4, Testing Library, existing Court Legacy domain selectors and CSS.

**Spec:** `docs/superpowers/specs/2026-09-14-phase20-rivalry-legacy-team-relationships-design.md`

## Global Constraints

- Save schema remains v8.
- Deterministic for identical state/history.
- No hidden match stat bonuses.
- No PvP authority, privacy, reconnect, command, or payload changes.
- `宿敵` comes from `world.destinyRivalSchoolId`; `因縁` uses rivalry score >= 40; `天敵` needs >=4 meetings, <=25% user win rate, and a losing streak >=2.
- Historical upset claims must not be inferred from current-day strength/reputation.
- Neutral first-time PVE opponents must not gain noisy rivalry UI.
- Focused tests and typecheck must be GREEN before ordinary PR CI.

---

### Task 1: Define the head-to-head domain contract

**Files:**

- Create: `src/domain/world/rivalryHistory.ts`
- Create: `tests/unit/domain/world/rivalryHistory.test.ts`
- Read/Reuse: `src/domain/world/rivalWorldProgression.ts`
- Read/Reuse: `src/domain/model/GameState.ts`

**Interfaces:**

- Produces:

```ts
export type UserMatchResult = "win" | "loss";
export type RivalryLabel =
  | "destiny-rival"
  | "rivalry"
  | "nemesis"
  | "revenge"
  | "winning-streak"
  | "losing-streak";

export interface HeadToHeadMeeting {
  matchId: MatchId;
  date: GameDate;
  result: UserMatchResult;
  userSetsWon: number;
  opponentSetsWon: number;
  official: boolean;
}

export interface HeadToHeadSummary {
  opponentSchoolId: SchoolId;
  totalMeetings: number;
  wins: number;
  losses: number;
  officialMeetings: number;
  practiceMeetings: number;
  currentStreak: { result: UserMatchResult; count: number } | null;
  lastMeeting: HeadToHeadMeeting | null;
  lastFive: HeadToHeadMeeting[];
  rivalryScore: number;
  destinyRival: boolean;
  labels: RivalryLabel[];
}

export function selectUserHeadToHead(
  state: GameState,
  opponentSchoolId: SchoolId,
): HeadToHeadSummary;

export function selectUserHeadToHeadTable(
  state: GameState,
): HeadToHeadSummary[];
```

- [ ] **Step 1: Write failing domain tests for win/loss orientation, counts, last-five, and streaks**

Create fixtures where the user school appears as both home and away and assert orientation is always from the user's perspective:

```ts
expect(summary).toMatchObject({
  totalMeetings: 5,
  wins: 2,
  losses: 3,
  officialMeetings: 3,
  practiceMeetings: 2,
  currentStreak: { result: "loss", count: 2 },
});
expect(summary.lastFive).toHaveLength(5);
expect(summary.lastMeeting?.result).toBe("loss");
```

Also assert `selectUserHeadToHeadTable()` ignores schools that have no meeting and deterministically sorts meaningful rivals first by destiny-rival, rivalry score, meeting count, then school id.

- [ ] **Step 2: Run RED**

Run:

```bash
npx vitest run tests/unit/domain/world/rivalryHistory.test.ts
```

Expected: FAIL because `rivalryHistory.ts` does not exist.

- [ ] **Step 3: Implement meeting normalization and aggregation**

Implement a private converter that only accepts historical matches involving `state.userSchoolId`, maps home/away set scores into user/opponent set scores, and sorts by `date` then `matchId` for deterministic streak calculation.

Use existing `rivalryKey()` to read rivalry score; do not duplicate the key format.

- [ ] **Step 4: Run focused domain tests**

Run:

```bash
npx vitest run tests/unit/domain/world/rivalryHistory.test.ts tests/unit/domain/world/rivalWorldProgression.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/world/rivalryHistory.ts tests/unit/domain/world/rivalryHistory.test.ts
git commit -m "feat: derive head to head rivalry history"
```

---

### Task 2: Add objective rivalry labels and notable-match selection

**Files:**

- Modify: `src/domain/world/rivalryHistory.ts`
- Modify: `tests/unit/domain/world/rivalryHistory.test.ts`

**Interfaces:**

- Produces:

```ts
export interface NotableUserMatch {
  match: HistoricalMatchSummary;
  score: number;
  reasons: Array<"official" | "close" | "rival" | "destiny-rival" | "rematch">;
}

export function selectNotableUserMatches(
  state: GameState,
  limit?: number,
): NotableUserMatch[];
```

- [ ] **Step 1: Add RED tests for every approved label**

Cover these exact contracts:

```ts
expect(destiny.labels).toContain("destiny-rival");
expect(destiny.labels).not.toContain("rivalry");
expect(rival.labels).toContain("rivalry");
expect(nemesis.labels).toContain("nemesis");
expect(afterLoss.labels).toContain("revenge");
expect(streak.labels).toContain("losing-streak");
```

Boundary tests:

- rivalry score 39 is not `rivalry`, score 40 is.
- 3 meetings cannot become `nemesis`.
- 4 meetings with 1 win / 3 losses plus current losing streak >=2 can become `nemesis`.
- streak count 1 produces no streak label.

- [ ] **Step 2: Add RED tests for notable matches using persisted facts only**

Create old historical matches where current opponent strength is later mutated and assert notable ranking is unchanged. Assert final/tournament-ish official context, close set score, rivalry, and repeat meeting can increase score; current ability/reputation changes cannot.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/unit/domain/world/rivalryHistory.test.ts
```

Expected: only new label/notable assertions fail.

- [ ] **Step 4: Implement labels and notable scoring**

Use constants in `rivalryHistory.ts`:

```ts
const RIVALRY_PRESENTATION_THRESHOLD = 40;
const NEMESIS_MIN_MEETINGS = 4;
const NEMESIS_MAX_WIN_RATE = 0.25;
const VISIBLE_STREAK_MIN = 2;
```

For notable scoring, use only `tournamentId`, absolute set difference, match ordering/repeat count, and rivalry/destiny-rival status. Keep the scoring private so tests assert ordering/reasons rather than every coefficient.

- [ ] **Step 5: Run focused tests and commit**

```bash
npx vitest run tests/unit/domain/world/rivalryHistory.test.ts tests/unit/domain/world/rivalWorldProgression.test.ts
npm run typecheck
git add src/domain/world/rivalryHistory.ts tests/unit/domain/world/rivalryHistory.test.ts
git commit -m "feat: classify rivalry context and notable matches"
```

---

### Task 3: Present legacy history inside the existing School records tab

**Files:**

- Create: `src/features/school/SchoolLegacyPanel.tsx`
- Modify: `src/features/school/SchoolScreen.tsx`
- Modify: `src/features/school/school-screen.css`
- Create: `tests/unit/features/school/SchoolLegacyPanel.test.tsx`
- Modify: `tests/unit/features/school/SchoolSeasonHistory.test.tsx` only if an existing assertion must include the new panel

**Interfaces:**

- Consumes: `selectUserHeadToHeadTable`, `selectNotableUserMatches`.
- Produces:

```ts
interface SchoolLegacyPanelProps {
  state: GameState;
}
export function SchoolLegacyPanel(props: SchoolLegacyPanelProps): JSX.Element;
```

- [ ] **Step 1: Write RED UI tests**

Render a state with a destiny rival and multiple historical opponents. Assert the panel shows:

- `対戦史`
- opponent name
- `通算 2勝3敗`-style lifetime record
- current streak when >=2
- `宿敵` / `因縁` / `天敵` labels where applicable
- recent notable-match rows
- no fabricated opponent rows for zero-meeting schools.

Also assert the existing `記録` tab remains the navigation surface; do not add a sixth school tab.

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/features/school/SchoolLegacyPanel.test.tsx tests/unit/features/school/SchoolSeasonHistory.test.tsx
```

Expected: FAIL because panel does not exist.

- [ ] **Step 3: Implement compact mobile-first panel**

Render at most the top 5 head-to-head opponents and at most 5 notable matches. Use current school names/short names only for display labels; historical result facts come from the historical summary.

Do not move facilities/staff/scouting/alumni navigation.

- [ ] **Step 4: Wire into `SchoolScreen` records view**

Import `SchoolLegacyPanel` and render it below the existing season-ranking/record summary in the `view === "records"` branch. Remove only duplicated record markup if it becomes visibly redundant; avoid unrelated SchoolScreen refactors.

- [ ] **Step 5: Run focused UI tests and commit**

```bash
npx vitest run tests/unit/features/school/SchoolLegacyPanel.test.tsx tests/unit/features/school/SchoolSeasonHistory.test.tsx tests/unit/features/school/SchoolScreen.test.tsx
npm run typecheck
git add src/features/school/SchoolLegacyPanel.tsx src/features/school/SchoolScreen.tsx src/features/school/school-screen.css tests/unit/features/school
git commit -m "feat: show rivalry history in school records"
```

---

### Task 4: Carry PVE opponent school identity into pre-match preparation

**Files:**

- Modify: `src/features/match/preMatchPreparation.ts`
- Modify: `src/app/GameApp.tsx`
- Create: `tests/unit/features/match/preMatchPreparation.test.ts`
- Modify: `tests/unit/features/match/AppMatchFlow.test.tsx` only if needed for the prop boundary

**Interfaces:**

- Modify `WeekPreMatchPreparation`:

```ts
export interface WeekPreMatchPreparation {
  kind: "official" | "practice";
  opponentSchoolId?: SchoolId;
  opponentName: string;
  opponentStrength?: number;
  opponentSelection?: TeamSelection;
  opponentTactics?: PublicTacticSummary;
}
```

- Add optional `opponentSchoolId` only to `PreMatchContext` branch `{ kind: "week"; ... }`.
- Do not add it to `{ kind: "pvp"; ... }`.

- [ ] **Step 1: Write RED tests for official/practice/guest identity**

Assert:

```ts
expect(practice?.opponentSchoolId).toBe(scheduledSchoolId);
expect(worldOfficial?.opponentSchoolId).toBe(worldSchoolId);
expect(guestOfficial?.opponentSchoolId).toBeUndefined();
```

- [ ] **Step 2: Run RED**

```bash
npx vitest run tests/unit/features/match/preMatchPreparation.test.ts
```

- [ ] **Step 3: Add the optional ID and pass it through `GameApp` week context**

Keep all existing PVE strength/selection/tactics data unchanged. Do not touch `PvpOpponentSummary`, PvP contracts, or worker payloads.

- [ ] **Step 4: Run focused tests and commit**

```bash
npx vitest run tests/unit/features/match/preMatchPreparation.test.ts tests/unit/features/match/AppMatchFlow.test.tsx
npm run typecheck
git add src/features/match/preMatchPreparation.ts src/app/GameApp.tsx tests/unit/features/match
git commit -m "feat: carry pve opponent identity to pre match"
```

---

### Task 5: Show compact rivalry context on the PVE pre-match screen

**Files:**

- Create: `src/features/match/rivalryPresentation.ts`
- Modify: `src/features/match/PreMatchLineupScreen.tsx`
- Modify: `src/features/match/pre-match-lineup.css`
- Create: `tests/unit/features/match/rivalryPresentation.test.ts`
- Modify: `tests/unit/features/match/PreMatchLineupScreen.test.tsx`

**Interfaces:**

- Produces:

```ts
export interface PreMatchRivalryPresentation {
  headline: string;
  recordLabel: string;
  previousResultLabel: string | null;
  chips: string[];
}

export function buildPreMatchRivalryPresentation(
  state: GameState,
  opponentSchoolId: SchoolId,
): PreMatchRivalryPresentation | null;
```

- Modify `PreMatchLineupScreenProps` with optional `opponentSchoolId?: SchoolId`.
- `mode === "pvp"` must never call/show this selector.

- [ ] **Step 1: Write RED presentation tests**

Assert first-time neutral opponent returns `null`. Assert repeated opponent can produce:

- `通算 2勝3敗`
- previous loss text
- `雪辱戦`
- streak text
- `宿敵` where applicable.

- [ ] **Step 2: Write RED component tests**

PVE with meaningful history displays compact context. PVE first meeting does not show the rivalry section. PvP does not show rivalry history even if the supplied state has local history for a same-named school.

- [ ] **Step 3: Run RED**

```bash
npx vitest run tests/unit/features/match/rivalryPresentation.test.ts tests/unit/features/match/PreMatchLineupScreen.test.tsx
```

- [ ] **Step 4: Implement presentation and render directly under the versus card**

Keep it compact: one headline, lifetime record, previous result, up to three chips. No new modal or dashboard.

- [ ] **Step 5: Run focused suite**

```bash
npx vitest run \
  tests/unit/domain/world/rivalryHistory.test.ts \
  tests/unit/features/school/SchoolLegacyPanel.test.tsx \
  tests/unit/features/school/SchoolSeasonHistory.test.tsx \
  tests/unit/features/match/preMatchPreparation.test.ts \
  tests/unit/features/match/rivalryPresentation.test.ts \
  tests/unit/features/match/PreMatchLineupScreen.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/match tests/unit/features/match
git commit -m "feat: show pve rivalry context before matches"
```

---

### Task 6: Final regression and PR gate

**Files:**

- Modify only if verification reveals an approved-scope regression.

- [ ] **Step 1: Format-check changed files**

```bash
npx prettier --check \
  src/domain/world/rivalryHistory.ts \
  src/features/school/SchoolLegacyPanel.tsx \
  src/features/school/SchoolScreen.tsx \
  src/features/school/school-screen.css \
  src/features/match/preMatchPreparation.ts \
  src/features/match/rivalryPresentation.ts \
  src/features/match/PreMatchLineupScreen.tsx \
  src/features/match/pre-match-lineup.css \
  src/app/GameApp.tsx \
  tests/unit/domain/world/rivalryHistory.test.ts \
  tests/unit/features/school/SchoolLegacyPanel.test.tsx \
  tests/unit/features/match/preMatchPreparation.test.ts \
  tests/unit/features/match/rivalryPresentation.test.ts
```

- [ ] **Step 2: Run full repository verification before opening the PR**

```bash
npm run verify
npm run release:check
```

Expected: GREEN.

- [ ] **Step 3: Review diff specifically for boundary violations**

Confirm:

- `CURRENT_GAME_SCHEMA_VERSION` remains 8.
- no PvP contract file changed.
- no player ability, match simulation, or rivalry-score mutation formula changed.
- no historical strength inference exists.

- [ ] **Step 4: Open PR only after local/focused GREEN**

PR title:

```text
feat: add Phase20 rivalry and legacy history
```

PR body must state focused test evidence, schema v8 unchanged, PvP unchanged, and exact candidate SHA.

- [ ] **Step 5: Require official PR CI GREEN, squash merge, then exact merge-SHA main CI GREEN**

Do not treat branch-only verification as completion.
