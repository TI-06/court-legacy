# Phase54 Player Career Records Design

Date: 2026-10-02

## Goal

Turn the match statistics already recorded on Player.career into visible long-term player history without increasing save size.

## Scope

Phase54-1 only exposes existing authoritative career data:
- official match appearances
- sets played
- points
- blocks
- service aces
- points per appearance
- captain seasons
- best tournament result
- earned award count

No new persistent field is introduced in the first step.

## UX

Add a fourth player-detail tab: 成績.

The screen stays mobile-first and compact:
- career headline
- five core stat cards
- points per appearance
- best tournament result
- captain seasons / awards
- explicit note that these are official-match career totals

Do not mix practice-match statistics into official career totals.

## Performance / persistence

- zero save migration
- zero additional match-history payload
- presentation-only derivation from Player.career
- O(1) per opened player

## Follow-up direction

Phase54-2 may add a user-school season leaderboard using a compact bounded accumulator, but only after the display foundation is stable and save impact is reviewed.
