# Court Legacy V2 Phase 2 Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 学校評判・選手バリエーション・スカウト・新入生獲得を年度進行へ統合し、何十年でも「結果→評判→候補変化→世代交代」が循環するV2の長期運営ループを完成させる。

**Architecture:** 既存の純粋ドメイン（`generation` / `calendar` / `world`）を再利用し、評判とスカウトを新しい純粋ドメインとして追加する。ブラウザは候補一覧と意思決定だけを表示し、候補生成・観察・獲得・年度進行は既存のWorker `game/action` 境界からサーバー権威で更新する。Phase 2Aでは公式大会ブラケットそのものは作らず、既存の試合/履歴値を評判入力として利用する。

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, Playwright, Cloudflare Workers, Supabase/PostgreSQL

**Spec:** `docs/superpowers/specs/2026-08-26-court-legacy-v2-rebuild-design.md`

## Global Constraints

- 舞台は高校男子バレー、1選手は原則3年間在籍する。
- 毎年度、3年生が卒業し、新1年生が入学する。学校・監督・歴代記録は継続し、年数上限を設けない。
- 新入生は学校評判、直近実績、全国実績、スカウトネットワーク、練習設備、寮、OB会、監督能力、地域補正、年度乱数を反映する。
- 新入生人数は標準4〜8人。強豪校でも天才・怪物を確定出現させない。
- 選手内部クラスは `normal | promising | elite | generational | monster` とする。
- スカウト段階で正確な潜在能力・一部性格・隠し特性・成長ピーク・怪我耐性をUIへ完全公開しない。
- 重要なゲーム更新はWorker経由。ブラウザから選手能力・通貨・結果を任意更新できない。
- 非同期操作は必ず即時状態を表示し、白画面・無反応・保存状態不明を作らない。
- 既存の`npm run verify`（format/lint/type/V2 structure/production audit/unit/build）とmobile E2Eを常にGREENに保つ。

---

### Task 1: Reputation engine and E–SS presentation

**Files:**
- Create: `src/domain/school/reputation.ts`
- Modify: `src/domain/model/School.ts`
- Modify: `src/domain/calendar/academicYearProgression.ts`
- Test: `tests/unit/domain/school/reputation.test.ts`
- Test: `tests/unit/domain/calendar/academicYearProgression.test.ts`

**Interfaces:**
- Consumes: `School.reputationPoints`, `School.history.recentSeasonRatings`, `School.history.peakReputationPoints`.
- Produces:
  - `type ReputationGrade = "E" | "D" | "C" | "B" | "A" | "S" | "SS"`
  - `reputationGrade(points: number): ReputationGrade`
  - `resolveSeasonReputation(input: ReputationSeasonInput): ReputationSeasonResult`

- [ ] **Step 1: Write failing reputation tests**

```ts
import { describe, expect, test } from "vitest";
import {
  reputationGrade,
  resolveSeasonReputation,
} from "../../../../src/domain/school/reputation";

describe("reputationGrade", () => {
  test.each([
    [0, "E"],
    [200, "D"],
    [400, "C"],
    [600, "B"],
    [800, "A"],
    [1000, "S"],
    [1200, "SS"],
  ] as const)("maps %s points to %s", (points, grade) => {
    expect(reputationGrade(points)).toBe(grade);
  });
});

describe("resolveSeasonReputation", () => {
  test("rewards strong results without making one season erase long-term prestige", () => {
    const result = resolveSeasonReputation({
      currentPoints: 760,
      recentSeasonRatings: [72, 75, 79],
      officialWins: 18,
      officialLosses: 4,
      prefecturalTitles: 1,
      nationalAppearances: 1,
      nationalTitles: 0,
    });

    expect(result.points).toBeGreaterThan(760);
    expect(result.points).toBeLessThanOrEqual(1400);
    expect(result.recentSeasonRatings).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- tests/unit/domain/school/reputation.test.ts`

Expected: FAIL because `src/domain/school/reputation.ts` does not exist.

- [ ] **Step 3: Implement the minimal reputation engine**

```ts
export type ReputationGrade = "E" | "D" | "C" | "B" | "A" | "S" | "SS";

export function reputationGrade(points: number): ReputationGrade {
  if (points >= 1200) return "SS";
  if (points >= 1000) return "S";
  if (points >= 800) return "A";
  if (points >= 600) return "B";
  if (points >= 400) return "C";
  if (points >= 200) return "D";
  return "E";
}
```

