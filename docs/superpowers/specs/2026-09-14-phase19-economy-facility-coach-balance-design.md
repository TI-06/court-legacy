# Phase19 PR19-3 Economy / Facility / Coach Balance Design

## Goal

Make school management spending feel deliberate over long saves: annual income should support meaningful choices, facilities must be practically reachable up to Lv.50 without repetitive tapping, and assistant coaches must be usable as a real annual contract system.

## Economy

- Preserve reputation-based budget tiers.
- Raise annual school budgets to: unknown 450, district-contender 560, prefectural-power 730, national-qualifier 950, national-regular 1230, elite 1570.
- Existing alumni-association annual bonus remains additive.
- Do not add passive debt or automatic purchases.

## Facilities

- Facility cap remains Lv.50.
- UI offers exactly +1, +5, +10 upgrade choices.
- Cost is the exact sum of every intermediate level's existing single-level formula.
- Bulk purchase is atomic: if the full cost is unavailable, apply nothing.
- A purchase that would cross Lv.50 is invalid; the user must choose a smaller valid step.
- Worker action accepts optional `levels`; omitted means +1 for backward compatibility.

## Assistant coaches

- Existing four coach ranks/effects remain the starting balance.
- A contract is valid only for the current academic year.
- Only one assistant coach contract may be purchased in the same academic year.
- School UI must call the authoritative worker action; the current disconnected/disabled production path is fixed.
- Year transition semantics continue to control contract expiry/reset.

## UI

- Facility detail sheet shows +1/+5/+10 as compact mobile-first choices with target level, aggregate cost, and resulting funds.
- Unaffordable or cap-crossing choices are disabled with readable status.
- Staff tab shows the current contract and disables further same-year purchases with an explicit message.

## Verification

- TDD contracts cover budgets, aggregate cost, atomic bulk purchase, Lv.50 boundaries, and annual coach uniqueness.
- Worker/schema tests cover valid and invalid level counts and backward-compatible +1 actions.
- School UI tests cover bulk selection and production callback wiring.
- Deterministic 10-year and 30-year balance evidence checks facility reachability and money pressure without making every facility automatically maxed.
- Full `npm run verify`, official PR CI, squash merge, and post-merge main CI must be GREEN.

## Non-goals

- No PvP authority/privacy/idempotency changes.
- No player-growth retuning; that is PR19-2.
- No match difficulty or strategic identity changes; that is PR19-4.
