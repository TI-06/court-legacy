# Phase59-1 — Time-limited scouting competition

## Problem

Four- and five-star candidates currently display competing school names, but rivals never make a signing. This turns recruitment competition into a cosmetic label.

## Scope

- Record the calendar week when the latest scouting search was executed.
- Four-star candidates: competitor decisions after 6–8 weeks.
- Five-star candidates: competitor decisions after 4–6 weeks.
- Timing is deterministic by save seed, candidate and scouting cycle. Rendering and reloading cannot reroll an outcome.
- If the deadline expires before the user commits, the competitor signs and the candidate cannot be recruited, visited or recommended.
- Already committed recruits remain protected.
- Old saves and old in-progress searches without a recorded search week receive no retroactive deadline.
- The existing candidate pool, candidate truth privacy, search and negotiation flow remain authoritative on the Worker.
- Only a compact optional search-week number is persisted in recruiting; no new unbounded lists or schema-version increment.

## UI

Display the competitor-school count and the remaining weeks on an active candidate card. After a rival signing, display the selected school name and disable the entry's recruitment action. Reject stale client requests in the Worker using a distinct error.

## Excluded from Phase59-1

The competing school winning the recruitment does not yet add that exact candidate to its year-end roster. That requires a follow-up integration with NPC school intake and 10/30-year world simulation. Do not present it as implemented.

## Acceptance

1. Reloading or repeating a report yields the same deadline and competitor.
2. Signing before the deadline protects the candidate.
3. Expired candidates reject all recruitment actions server-side.
4. Old recruiting saves load and do not lose candidates retroactively.
5. Searches started in a new year reset the timeline.
6. Existing V5 save-delta, live match, PvP and mobile flows remain unchanged.
7. Verify with `npm run verify`, mobile E2E at 320/360/390/414/480 px, and 10/30-season soak.