`resolveSeasonReputation` は勝率・県優勝・全国出場・全国優勝から0〜100のseason ratingを作り、直近5年平均を短期成分、現ポイントの85%を長期成分として合成し、0〜1400へclampする。`peakReputationPoints`は過去最高を保持する。

- [ ] **Step 4: Apply reputation at academic-year transition**

`advanceAcademicYear()` 内で各校の卒業/入学処理より前に前年度実績を確定し、`School.history.recentSeasonRatings` と `peakReputationPoints` を更新する。表示用`School.reputation`は既存互換を保ち、ポイントを正本とする。

- [ ] **Step 5: Run focused and long-run tests**

Run: `npm test -- tests/unit/domain/school/reputation.test.ts tests/unit/domain/calendar/academicYearProgression.test.ts tests/unit/domain/world/worldSoak.test.ts`

Expected: PASS and the 100-year soak remains bounded.

- [ ] **Step 6: Commit**

```bash
git add src/domain/school/reputation.ts src/domain/model/School.ts src/domain/calendar/academicYearProgression.ts tests/unit/domain/school/reputation.test.ts tests/unit/domain/calendar/academicYearProgression.test.ts
git commit -m "feat: add long-term school reputation engine"
```

---

### Task 2: Expand player class and long-term variation

**Files:**
- Modify: `src/domain/model/Player.ts`
- Modify: `src/domain/generation/generatePlayer.ts`
- Modify: `src/domain/generation/selectPlayerTraits.ts`
- Test: `tests/unit/domain/generation/generatePlayer.test.ts`
- Test: `tests/unit/domain/generation/selectPlayerTraits.test.ts`

**Interfaces:**
- Produces `PlayerTier = "normal" | "promising" | "elite" | "generational" | "monster"`.
- Adds to `Player`: `potential`, `trainingEfficiency`, `matchConsistency`, `bigMatch`, `injuryResistance`, `leadership`, `teamAdaptation`, `growthPeakGrade`.

- [ ] **Step 1: Write failing generation tests**

```ts
const classOrder: PlayerTier[] = [
  "normal",
  "promising",
  "elite",
  "generational",
  "monster",
];

test("higher internal classes have higher expected ceilings without deterministic max stats", () => {
  const averages = classOrder.map((tier) =>
    averageGeneratedOverall(tier, 200),
  );
  expect(averages[0]).toBeLessThan(averages[1]);
  expect(averages[1]).toBeLessThan(averages[2]);
  expect(averages[2]).toBeLessThan(averages[3]);
  expect(averages[3]).toBeLessThan(averages[4]);
  expect(maxGeneratedAbility("monster", 200)).toBeLessThanOrEqual(100);
});
```

Also assert every generated player has bounded variation values 0–100 and `growthPeakGrade` in `1 | 2 | 3`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/unit/domain/generation/generatePlayer.test.ts`

Expected: FAIL because the new tiers/fields do not exist.

- [ ] **Step 3: Implement five-tier offsets and variation fields**

Use tier offsets `{ normal: 0, promising: 6, elite: 12, generational: 20, monster: 27 }`; keep per-ability randomness so classes overlap. Generate potential and hidden variation separately from current ability, clamp all 0–100, and weight multi-position aptitude upward only for higher classes rather than guaranteeing it.

- [ ] **Step 4: Update trait weighting**

`selectPlayerTraitIds` must accept all five tiers. `promising` gets a small trait weight boost, `elite` a medium boost, `generational`/`monster` can draw rare traits but still permit no rare trait.

- [ ] **Step 5: Run generation and soak tests**

Run: `npm test -- tests/unit/domain/generation/generatePlayer.test.ts tests/unit/domain/generation/selectPlayerTraits.test.ts tests/unit/domain/world/worldSoak.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/model/Player.ts src/domain/generation/generatePlayer.ts src/domain/generation/selectPlayerTraits.ts tests/unit/domain/generation/generatePlayer.test.ts tests/unit/domain/generation/selectPlayerTraits.test.ts
git commit -m "feat: expand V2 player variation classes"
```

---

### Task 3: Reputation-driven recruiting probability model

**Files:**
- Create: `src/domain/recruiting/recruitingModel.ts`
- Create: `src/domain/model/Recruiting.ts`
- Test: `tests/unit/domain/recruiting/recruitingModel.test.ts`

**Interfaces:**
- Produces:
  - `RecruitClass = PlayerTier`
  - `RecruitingContext`
  - `intakeSize(context, random): number`
  - `selectRecruitClass(context, random): RecruitClass`
  - `scoutingAccuracy(context): number`

- [ ] **Step 1: Write failing probability tests**

Test 2,000 deterministic draws for low- and high-reputation schools. Assertions:
- every intake size is between 4 and 8;
- high-reputation distribution has more `elite + generational + monster` than low-reputation distribution;
- neither distribution guarantees `generational` or `monster`;
- same seed/context yields the same sequence.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/unit/domain/recruiting/recruitingModel.test.ts`

