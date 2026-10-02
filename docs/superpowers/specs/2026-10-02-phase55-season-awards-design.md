# Phase55 Season Awards Design

Date: 2026-10-02

## Goal

Turn Phase54 current-season official stats into meaningful end-of-year recognition without adding bulky history payloads.

Phase55 starts with user-school annual awards because only the user school currently has authoritative per-player official match stats.

## Award categories

- 年間MVP
- ベストアタッカー
- ベストブロッカー
- ベストサーバー
- ベストレシーバー
- ベストセッター

Awards are based only on the completed academic year's official-match `PlayerSeasonStats`.

## Selection principles

- minimum sample thresholds prevent one-play winners
- position relevance matters
- ties are deterministic
- no hidden ability values are used to decide awards
- awards reflect actual season performance, not potential or reputation

### MVP

Weighted all-around score from:

- total points
- attack efficiency with sample gate
- blocks
- service aces
- receive contribution
- setting contribution
- defensive contribution
- appearance volume

### Specialist awards

- attacker: attack points + attack efficiency, minimum attack attempts
- blocker: blocks, then appearances
- server: service aces, then appearances
- receiver: perfect receive rate with minimum receive attempts
- setter: ideal sets with minimum appearances

If no player meets the minimum sample for a category, that award is omitted.

## Persistence strategy

PR55-1 is pure selection only and does not mutate saves.

Later PRs may append compact award IDs to the existing `Player.career.awardIds`.
A player can only receive a bounded number of annual awards across a three-year school career, so save growth stays tiny and predictable.

No new top-level history array is required.

## UX direction

At academic-year transition:

- show a compact 年間表彰 result sheet
- MVP first
- specialist awards below
- allow tapping active returning players into player detail

Player career record:

- show award count initially
- later expose named awards in a compact list

## PR split

- PR55-1: deterministic annual award selection foundation
- PR55-2: year-end persistence + transition result
- PR55-3: player detail award history + school awards archive if needed
- PR55-4: long-run/save-size/regression gate
