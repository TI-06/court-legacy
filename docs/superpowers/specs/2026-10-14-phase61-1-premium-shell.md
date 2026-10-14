# Phase61-1 — Premium mobile shell foundation

## Scope

Shared premium navy / cyan / orange game tokens; compact school-name/date/cloud
status header with CL badge; existing five-item navigation restyled without
changing labels or actions; standardized GameButton adopted by the existing
StickyActionBar; choice cards/chips and BottomSheet gain premium dark surfaces.

The new stylesheet is scoped to the `game-page-frame` so light secondary
surfaces and login remain legible during the later per-page redesign.

## Non-goals

No data migrations, game mechanics, roster logic, save changes or extra
network requests. No full-screen makeover yet: Phase61-2 through 61-6
replace the individual screens in focused PRs.

## Acceptance

320 / 390 / 480px test viewport, readable date and navigation, >=44px
navigation buttons, no horizontal overflow, bottom navigation visible,
reduced-motion compliant, existing focus trap and disabled button behavior
unchanged. Full lint/typecheck/unit/build/soak/mobile CI must be green.