Expected: FAIL because recruiting model does not exist.

- [ ] **Step 3: Implement weighted quality factors**

Normalize inputs into a recruiting score using:
- reputation points 30%
- recent season rating 15%
- national appearances/titles 10%
- scoutingNetwork 12%
- gym 5%
- dormitory 7%
- alumniAssociation 6%
- coach.scouting 8%
- coach.development 4%
- region modifier 3%

Use the score to shift probability mass from `normal` toward `promising/elite`, while `generational/monster` retain very small global base probabilities multiplied by attractiveness and capped below certainty.

- [ ] **Step 4: Run probability tests**

Run: `npm test -- tests/unit/domain/recruiting/recruitingModel.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/model/Recruiting.ts src/domain/recruiting/recruitingModel.ts tests/unit/domain/recruiting/recruitingModel.test.ts
git commit -m "feat: add reputation-driven recruiting model"
```

---

### Task 4: Scouting board with intentionally incomplete information

**Files:**
- Modify: `src/domain/model/Recruiting.ts`
- Modify: `src/domain/model/GameState.ts`
- Create: `src/domain/recruiting/createScoutingBoard.ts`
- Create: `src/domain/recruiting/scoutingView.ts`
- Test: `tests/unit/domain/recruiting/createScoutingBoard.test.ts`
- Test: `tests/unit/domain/recruiting/scoutingView.test.ts`

**Interfaces:**
- Adds `GameState.recruiting`.
- `ScoutingCandidate` stores deterministic candidate seed, position/height/handedness, class, evaluation bands, observation progress and target school preference.
- `ScoutingCandidateView` exposes only height, position, handedness, middle-school result label, stars, estimated ability band, estimated potential band and comments.

- [ ] **Step 1: Write failing scouting-view tests**

Assert the public view does **not** contain exact potential, hidden traits, growth peak or injury resistance; higher observation accuracy narrows ability/potential bands but never returns exact hidden values.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/unit/domain/recruiting/createScoutingBoard.test.ts tests/unit/domain/recruiting/scoutingView.test.ts`

Expected: FAIL because scouting board/view do not exist.

- [ ] **Step 3: Implement deterministic board generation**

Generate 12–24 regional/world candidates from `state.seed + academicYear`, use Task 3 probabilities, and include enough candidates that elite talent can choose rival schools. Candidate IDs must remain stable through observation and signing.

- [ ] **Step 4: Implement observation bands**

Use accuracy buckets to create ranges:
- low accuracy: ±14 ability / ±18 potential
- medium: ±9 / ±12
- high: ±5 / ±8

Never expose hidden-trait IDs, growthPeakGrade or injuryResistance in `ScoutingCandidateView`.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- tests/unit/domain/recruiting/createScoutingBoard.test.ts tests/unit/domain/recruiting/scoutingView.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/model/Recruiting.ts src/domain/model/GameState.ts src/domain/recruiting/createScoutingBoard.ts src/domain/recruiting/scoutingView.ts tests/unit/domain/recruiting/createScoutingBoard.test.ts tests/unit/domain/recruiting/scoutingView.test.ts
git commit -m "feat: add incomplete-information scouting board"
```

---

### Task 5: Server-authoritative scouting actions

