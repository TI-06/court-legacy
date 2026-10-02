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

## Phase54-2 Current-season leaderboard

Phase54-2 adds one optional bounded `seasonStats` object to players who actually receive official-match stats.

The accumulator contains only the current academic year's official-match totals:

- appearances / sets
- points
- attack points / attempts
- blocks / service aces
- receive attempts / perfect receives
- defense points / ideal sets / successful digs

### Save-size rules

- generated world players do not receive the field
- only user-school players touched by official-match recording receive it
- one object per player maximum; no per-match season-stat history
- a stale academic-year object is treated as zero immediately
- the first official match of a new academic year replaces the stale object
- no schema-version bump is required because the field is optional and current saves already preserve passthrough player data

### Team leaderboard UX

Player Hub receives an `今季成績` action instead of a fifth top-level tab.

The action opens a compact BottomSheet containing TOP3 for:

- points
- blocks
- service aces
- attack success rate
- perfect receive rate

Rate rankings require at least five attempts.

Selecting a ranked player opens that player's 成績 tab. The player detail shows current-season official stats separately from career totals.

Practice and invitational matches do not update this accumulator.
