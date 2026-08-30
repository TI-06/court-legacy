# Court Legacy V2 Phase 7 — Team Dynamics Implementation Progress

## Scope

Phase 7 adds persistent, server-authoritative team dynamics and leadership to the endless high-school volleyball loop. Training, player roles, morale/trust, lineup continuity, leadership, official-match usage, and annual progression now feed a bounded cohesion model while ranked PvP remains isolated from these progression-only effects.

Base branch: `feature/court-legacy-v2-phase6-official-tournaments`  
Base SHA: `dce183f2477fc304a4aa37f101e7bd87102f75dd`  
Implementation branch: `feature/court-legacy-v2-phase7-team-dynamics`

Design: `docs/superpowers/specs/2026-08-29-phase7-team-dynamics-design.md`  
Plan: `docs/superpowers/plans/2026-08-29-phase7-team-dynamics.md`

## Implemented

- Added persistent `teamDynamics` state and schema v4 migration without rerolling the existing world.
- Added bounded cohesion, previous cohesion, trend, lineup continuity, recent official starter usage, player roles, and player concerns.
- Added persistent player morale/trust participation in dynamics progression.
- Added deterministic weekly dynamics progression from training, roles, leadership, and lineup continuity.
- Added deterministic official-match feedback into cohesion, morale/trust, usage history, and concern derivation.
- Added annual dynamics progression that removes stale graduating-player references and carries valid current-roster leadership/state forward.
- Added server-authoritative captain and vice-captain assignment with current-roster validation, distinct-player validation, revision control, and operation-id exact-once behavior.
- Added browser authority boundaries so clients submit only captain/vice player IDs and cannot submit cohesion, suitability, role, concern, trust, morale, or other derived values.
- Added Team Dynamics management UI, leadership selectors, cohesion/trend/relationship/concern views, player role/trust/morale indicators, and Home cohesion summary.
- Added mobile-safe Team Dynamics coverage at 320px, 360px, 390px, and 480px.
- Kept Team Dynamics out of ranked PvP registration, published snapshots, and ranked simulation inputs.

## Task 9 Full CI defect found and fixed

The first normal Full CI after the Team Dynamics UI implementation failed quality because `TeamDynamicsPanel.tsx` synchronized the leadership editor with a `useEffect` that called `setState`, which is rejected by the repository's React Hooks lint policy.

Failure evidence:

- Workflow run `33285408292`, quality job `99187631776`.
- Failure: `react-hooks/set-state-in-effect` in `src/features/team/TeamDynamicsPanel.tsx`.
- Mobile E2E was skipped because quality failed first.

Fix:

- Commit `954612b7fef264b25c8221500fca736a301b1752` — `fix: sync leadership editor without effect`.
- Moved the local leadership draft state into a keyed `LeadershipEditor` child component.
- The editor key derives only from server-authoritative captain/vice IDs, so successful authoritative updates remount the editor with persisted values without effect-driven state synchronization.
- No lint suppression was added.

GREEN evidence:

- Workflow run `33286950234`.
- Quality job `99191680271`: success.
- Mobile E2E job `99191957537`: success.
- Full browser suite: 33 / 33 tests passed.

## Long-run dynamics verification

Added `tests/unit/domain/dynamics/teamDynamicsLongRun.test.ts`.

30-year equal-seed verification confirms:

- identical dynamics snapshots from identical seeds;
- deterministic leadership selection and academic-year progression;
- no random-cursor divergence caused by the new dynamics layer.

100-year soak verification confirms on every academic-year transition:

- cohesion, previous cohesion, lineup continuity, morale, and trust remain in range;
- recent official match tracking remains bounded;
- leadership IDs, role keys, concern keys, and starter-count keys refer only to the current roster;
- captain and vice-captain never resolve to the same player;
- role/concern/usage maps remain bounded by current roster size;
- graduating/stale leadership references do not survive year progression.

The final normal quality run below executes these tests as part of the complete unit suite.

## Ranked PvP isolation and authority review

Reviewed the Phase 6 → Phase 7 diff and the dedicated security/regression tests.

Confirmed:

- ranked registration payloads reject Team Dynamics data;
- ranked snapshot projection does not publish Team Dynamics;
- even when cohesion is directly injected as 0 vs 100, the same ranked seed produces the same ranked result;
- browser dependency assembly accepts only captain/vice IDs for leadership changes;
- foreign-school, stale-player, and same-player captain/vice assignments are rejected;
- stale revisions are rejected before mutation;
- `operationId` caching and persistent operation application preserve exact-once behavior;
- derived cohesion, suitability, roles, concerns, morale/trust, and effects remain server/domain authority;
- schema v3 → v4 migration initializes Team Dynamics without rerolling world state or consuming progression RNG.

## Task 10 browser and mobile verification

Added `tests/e2e/team-dynamics-flow.spec.ts` and extended `tests/e2e/mobile-layout-audit.spec.ts`.

The E2E flow verifies through the browser-backed server snapshot path:

1. open Team Dynamics;
2. assign captain and vice-captain;
3. persist the server-authoritative leadership update;
4. execute weekly training;
5. start and persist an official match;
6. confirm official-match usage/dynamics persistence;
7. return to Team Dynamics and confirm persisted leadership/cohesion are visibly reflected.

Mobile verification covers 320px, 360px, 390px, and 480px and checks both Team Dynamics body-width safety and the repository-wide mobile layout audit.

During Task 10, the first new E2E run exposed a Playwright locator ambiguity: the non-exact label `主将` also matched `副主将` and `主将適性`. The test was corrected to exact accessible-label matching without weakening any product assertion.

Final browser evidence:

- Workflow run `33287549052`.
- Mobile E2E job `99193560818`.
- **38 / 38 Playwright tests passed in 51.4 seconds.**
- No Playwright diagnostic artifact was required because the suite was fully green.

## Full verification evidence

Final pre-documentation code verification:

- Workflow run `33287549052`.
- Quality job `99193270892`: success.
- `npm run verify` passed every stage:
  - Formatting
  - Lint
  - Type check
  - V2 architecture structure guard
  - Production dependency audit
  - Unit tests, including 30-year deterministic and 100-year soak coverage
  - Production build
- Mobile E2E job `99193560818`: success, 38 / 38 tests passed.

`npm ci` still reports the existing dependency-tree advisory count of 7 vulnerabilities (3 moderate, 4 high). The production dependency audit inside `npm run verify` passes. The existing Vite large-chunk warning remains non-blocking.

## Final diff and workflow review

Latest Phase 6 → Phase 7 comparison before this documentation commit:

- status: ahead;
- ahead by: 100 commits;
- behind by: 0 commits;
- merge base: `dce183f2477fc304a4aa37f101e7bd87102f75dd`.

Reviewed for:

- stale leadership IDs across academic-year rollover;
- unbounded dynamics/usage/concern maps;
- browser-supplied derived Team Dynamics values;
- revision and operation-id exact-once behavior;
- schema v4 migration safety;
- Team Dynamics leakage into ranked PvP registration, published snapshots, or simulation;
- 320/360/390/480px mobile overflow;
- temporary GitHub Actions workflows.

After cleanup, `.github/workflows` contains only the repository's normal `ci.yml` workflow.

## Remaining release action

Run the normal branch CI on this documentation commit, then open a stacked Draft PR from `feature/court-legacy-v2-phase7-team-dynamics` into `feature/court-legacy-v2-phase6-official-tournaments`. Leave the PR Draft and unmerged until explicit integration approval.