**Files:**
- Modify: `worker/game/gameActionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify: `src/services/api/GameApiClient.ts`
- Modify: `src/app/GameApp.tsx`
- Test: `tests/unit/worker/gameAction.test.ts`
- Test: `tests/unit/worker/applyGameAction.test.ts`
- Test: `tests/unit/app/GameAppActions.test.tsx`

**Interfaces:**
- Adds action types:
  - `{ type: "scout-observe"; candidateId: string }`
  - `{ type: "scout-prioritize"; candidateId: string }`
- Uses existing revision + operationId contract.

- [ ] **Step 1: Write failing strict-schema tests**

Assert unknown candidate IDs return 400-domain failure, client cannot submit observation result/ability bands, and valid actions update only server-calculated scouting state.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/unit/worker/gameAction.test.ts tests/unit/worker/applyGameAction.test.ts`

Expected: FAIL because action schema does not accept scouting actions.

- [ ] **Step 3: Implement Worker actions**

`scout-observe` increases observation progress based on school scoutingNetwork + coach.observation. `scout-prioritize` records at most three priority candidate IDs; repeating the same choice is idempotent under the existing operationId flow.

- [ ] **Step 4: Keep browser authoritative-state-only**

`GameApp` must call `cloudSession.applyAction()` and adopt the returned snapshot. Do not calculate observation accuracy or signing odds in React.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- tests/unit/worker/gameAction.test.ts tests/unit/worker/applyGameAction.test.ts tests/unit/app/GameAppActions.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/game/gameActionSchema.ts worker/game/applyGameAction.ts src/services/api/GameApiClient.ts src/app/GameApp.tsx tests/unit/worker/gameAction.test.ts tests/unit/worker/applyGameAction.test.ts tests/unit/app/GameAppActions.test.tsx
git commit -m "feat: make scouting decisions server authoritative"
```

---

### Task 6: Integrate recruiting into the endless academic-year transition

**Files:**
- Modify: `src/domain/calendar/academicYearProgression.ts`
- Modify: `src/domain/generation/generatePlayer.ts`
- Modify: `src/domain/world/rivalWorldProgression.ts`
- Test: `tests/unit/domain/calendar/academicYearProgression.test.ts`
- Test: `tests/unit/domain/world/rivalWorldProgression.test.ts`
- Test: `tests/unit/domain/world/worldSoak.test.ts`

**Interfaces:**
- Consumes `GameState.recruiting`, Task 3 recruiting probabilities, Task 2 five-tier players.
- Produces an `AcademicYearTransitionSummary` that includes intake tier counts and priority recruit outcomes without exposing hidden prospect data before enrollment.

- [ ] **Step 1: Write failing year-transition tests**

Assert:
- third-years graduate before promotion;
- each school receives 4–8 new first-years subject to roster cap;
- priority candidates are more likely but not guaranteed to join the user school;
- high-reputation schools attract better average classes across deterministic multi-year simulation;
- a 100-year same-seed run is deterministic and never exceeds roster bounds.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/unit/domain/calendar/academicYearProgression.test.ts tests/unit/domain/world/worldSoak.test.ts`

Expected: FAIL because transition still generates only `normal` intake and uses the old fixed generational scheduling path.

- [ ] **Step 3: Replace intake generation with recruiting outcomes**

At March→April transition, resolve candidate destination using school attractiveness + priority bonus + region fit + random factor. Fill remaining roster slots using Task 3 `selectRecruitClass`. Generate actual `Player` values only after destination is resolved.

- [ ] **Step 4: Remove fixed-cycle rare-talent scheduling**

Do not use `nextGenerationalTalentYear` as a guaranteed spawn trigger for intake. Rare classes come from the probability model; world state may keep historical rare-talent metadata only if used for records.

- [ ] **Step 5: Generate next scouting board after transition**

After new intake is committed, initialize the next academic year's scouting state deterministically, ready for the next offseason.

- [ ] **Step 6: Run focused and 100-year tests**

Run: `npm test -- tests/unit/domain/calendar/academicYearProgression.test.ts tests/unit/domain/world/rivalWorldProgression.test.ts tests/unit/domain/world/worldSoak.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/calendar/academicYearProgression.ts src/domain/generation/generatePlayer.ts src/domain/world/rivalWorldProgression.ts tests/unit/domain/calendar/academicYearProgression.test.ts tests/unit/domain/world/rivalWorldProgression.test.ts tests/unit/domain/world/worldSoak.test.ts
git commit -m "feat: integrate recruiting into endless year progression"
```

---

### Task 7: Reputation and scouting UI

