# Phase57 Season Variety — Design

Date: 2026-10-04

## Problem

Long-term play currently repeats the same three season-goal axes every year:

1. regional rank
2. official wins
3. tournament achievement

The rest of the game has gained rivals, scouting, team identity, player careers, awards, practice recommendations, and long-term school records, but the yearly decision loop still opens with almost the same objective structure.

## Goal

Make consecutive seasons feel different without adding a large new system or increasing save growth.

## Phase57-1: rotating season focus

Keep exactly three season goals, but rotate the first goal deterministically by academic year:

- cycle A: regional rank improvement
- cycle B: national rank improvement
- cycle C: team-identity mastery

The other two goals remain:

- official wins
- tournament achievement

This creates a three-season strategic rhythm:

- local climb season
- national climb season
- style-building season

## Identity mastery target

The target is derived from mastery at season start and the selected ambition.

- steady: current mastery + 10
- challenge: current mastery + 20
- bold: current mastery + 30
- cap: 100

Changing philosophy mid-season can therefore sacrifice progress, which is an intentional strategic tradeoff.

## Compatibility

- keep exactly three goals
- no save schema version bump
- old saves containing only the original goal kinds remain valid
- codec accepts the new goal kinds
- archived season summaries remain bounded to the existing 30-season limit
- no new history arrays

## Later Phase57 slices

### Phase57-2: calendar pressure variation
Add a small set of bounded seasonal situations around tournament preparation, camps, injuries, and rivalry weeks instead of adding more permanent screens.

### Phase57-3: generation story
Make graduation/newcomer turnover more visible through compact season-opening and season-ending summaries.

### Phase57-4: long-session pacing audit
Measure repeated weekly actions, screen visits, save size, and match frequency over 10/30 seasons and remove low-value repetition.

## Acceptance

- consecutive seasons do not always receive the same three goal kinds
- ambition still scales difficulty and reward
- old saves decode unchanged
- exactly three goals remain
- no unbounded persistence
- existing season reward and archive flows continue to work
