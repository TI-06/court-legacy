# Phase 15 Tactics UX Implementation Plan

> **For implementation:** Use the approved Phase 15 design, execute task-by-task with TDD, and require exact-head PR CI plus main push CI before completion.

**Goal:** Expose the Phase 15 three-axis tactics as a game-like mobile UI in Player Hub and pre-match preparation, wire match-only overrides through normal/PvP match starts, and show only public opponent tendencies without weakening PvP privacy.

**Architecture:** Keep `School.tactics` as the only persisted source. Normal tactics are edited from Player Hub and saved through authoritative `set-team-tactics`. Pre-match holds a local `MatchTacticPlan` initialized from authoritative tactics and sends it only when starting the match. PvE opponent tendencies derive from the known opponent `School.tactics`; PvP tendencies come only from the optional public snapshot summary. Shared Japanese labels/descriptions live in presentation code, not the domain model.

**Tech Stack:** React 19, TypeScript, Testing Library, Playwright, existing `MatchTacticPlan`/matchup helpers and authoritative Worker actions.

---

## Task 1: Shared tactics presentation and normal tactics panel

**Files:**

- Create: `src/features/team/tacticsPresentation.ts`
- Create: `src/features/team/TeamTacticsPanel.tsx`
- Extend: `src/features/team/player-hub.css`
- Create: `tests/unit/features/team/TeamTacticsPanel.test.tsx`

**RED first:**

- three axes render with the approved Japanese labels and short trade-off descriptions;
- current authoritative plan is selected;
- changing one axis updates only the local draft;
- save emits one complete `MatchTacticPlan`;
- save is disabled while pending or when unchanged;
- receiving a new authoritative plan after save re-synchronizes the draft.

**GREEN:** add small shared label/presentation helpers and a mobile-first `TeamTacticsPanel`. Use one explicit `基本戦術を保存` action so exploratory taps do not create multiple server writes.

## Task 2: Player Hub tactics tab and authoritative save

**Files:**

- Modify: `src/features/team/PlayerHubScreen.tsx`
- Modify: `src/app/GameApp.tsx`
- Extend: `tests/unit/features/team/PlayerHubScreen.test.tsx`
- Create: `tests/unit/app/GameApp.teamTactics.test.tsx`

**RED first:**

- Player Hub exposes `選手一覧 / 編成 / チーム状態 / 戦術`;
- opening `戦術` shows the plan derived from `state.schools[state.userSchoolId].tactics`;
- saving sends `set-team-tactics` with all three categorical values;
- returned authoritative snapshot becomes the displayed selection;
- other Player Hub modes keep existing behavior.

**GREEN:** add `tactics` HubMode, `onSetTeamTactics`, and pending plumbing. `GameApp` saves through `cloudSession.runAction({type:"set-team-tactics", plan})` and adopts the server response normally.

## Task 3: PvE opponent tactic tendency in pre-match preparation

**Files:**

- Modify: `src/features/match/preMatchPreparation.ts`
- Modify/create focused tests for `preMatchPreparation`.

**RED first:**

- known practice/official schools provide a categorical opponent tactic summary derived from their existing `School.tactics`;
- unknown/materialized opponent without a school record leaves the summary absent;
- no player-level or serve-target data enters the preparation DTO.

**GREEN:** extend `WeekPreMatchPreparation` with optional `opponentTactics: PublicTacticSummary` and derive it only from an available school.

## Task 4: Pre-match local tactics editor and matchup hint

**Files:**

- Modify: `src/features/match/PreMatchLineupScreen.tsx`
- Extend: `src/features/match/pre-match-lineup.css`
- Modify: `tests/unit/features/match/PreMatchLineupScreen.test.tsx`
- Modify: `tests/unit/features/match/MatchFlow.test.tsx` as needed.

**RED first:**

- initializes `今回の戦術` from authoritative user tactics;
- allows independent local Serve/Attack/Block choices without writing normal tactics;
- `基本戦術に戻す` resets tactics only, not lineup;
- known opponent tendencies show only the three public categories;
- unknown PvP tendency says `戦術傾向 非公開` instead of guessing;
- matchup headline updates from `summarizeTacticMatchup` when local tactics change;
- start callback receives both cloned selection and local plan;
- CTA is exactly `この編成・戦術で試合開始`.

**GREEN:** render the tactics section above lineup presets, keep the existing lineup reset independent, and use bounded matchup labels (`相性有利 / 五分 / 相性注意`) rather than exposing raw numeric modifiers.

## Task 5: GameApp normal/PvP match-start plumbing and PvP opponent cards

**Files:**

- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/pvp/PvpScreen.tsx`
- Extend: `src/features/pvp/pvp.css`
- Modify/add relevant `GameApp` and `PvpScreen` unit tests.

**RED first:**

- normal pre-match sends both `matchSelection` and `matchTactics` on `advance-week`;
- PvP pre-match carries `selectedOpponent.tactics` when available;
- PvP challenge request sends both optional match selection and match tactics;
- opponent cards show three tactic chips when summary exists and `戦術傾向 非公開` when legacy summary is absent;
- public UI never renders `serveTargetPlayerId`, hidden abilities, or individual opponent data.

**GREEN:** extend `PreMatchContext`, `executeAdvanceWeek`, and `challengePvpTeam` with `MatchTacticPlan`; pass public PvP tendency into pre-match; add compact tactic chips to opponent cards.

## Task 6: Five-width mobile acceptance and regression

**Files:**

- Create: `tests/e2e/phase15-tactics-ux.spec.ts`
- Modify CSS only where tests reveal overflow/touch issues.

**Acceptance widths:** `320 / 360 / 390 / 414 / 480`.

**RED/GREEN coverage:**

- Player Hub four-tab navigation fits without horizontal overflow;
- tactics controls are readable and touch targets remain usable;
- normal tactics can be changed/saved and authoritative success feedback remains visible;
- pre-match tactics section fits and CTA remains reachable;
- tactic changes do not alter the lineup reset semantics;
- no horizontal overflow in tactics panels.

## Task 7: Final verification, PR, merge, and roadmap update

1. Run focused tests after each RED/GREEN cycle.
2. Run full `npm run verify` through PR CI.
3. Review the complete diff for scope, accessibility, privacy, and temporary artifacts.
4. Require exact-head PR CI: `dependency-audit`, `quality`, `mobile-e2e` all green.
5. Merge with `expected_head_sha`.
6. Require main push CI all green.
7. Update `docs/PROJECT_CONTEXT.md` so Phase 15 is complete and Phase 16 Match Command is next, then verify any resulting final main CI before claiming completion.

**Invariants:** schema remains v8; no second tactics persistence; pre-match overrides never persist; PvP legacy summaries are not guessed; no individual opponent privacy leakage; no Phase16 per-point commands are introduced.