**Files:**
- Create: `src/features/recruiting/RecruitingScreen.tsx`
- Create: `src/features/recruiting/recruiting.css`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/ui/shell/GameHeader.tsx`
- Modify: `src/app/GameApp.tsx`
- Test: `tests/unit/features/recruiting/RecruitingScreen.test.tsx`
- Test: `tests/unit/features/home/HomeScreen.test.tsx`
- Test: `tests/unit/ui/shell/GameHeader.test.tsx`

**Interfaces:**
- Displays `ReputationGrade` E–SS and points/trend.
- Displays `ScoutingCandidateView[]`, never raw `ScoutingCandidate` hidden values.
- Uses Task 5 actions for observe/prioritize.

- [ ] **Step 1: Write failing UI tests**

Assert the screen shows candidate height/position/stars/estimated ranges/comments, hides exact potential/growth peak/injury resistance, shows local `調査中…` immediately when observing, and displays recoverable save/network errors through the existing operation status.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/unit/features/recruiting/RecruitingScreen.test.tsx`

Expected: FAIL because screen does not exist.

- [ ] **Step 3: Implement information-first mobile UI**

Use dense rows/cards without portraits. Put recruiting under `その他` and surface a Home card during scouting season. Header reputation changes from internal label to `評判 A / 842` style.

- [ ] **Step 4: Run UI tests**

Run: `npm test -- tests/unit/features/recruiting/RecruitingScreen.test.tsx tests/unit/features/home/HomeScreen.test.tsx tests/unit/ui/shell/GameHeader.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/recruiting src/features/home/HomeScreen.tsx src/ui/shell/GameHeader.tsx src/app/GameApp.tsx tests/unit/features/recruiting tests/unit/features/home/HomeScreen.test.tsx tests/unit/ui/shell/GameHeader.test.tsx
git commit -m "feat: add V2 reputation and scouting UI"
```

---

### Task 8: Phase 2A acceptance, E2E and structural guard

**Files:**
- Create: `tests/e2e/v2-recruiting-year-loop.spec.ts`
- Modify: `scripts/verifyStructureCli.mjs`
- Modify: `README.md`

**Interfaces:**
- E2E uses the existing stateful E2E cloud backend and normal `useGameSession` status feedback.

- [ ] **Step 1: Write failing E2E**

Flow:
1. boot authenticated E2E school;
2. open recruiting;
3. observe one candidate and see `保存中…` within 300ms;
4. prioritize candidate;
5. advance through year transition using a deterministic near-transition fixture;
6. assert third-years leave, first-years arrive, reputation grade remains visible, and reload preserves the result.

- [ ] **Step 2: Verify RED**

Run: `npx playwright test tests/e2e/v2-recruiting-year-loop.spec.ts`

Expected: FAIL until the complete Phase 2A flow is wired.

- [ ] **Step 3: Add structural guards**

Require `src/domain/recruiting/recruitingModel.ts`, `src/domain/recruiting/createScoutingBoard.ts`, `src/features/recruiting/RecruitingScreen.tsx` and the new E2E file. Keep the existing client-secret and V1-save/art forbidden checks.

- [ ] **Step 4: Update README**

Document the five-tier recruiting model, E–SS reputation grade, scouting-information uncertainty and that recruiting mutations are server authoritative.

- [ ] **Step 5: Run final verification**

Run: `npm run verify`

Expected: PASS.

Run: `npm run test:e2e`

Expected: all mobile E2E PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/v2-recruiting-year-loop.spec.ts scripts/verifyStructureCli.mjs README.md
git commit -m "test: verify V2 recruiting year loop"
```

---

## Self-review

- Spec coverage for this plan: endless graduation/intake loop, E–SS reputation, reputation-conditioned recruiting, 4–8 intake, five player classes, rare probabilistic talent, incomplete scouting information, scouting facilities/coach effects, server-authoritative scouting decisions, mobile information-first UI, operation feedback and long-run determinism.
- Deliberately deferred to the next independent Phase 2 plan: full official tournament brackets/schedule, tournament result UX, awards, detailed school/alumni historical record screens. Existing match/history fields remain inputs to reputation until that subsystem is expanded.
- No placeholder tasks: each task has exact files, interfaces, RED/GREEN commands and commit boundary.
- Type consistency: recruiting uses the expanded `PlayerTier`; UI consumes a separate `ScoutingCandidateView` so hidden fields are not rendered accidentally.
