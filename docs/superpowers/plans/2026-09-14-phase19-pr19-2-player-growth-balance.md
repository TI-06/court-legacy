# Phase19 PR19-2 — Player Growth / Talent Balance

## Goal

Make growth types meaningfully different over a three-year high-school career while keeping talent tier and potential responsible for the final ceiling. Restore the currently-unused match-growth identity without weakening PvP authority boundaries.

## Constraints

- Keep save schema v8 unchanged.
- Do not change scouting/talent rarity in this PR.
- Do not mutate player growth from the PvP browser/client path.
- Solo practice and official matches may grant experience only at their authoritative completed-result transition.
- Replaying/retrying a completed match must not grant growth twice.
- Match experience must remain smaller than a normal week of focused training.
- Reuse one canonical long-term ability ceiling/dampening implementation for training and match experience.

## Task 1 — RED: canonical ceiling and growth curves

Add focused unit tests proving:

- higher potential/tier never lowers the ceiling;
- grade-1 early growth beats grade-1 late growth;
- grade-3 late growth beats grade-3 early growth;
- practice growth favors `growth.practice` over `growth.match`;
- growth near the ceiling is damped and never exceeds the ceiling.

The new tests must fail before production implementation.

## Task 2 — Extract canonical player development policy

Create a domain player-development module that owns:

- long-term ability ceiling calculation;
- long-term ability growth application;
- grade multiplier lookup;
- practice/match growth-factor helpers shared by callers.

Move the current ceiling/tier bonus and 80/90/95 dampening out of `resolveWeeklyTraining.ts`. Preserve existing training behavior except where the duplicate policy is intentionally removed.

## Task 3 — RED: match experience identity

Add focused tests proving:

- `growth.match` gains more match experience than `growth.practice` under the same conditions;
- `growth.adversity` gains an additional bounded bonus after a loss and/or against a stronger opponent;
- non-participants receive no match growth;
- match experience is bounded below weekly focused training growth;
- repeated application for the same completed match is idempotent at the game-action boundary.

## Task 4 — Implement solo authoritative match experience

Introduce a deterministic match-experience resolver. Use the user team's actual selected participants (starters/libero/bench only if they appeared or the match model cannot distinguish appearances; prefer actual runtime/stat participation when available).

Apply a small base experience amount multiplied by grade and `matchMultiplier`, with a bounded adversity context modifier. Route every ability increment through the canonical ceiling helper.

Hook it only after a solo practice or official match reaches `match-complete` and before the completed state is returned. Existing weekly-action/tournament completion guards remain the idempotency boundary.

Do not add this logic to PvP challenge/session client handling.

## Task 5 — Focused verification

Run typecheck plus focused player-development, weekly-training, practice-match, official-tournament and command/idempotency suites. Fix root causes before broader verification.

## Task 6 — Balance evidence

Run deterministic 10-season and 30-season soak samples using the established seeds. Record evidence that:

- early/late curves remain distinguishable;
- `growth.match` is no longer structurally disadvantaged;
- `growth.practice` is not universally dominant;
- rare high-potential players can separate from normals without broad 100 saturation;
- CPU strength gains from PR19-1 remain intact.

Only tune bounded constants when evidence shows a clear imbalance.

Evidence report: `docs/superpowers/reports/2026-09-14-phase19-pr19-2-player-growth-balance-results.md`.

## Task 7 — Release-quality verification

Run `npm run verify`, release metadata check, soak smoke, mobile E2E and any Phase19-specific focused checks. Open a PR only after the candidate is locally/isolated-run GREEN.

Then require exact-head PR CI GREEN, squash merge, and exact merge-SHA main CI GREEN before declaring Phase19-2 complete.
