# Phase61-2 — Premium Home Command Desk

Refresh the Home screen to a mobile sports-manager game layout. Keep existing Home model selectors, task priority, notifications, practice-offer confirmation, week transition, save commands and routes intact.

## Structure

1. Coach briefing hero, subtle SVG-free court geometry, in-game week + camp.
2. Next official match: emphasized match card with large tournament action (44px).
3. Compact season narrative + prefectural/national ranking; featured rival if any.
4. Three status tiles: strength, condition, cohesion.
5. Coach decisions (two surfaced, rest in existing accessible sheet) and one latest event.
6. An independent fixed-area '今週を進める' action above 5-tab bottom navigation.

## Small screens

- Uses the existing one-screen Home grid. On very short screens content in the flexible upper area can scroll independently rather than clip critical actions; week transition and bottom nav remain in view.
- 320/390/430px supported; major actions at least 44px; focus/disabled/reduced-motion styles preserved.
- Purely presentational styles scoped beneath game-page-frame, not auth screens.

## Tests and safeguards

- CI: Prettier, lint, typecheck, unit, build, soak smoke, mobile E2E.
- E2E: narrow viewport, fixed bottom action above navigation, press/tabs, no horizontal overflow, operation pending disabled.
- No changes to domain logic, routing, persistence format or save operations.
