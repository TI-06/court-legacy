# Phase 12 — Game Loop / Navigation Polish Design

Date: 2026-09-01
Branch: `feature/phase12-game-loop-polish`
Base: `main` (`d92b5d92876d86ebad70c4e98bfe832dc374d6fe`)

## Goal

Phase 12 tightens the mobile game loop after Phase 11. The player should be able to understand the current week, set player-specific training without a dedicated Training tab, handle practice-match decisions from Home, review school/scouting information from one School tab, and always receive clear full-screen feedback while server-authoritative operations are running.

This is a real gameplay change, not a visual-only rearrangement. Domain state, weekly resolution, save compatibility, server actions, UI, and tests must stay aligned.

## Approved product decisions

### Bottom navigation

Replace the current five tabs:

`ホーム | 選手 | 育成 | 試合 | その他`

with:

`ホーム | 選手 | 学校 | 試合 | その他`

The dedicated `育成` tab is removed.

### School ownership

The School tab becomes the home for school-management features and contains four internal views:

1. 設備
2. スカウト
3. 記録
4. 卒業生

Scouting moves out of the old Training flow and into School.

`その他` is reduced to non-school utility/account destinations such as Shop, settings, and account/sign-out. School must not remain duplicated under `その他`.

### Individual training

Player-specific training is simplified to six player-facing choices:

- 全体
- 攻撃
- 守備
- 跳躍
- 体力
- 休養

The UI should use compact choice chips/cards suitable for 320–480 px mobile widths.

`休養` gives the selected player `condition +25` for the week, clamped to the internal 0–100 range, instead of applying normal growth.

The removed Training tab does not mean training disappears from the game loop. Team/individual training state must remain server authoritative and continue to resolve during weekly progression.

### Condition and fatigue

`condition` remains an internal integer from 0 to 100.

The player-facing UI displays condition as five levels/icons rather than exposing the raw number. The five levels apply the following match-performance modifiers:

- best: +8%
- good: +4%
- normal: 0%
- poor: -4%
- worst: -8%

Weekly condition receives a small seeded/random fluctuation as part of week progression so condition is not static.

`fatigue` is retained only for backward save compatibility in Phase 12. It is not used as an active gameplay modifier for training, matches, auto-rest, or injury calculation. Existing legacy saves containing fatigue must continue to decode.

### Injury calculation

Injury resolution should use the active training menu's injury rate together with player and school factors:

- menu/base injury risk
- player injury resistance
- relevant facility effect
- current condition

Fatigue must not participate in the Phase 12 injury formula.

The calculation must remain deterministic under the existing seeded-random/server-authoritative action model.

### Home practice-match decisions

Incoming practice-match offers should be actionable from Home. The user can accept or decline there without first navigating into the Match tab.

The Match tab continues to own practice-match planning/details and match presentation. Home only exposes the immediate decision/action required for the current week.

### Full-screen operation feedback

Long-running server-authoritative actions should use a blocking full-screen loading state rather than relying only on the small operation status bar.

At minimum, this applies to operations that mutate the game and temporarily make navigation unsafe, including week advancement and comparable game-state mutations.

The overlay must:

- prevent duplicate input/navigation while submitting;
- display the current operation message;
- disappear on success or failure;
- not hide the recoverable error/retry state after failure;
- remain usable at mobile widths.

## Approaches considered

### A. Keep Training as a tab and add School elsewhere

Lowest code movement, but it preserves an overloaded navigation model and keeps school/scouting split across unrelated destinations. Rejected.

### B. Replace Training with School and redistribute training interactions

Recommended and approved. School management/scouting become coherent, while player training becomes part of player management and weekly progression rather than a top-level destination. This keeps the five-tab mobile shell intact.

### C. Add School as a sixth bottom tab

Avoids moving Training, but six mobile tabs reduce tap targets and increase information architecture complexity. Rejected.

## Architecture

### Navigation shell

`src/ui/shell/appNavigation.ts` changes the `AppTab` union and navigation definition from `training` to `school`.

`GameApp` must route `school` directly to the School feature. Existing `moreView === "school"` routing is removed.

### School feature

`SchoolScreen` expands its local view state from:

`facilities | records | alumni`

to:

`facilities | scouting | records | alumni`.

The Scouting UI should remain a focused component; it should not be copied into SchoolScreen. SchoolScreen/GameApp owns the internal navigation, while `ScoutingScreen` continues to own candidate rendering, recruitment, shop-target actions, loading, retry, and error presentation.

