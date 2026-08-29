# Court Legacy V2 Phase 6 — Official Tournaments Implementation Progress

## Scope

Phase 6 adds the first complete server-authoritative official tournament loop for Interhigh and Spring High, from prefectural brackets through national brackets, while preserving the endless school-year loop.

Base branch: `feature/court-legacy-v2-phase5-shop-mvp`  
Base SHA: `4b70e5e6afd8f33e1c940f70590f3c74034f380f`  
Implementation branch: `feature/court-legacy-v2-phase6-official-tournaments`

Design: `docs/superpowers/specs/2026-08-29-phase6-official-tournaments-design.md`  
Plan: `docs/superpowers/plans/2026-08-29-phase6-official-tournaments.md`

## Implemented

- Added deterministic 16-team prefectural brackets for Interhigh and Spring High.
- Added national stages containing the persistent prefectural champion plus 15 deterministic tournament-local guest representatives.
- Added lightweight deterministic NPC-only tournament resolution.
- Added server-authoritative `{ type: "official-match" }` action using the existing real `simulateMatch` path for user matches.
- Added weekly training gate and mandatory due-official-match week gate.
- Added persistent school official wins/losses, prefectural titles, national appearances, national titles, and existing annual reputation integration.
- Added user-player official-match appearances, sets, points, blocks, service aces, and best tournament result progression.
- Added canonical bounded `history.officialTournaments` and guest-safe historical display snapshots.
- Migrated serialized `GameState` schema from version 2 to version 3 without rerolling the existing world or consuming the global random cursor.
- Added Home and Match tournament entry points, 16-team bracket UI, confirmation, elimination/champion states, and mobile-safe internal bracket scrolling.
- Added visible official-match processing labels and exact-operation retry for ambiguous results.
- Added README documentation for schedule, authority, schema v3, guest persistence, deployment, and long-run verification.

## Task 9 defect found and fixed

Long-run/security review found a real national-tournament edge case: when the user lost in the prefectural stage, the persistent prefectural champion could face a transient guest representative in an NPC-only national match. The original NPC recorder handled persistent-vs-persistent matches only, so that persistent school's official record and readable match history were not updated.

RED evidence:

- Workflow run `33254990014`, job `99107012825`.
- `tests/unit/domain/tournament/persistentGuestNpcRecord.test.ts`: 2 tests, 2 failures.
- Failure 1: persistent school official W/L total did not increment.
- Failure 2: no national historical match was appended.

Fix:

- Commit `3546a52` — `fix: record persistent school guest tournament outcomes`.
- Generalized NPC official recording for persistent-world-school vs transient-guest matches.
- Preserved world-vs-world rivalry behavior through the existing `recordMatchOutcome()` path.
- Added immutable participant display snapshots for transient guest history.
- Kept guest schools/players out of persistent `schools` and `players`.
- Added match-id duplicate protection so user-vs-guest results are not double-counted.

GREEN evidence:

- Workflow run `33255058244`, job `99107194367`.
- 3 focused files / 11 tests passed plus TypeScript check.

## Long-run and authority verification

Task 9 focused verification:

- Workflow run `33255259946`, job `99107726035`.
- 7 test files / 18 tests passed plus TypeScript check.
- 30-year tournament simulation completed both circuits every academic year and produced identical canonical history and school records from identical seeds.
- 100-year tournament simulation remained bounded with `MAX_OFFICIAL_TOURNAMENT_HISTORY = 400` and existing `MAX_MATCH_HISTORY = 500`.
- No persistent guest school IDs or player IDs remained after national tournaments or academic-year transitions.
- Detailed `officialSeason` state remained current-year only.
- Browser dependency assembly did not import server-only guest materialization or tournament-result authority.
- PvP publish regression confirmed that `officialSeason`, `officialTournaments`, `guestSeed`, and transient `shopEffects` are not included in the published PvP snapshot payload.

## Mobile and operation verification

Official tournament UI/retry focused verification:

- Retry run `33254438168`: 6 related files / 16 tests passed plus TypeScript check.
- Ambiguous official-match retry reuses the exact same `operationId`, revision, and `{ type: "official-match" }` request.
- Processing UI visibly labels start, result confirmation, and tournament-result persistence instead of presenting a blank/frozen screen.

Official tournament Playwright verification:

- Workflow run `33255453260`, job `99108225046`.
- 8 / 8 official tournament E2E tests passed.
- Verified 320px, 360px, 390px, and 480px body-width safety with bracket overflow contained inside its labeled scroller.
- Verified training gate, authoritative official-match commit, revision persistence, and reload preservation.
- Verified prefectural elimination does not end the save and later weeks remain playable.
- Verified national qualification presents a guest representative without adding a guest school/player roster to persistent state.

## Full verification evidence

Documentation-format/full verification run:

- Workflow run `33255614170`, job `99108654633`.
- `npm run verify` passed every stage:
  - Formatting
  - Lint
  - Type check
  - V2 architecture structure guard
  - Production dependency audit
  - Unit tests
  - Production build

`npm ci` still reports the pre-existing development dependency tree advisory count of 7 vulnerabilities (3 moderate, 4 high). The production dependency audit inside `npm run verify` passes. The existing Vite large-chunk warning and pre-existing React test `act(...)` warnings remain non-blocking.

## Final diff review

Phase 5 → Phase 6 compare uses Phase 5 SHA `4b70e5e6afd8f33e1c940f70590f3c74034f380f` as the merge base and shows Phase 6 strictly ahead with no Phase 5 divergence.

Reviewed for:

- browser-selected opponent/bracket/seed/result authority;
- guest school/player persistence;
- global RNG cursor coupling;
- unbounded tournament/history growth;
- tournament/shop transient data entering PvP publish DTOs;
- server-only tournament materializer/result authority entering browser dependency assembly;
- temporary GitHub Actions workflows.

After cleanup, `.github/workflows` contains only the repository's normal `ci.yml` workflow.

## Remaining release action

Run the normal branch CI on the final documentation/progress commit, then open a stacked Draft PR from `feature/court-legacy-v2-phase6-official-tournaments` into `feature/court-legacy-v2-phase5-shop-mvp`. Leave it Draft and unmerged until explicit integration approval.
