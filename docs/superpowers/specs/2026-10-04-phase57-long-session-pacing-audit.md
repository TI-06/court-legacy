# Phase57-4 Long-session pacing audit

Date: 2026-10-04

## Purpose

Measure where long-term play becomes repetitive before changing the game loop again.

The audit extends the existing deterministic soak report only. It does not add save-state fields.

## Metrics

- progression actions required across all simulated weeks
- average progression actions per week
- maximum progression actions in one week
- total resolved events and weeks containing an event
- total completed matches and weeks containing a completed match
- interactive weeks containing either an event or match
- quiet weeks where the only required progression action is advance-week
- longest consecutive quiet-week streak

Management-policy actions are excluded from the pacing density calculation because the soak purchases upgrades automatically and those actions are not mandatory weekly player interactions.

## Interpretation

A high average action count can mean friction if it comes from repeated mandatory handling.

A very long quiet-week streak indicates repeated next-week presses with no meaningful interruption.

The target is not to maximize events. The desired rhythm is a mix of quiet development weeks and meaningful peaks around tournaments, camps, rivalries, and roster transitions.

## Persistence

- no schema change
- no new game-state fields
- no history growth
- diagnostics live only in the soak report