### Player / training feature

Player-specific training controls should live with the player-management flow rather than recreating a full Training screen under School or More.

The existing server-side weekly training plan remains the source of truth. Phase 12 changes the player-facing instruction vocabulary and weekly resolver behavior while preserving authoritative mutation through `runAction`/worker actions.

### Weekly progression

Week advancement remains a single authoritative action. The weekly pipeline must:

1. resolve selected team/player training;
2. apply rest behavior where selected;
3. update condition with bounded seeded fluctuation;
4. resolve injuries using the Phase 12 injury inputs;
5. resolve scheduled practice/official activity;
6. produce the weekly report/notification;
7. advance the calendar and persist the resulting state.

No client-side growth, injury, condition, or match outcome calculation is authoritative.

### Persistence

Because gameplay semantics change while existing saves must continue working, increment `CURRENT_GAME_SCHEMA_VERSION` only if the serialized shape changes. If the Phase 12 implementation can preserve the current shape (`condition` and legacy `fatigue` remain present, weekly schedule shape remains compatible), avoid an unnecessary schema bump.

If instruction identifiers or serialized weekly-plan shapes change, add an explicit migration with regression tests for older saves.

## UI behavior

### Home

Home should prioritize the next action for the week. When an incoming practice-match offer exists, show accept/decline controls in the Home action area. Pending operations disable both actions.

### Player

Individual training choices use compact chips/cards. The selected instruction must be visually obvious without requiring raw internal IDs.

Condition is shown as a five-level visual indicator. Raw `condition` values remain internal.

### School

The School screen keeps a compact hero/header and uses four segmented internal views. Mobile vertical space should favor the active content; avoid duplicating explanatory text already visible in cards.

### More

More contains Shop, settings/account-related actions, and sign-out. It does not contain School or Scouting.

### Loading

A reusable full-screen loading component should be mounted at the app-shell level so every feature gets consistent blocking behavior during authoritative mutations.

## Error handling

- Existing `revision_conflict` recovery/idempotent retry behavior remains intact.
- A loading overlay must always clear in `finally`/settled operation state.
- Scouting and Shop retain their feature-specific retry/error UI after the global overlay clears.
- Practice-match accept/decline must not allow duplicate submission while an operation is already pending.
- Invalid or legacy training instruction values must fail safely or migrate explicitly; never silently reinterpret unknown IDs.

## Testing

### Domain/unit

Add or update tests for:

- six individual training choices;
- rest applies `condition +25` and no normal growth;
- condition remains clamped to 0–100;
- five condition bands map to +8/+4/0/-4/-8 match modifiers;
- weekly condition fluctuation is seeded/deterministic;
- injury probability uses menu risk, injury resistance, facility effect, and condition;
- fatigue changes do not alter Phase 12 gameplay outcomes;
- legacy save decoding still accepts fatigue;
- schema migration only when serialized instruction/state shape requires it.

### App/feature

Add or update tests for:

- bottom nav labels are `ホーム / 選手 / 学校 / 試合 / その他`;
- no top-level `育成` tab exists;
- School exposes `設備 / スカウト / 記録 / 卒業生`;
- Scouting is reachable from School and no longer from Training;
- More no longer exposes School;
- Home can accept/decline incoming practice-match offers;
- player training chips save the expected authoritative instruction;
- condition is rendered as five-level presentation rather than raw value;
- full-screen loading blocks interaction while an action is submitting and clears afterward.

### E2E/regression

Update mobile flows at 320–480 px widths and run the normal repository quality gates. Existing PvP, official tournament, Shop, scouting recruitment, Home week progression, save migration, and idempotent retry coverage must remain green.

## Acceptance criteria

Phase 12 is complete when:

- the bottom navigation is `ホーム | 選手 | 学校 | 試合 | その他`;
- the old Training top-level tab is gone;
- School contains Equipment, Scouting, Records, and Alumni;
- individual training uses the approved six choices and affects real weekly resolution;
- rest raises condition by 25;
- condition has five match-impact levels with approved modifiers;
- fatigue is gameplay-inactive but legacy-save compatible;
- injury resolution uses the approved Phase 12 factors;
- incoming practice-match offers can be accepted/declined from Home;
- authoritative mutations show blocking full-screen loading feedback;
- mobile/unit/E2E regression tests pass;
- normal CI is green before merge to `main`.
