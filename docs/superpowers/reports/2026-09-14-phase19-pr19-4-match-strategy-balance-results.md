# Phase19 PR19-4 — Match Strategy / CPU Tactics Balance Results

## Scope

This report records deterministic evidence for Phase19 PR19-4 match difficulty and strategic identity work.

The PR connects CPU coaching decisions to PVE, separates defensive block configuration from the existing public PvP tactic plan, exposes opponent tactic changes during a match, and adds a deterministic tactical matchup matrix. PvP remains public-plan only and `MatchTacticPlan` remains the existing three-axis contract.

## Implemented behavior

- PVE CPU coaching decisions are applied to the authoritative match simulation path.
- Defensive block configuration is independently selectable without widening the PvP public tactic contract.
- Opponent tactic changes are surfaced to the player in the form `相手戦術変更 / ○○高校が速攻重視へ変更`.
- Attack-vs-block matchup identity is explicit and deterministic:
  - quick attack is favorable against read block and unfavorable against commit block;
  - side attack is favorable against commit block and unfavorable against read block;
  - balanced/mixed combinations remain neutral.
- The final matchup adjustment is `±12` simulation points for favorable/unfavorable edge combinations.

## Focused implementation verification

Before the balance matrix, the feature tasks were verified independently:

- Task 5 PVE CPU coaching connection: 5/5 focused tests passed plus TypeScript typecheck.
- Task 6 independent defensive positioning: 13/13 focused tests passed plus TypeScript typecheck.
- Task 7 opponent tactic-change presentation: 8/8 focused tests passed plus TypeScript typecheck.

## Tactical matrix calibration

The first deterministic matrix with the original `±3` matchup value showed the correct direction but insufficient gameplay separation:

- neutral: 50%
- favorable: 50%
- unfavorable: 49%
- +10 ability while tactically disadvantaged: 81%

The tactical edge was therefore increased without changing the matchup direction or widening the PvP public contract.

## Final deterministic matrix

Safe isolated workflow run `34817894501` completed successfully after calibration. Each listed series uses 160 deterministic matches.

| Scenario                      | Strength |    Result | Win rate |
| ----------------------------- | -------- | --------: | -------: |
| Balanced / neutral            | 80 vs 80 |  80 / 160 |    50.0% |
| Quick vs read / favorable     | 80 vs 80 |  86 / 160 |    53.8% |
| Quick vs commit / unfavorable | 80 vs 80 |  73 / 160 |    45.6% |
| Quick vs commit / +10 ability | 90 vs 80 | 133 / 160 |    83.1% |

The equal-strength favorable-to-unfavorable spread is **8.2 percentage points**, exceeding the required 3-point separation.

Additional identity aggregation from the same deterministic matrix:

- quick-attack identity average: 43.3%
- read-block identity average: 50.8%
- tactical matrix suite: 10/10 tests passed
- TypeScript typecheck: exit 0
- matrix patch/format/test/typecheck statuses: all exit 0

## Interpretation

### Tactics now matter at equal ability

The favorable and unfavorable equal-strength cases no longer collapse into random-noise-level separation. The 8.2-point spread is large enough for a player to receive meaningful feedback from selecting a counter while remaining far from an automatic win/loss rule.

### Ability remains the primary long-term advantage

A team with +10 ability still wins 83.1% of the deterministic series while using the unfavorable quick-vs-commit matchup. This preserves roster development and school strength as the dominant long-term progression system instead of allowing one tactical selection to erase a substantial ability gap.

### PvP information boundary remains stable

The balancing change is implemented inside the existing attack/block matchup resolver. It does not add hidden opponent state to the browser-facing PvP contract and does not expand `MatchTacticPlan` beyond its existing serve/attack/block public axes.

## Decision

Keep the calibrated `±12` matchup value. The deterministic matrix demonstrates both required properties: tactical counters materially affect equal-strength outcomes, while a +10 ability advantage still clearly outweighs an unfavorable tactical matchup.

Final acceptance requires repository-standard PR CI GREEN on the exact PR head and main CI GREEN on the exact squash-merge SHA.
