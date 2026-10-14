# Phase59-2 — Rival academy enrollment from lost recruitment

## User impact
When an uncommitted ★4 or ★5 candidate loses the scouting race, the rival school that won the recruitment receives that **same player** in the next academic year. Their ID, attributes, position, talents and roster membership persist across subsequent match and season systems.

## Architectural boundaries
- Only the Worker reads the authoritative candidate pool and scouting insights.
- The resolving school's stable `SchoolId` is derived from the exact same deterministic rival selection used for the candidate report. A displayed short name is **not** used as the identity key.
- Rival intake is passed through the annual progression context without inserting candidate private details into player-visible recruiting state.
- Already committed candidates are protected; no retroactive loss.
- NPC roster caps are respected. Existing returning players take priority; if a school is full, no extra candidate is inserted.
- The yearly transition consumes the rival intake once. It is not persisted as a parallel permanent roster or unbounded history.
- Save schema and network protocol remain unchanged.

## Current bounded scope
ScoutingStore retains only the **latest search pool** for each cycle. This phase can enroll rival-signed players present in that authoritative pool at the year transition. Older replaced search pools cannot be reconstructed with exact tier, abilities and bonuses and are intentionally skipped instead of inventing traits or claiming identity continuity.

## Acceptance
1. A 5-star candidate whose timer expires can enroll at the correct rival SchoolId.
2. The exact candidate PlayerId and abilities survive the year transition.
3. The player cannot simultaneously enroll at the user's school.
4. A signed-by-user player remains protected.
5. Late searches that have not reached the deadline are excluded.
6. NPC school roster cap, graduates and deterministic generation remain valid.
7. Existing 10/30-year soak, V5 saving, quality and mobile E2E remain passing.

## Follow-up
Preserve bounded server-side historic scouting pool/signing records across further searches to support multi-search rival tracking without exposing unrevealed player abilities or enlarging client saves.
