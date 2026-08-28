# Court Legacy V2 Phase 3 Scouting UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 2のサーバー権威スカウトAPIを、スマホで候補確認・獲得できるUIへ接続する。

**Architecture:** `GameApiClient` に専用APIメソッドを追加し、`GameApp` が一時的なScoutReport stateと更新済みCloudGameSnapshotを管理する。`ScoutingScreen` は公開レポートだけを受け取るpresentational componentとし、候補真値はGameStateへ入れない。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Cloudflare Workers, Playwright

**Spec:** `docs/superpowers/specs/2026-08-28-phase3-scouting-ui-design.md`

## Global Constraints

- 下部5タブは維持する。
- 候補真値をブラウザへ追加しない。
- loading/error/retryを必ず可視化する。
- 360px幅で横スクロールを発生させない。
- authoritative mutationは既存Worker APIのみを使用する。
- `npm run verify` と mobile E2EをGREENにする。

---

### Task 1: Scouting API client

**Files:**
- Modify: `src/services/api/GameApiClient.ts`
- Modify: `tests/unit/services/GameApiClient.test.ts`

**Interfaces:**
- Produces: `ScoutingBoardResponse`, `ScoutingRecruitmentResponse`, `GameApiClient.getScoutingBoard()`, `GameApiClient.commitRecruit()`

- [ ] **Step 1: Write failing API client tests**

Add tests asserting:

```ts
await api.getScoutingBoard("access-token", {
  operationId: "scout-board-1",
  revision: 4,
});

expect(fetchImpl).toHaveBeenCalledWith(
  "/api/scouting/board",
  expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ operationId: "scout-board-1", revision: 4 }),
  }),
);
```

and:

```ts
await api.commitRecruit("access-token", {
  operationId: "recruit-1",
  revision: 4,
  candidateId: playerId("candidate-1"),
});

expect(fetchImpl).toHaveBeenCalledWith(
  "/api/scouting/recruitment",
  expect.objectContaining({ method: "POST" }),
);
```

- [ ] **Step 2: Run CI and verify RED**

Expected: TypeScript fails because the two methods/types do not exist.

- [ ] **Step 3: Implement minimal API methods and response types**

Use the existing private `request<T>()` helper so Bearer token, AbortSignal, network mapping, and structured ApiError behavior stay identical to other endpoints.

- [ ] **Step 4: Run CI and verify GREEN**

Expected: formatting, lint, typecheck, unit tests and build pass.

---

### Task 2: ScoutingScreen presentational UI

**Files:**
- Create: `src/features/scouting/ScoutingScreen.tsx`
- Create: `src/features/scouting/scouting.css`
- Create: `tests/unit/features/scouting/ScoutingScreen.test.tsx`

**Interfaces:**
- Consumes: `ScoutReport[]`, `GameState`, `committedCandidateIds`, load/recruit state callbacks
- Produces: mobile-first scouting screen without access to Player truth

Use props:

```ts
interface ScoutingScreenProps {
  state: GameState;
  reports: ScoutReport[];
  loading: boolean;
  error: string | null;
  recruitingCandidateId: PlayerId | null;
  onBack: () => void;
  onRetry: () => void;
  onRecruit: (candidateId: PlayerId) => void;
}
```

- [ ] **Step 1: Write failing render tests**

Cover:
- heading `新入生スカウト`
- candidate public fields
- `調査精度`
- estimated ranges
- comments
- loading copy `候補を調査しています…`
- error + `再試行`
- committed candidate renders `獲得済み` disabled
- recruiting candidate renders `入学交渉中…` disabled

- [ ] **Step 2: Verify RED**

Expected: module does not exist.

- [ ] **Step 3: Implement component and CSS**

Do not import or render Player truth fields. Use a single-column card layout and existing visual tokens/classes where practical.

- [ ] **Step 4: Verify GREEN**

Expected: component tests pass and `npm run verify` remains green.

---

### Task 3: GameApp scouting flow

**Files:**
- Modify: `src/app/GameApp.tsx`
- Modify: `src/app/useGameSession.ts`
- Modify: `src/features/training/TrainingScreen.tsx`
- Modify: `tests/unit/app/GameApp.test.tsx` if present, otherwise create `tests/unit/app/GameApp.scouting.test.tsx`

**Interfaces:**
- `useGameSession` produces `replaceFromServer(nextSnapshot)` or a focused equivalent so non-`/api/game/action` authoritative responses can replace the snapshot safely.
- `TrainingScreen` receives optional `onOpenScouting` callback and shows a prominent `新入生スカウト` action.

- [ ] **Step 1: Write failing integration tests**

Test flow:
1. render GameApp with fake GameApiClient
2. switch to `育成`
3. click `新入生スカウト`
4. assert `getScoutingBoard` called with current revision
5. resolve reports and display candidate
6. click `獲得候補にする`
7. assert `commitRecruit` called with candidateId/current revision
8. resolve response with incremented revision and recruiting state
9. assert candidate becomes `獲得済み`

Also cover board/recruit ApiError display and retry.

- [ ] **Step 2: Verify RED**

Expected: missing callbacks/methods/view.

- [ ] **Step 3: Implement flow**

Rules:
- generate a fresh `crypto.randomUUID()` operationId per board/recruit request
- board reports remain local UI state
- recruitment success replaces authoritative snapshot from response.game
- after 409 conflict bootstrap latest snapshot then clear/reload board
- no concurrent recruit operations
- leaving and reopening the same cycle may reuse reports in memory; server remains authoritative

- [ ] **Step 4: Verify GREEN**

Run full `npm run verify` through CI.

---

### Task 4: Mobile E2E and phase documentation

**Files:**
- Modify or create the relevant Playwright mobile spec under `tests/e2e/`
- Modify: `README.md` only if navigation/user-facing feature documentation needs updating

**Interfaces:**
- Produces final regression gate for accessible mobile flow.

- [ ] **Step 1: Add mobile E2E coverage**

Verify at mobile viewport:
- training screen exposes scouting action
- scouting screen opens without blank/loading ambiguity
- candidate cards fit viewport width
- back navigation returns to training
- no horizontal overflow

Use mocked/test-mode API state if production authentication would make the flow nondeterministic.

- [ ] **Step 2: Run final verification**

Required evidence:
- `npm run verify` SUCCESS
- mobile Playwright E2E SUCCESS

- [ ] **Step 3: Open/update Phase 3 draft PR**

Summarize the public-data boundary, UX states, API integration, tests, and remaining Phase 3 tasks.
