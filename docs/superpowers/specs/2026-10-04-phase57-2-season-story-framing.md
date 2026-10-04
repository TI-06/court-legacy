# Phase57-2 Season Story Framing

Date: 2026-10-04

## Purpose

Phase57-1 made annual goals rotate. Phase57-2 gives each season a compact identity so the player can immediately understand what kind of year this is.

## Derived season stories

The story is calculated from existing bounded state only:

- title-defense: previous national champion
- golden-generation: exceptional player or multiple elite players
- senior-window: senior-heavy roster
- rebuild: first-year-heavy roster
- national-chase: high starting national rank / national-level reputation
- breakthrough: high starting regional rank / prefectural-level reputation
- foundation: fallback

Priority is deterministic so the story does not oscillate between categories.

## Home presentation

The existing season card shows:

- season story label
- short headline
- focus label
- current primary annual goal
- regional / national rank

No new top-level screen or additional dashboard section is added.

## Persistence

No story field is persisted.

- no schema bump
- no new arrays
- no history growth
- O(roster + bounded tournament history) selector
- existing season-goal persistence remains unchanged

## Next slice

Phase57-3 will add at most two season turning points derived from the season story and high-value calendar moments such as tournament preparation, rivalry matches, and camps.
