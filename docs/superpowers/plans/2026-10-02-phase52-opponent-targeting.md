# Phase52 Opponent Targeting Implementation Plan

**Goal:** 試合中に相手個人を対象にしたサーブ狙い・ブロック警戒を追加し、監督としてのプレイヤー介入を強化する。

**Spec:** `docs/superpowers/specs/2026-10-02-phase52-opponent-targeting-design.md`

## PR52-1 Domain / Simulation foundation

### Task 1: Match contract

Modify:

- `src/domain/model/Match.ts`

Add:

- MatchCommand
  - `target-serve-receiver`
  - `mark-opponent-attacker`
- runtime
  - `serveTarget`
  - `blockTarget`

### Task 2: Command validation

Modify:

- `src/domain/match/applyMatchCommand.ts`
- `tests/unit/domain/match/phase16MatchCommands.test.ts`

Validation:

- opponent side target only
- serve target = court + libero
- block target = rotation OH/MB/OP
- set-break rejected
- invalid command leaves original match untouched

### Task 3: Simulation effect

Modify:

- `src/domain/match/simulateMatch.ts`
- focused deterministic tests

Rules:

- temporary serve target takes priority over persistent serve target
- temporary serve target selection chance 82%
- block target gives +6 blockPower only when target attacks
- decrement both after each rally
- clear both at set boundary

## PR52-2 Mobile UI / Presentation

### Task 1: Target sheet

Modify:

- `src/features/match/MatchCommandPanel.tsx`
- relevant CSS
- UI tests

Add:

- `相手を狙う` button
- serve target player buttons
- block target player buttons
- no ability grades for opponent

### Task 2: Live effect presentation

Modify:

- `src/features/match/matchCommandPresentation.ts`
- `src/features/match/MatchScreen.tsx`

Display:

- active serve target + remaining rallies
- active block target + remaining rallies

### Task 3: Result impact

Include both command kinds in existing five-rally point split.

## PR52-3 Worker / PVE / Official / Invitational / PvP review

### Task 1: canonical action paths

Verify:

- practice
- official
- invitational
- PvE
- PvP challenger

All should reuse existing match-command route.

### Task 2: privacy

Verify public PvP responses do not expose opponent abilities / traits.

### Task 3: reload

Test activeMatch persistence during target instruction.

## PR52-4 Balance / E2E

### focused tests

- same seed without target vs with serve target
- same seed without block target vs with target
- target expires after five rallies
- target clears at set boundary
- persistent tactics unchanged

### E2E

- 390px mobile
- target sheet visible
- no footer overlap
- player buttons tap-safe
- result screen shows command impact

### regression

- Phase16 commands
- Phase22 skip
- Phase51 invitational matches
- save endurance
- full CI

## Non-goals

- manual command every rally
- full FIVB tactical system
- libero specialized substitution rules
- opponent hidden stats display
- permanent per-player matchup plans
