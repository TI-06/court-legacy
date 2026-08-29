# Court Legacy V2 Phase 6 Official Tournaments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first complete server-authoritative official tournament loop: Interhigh and Spring High prefectural/national brackets, deterministic NPC progression, authoritative user matches, school/player records, long-term history, and mobile tournament UI.

**Architecture:** Store only the current academic year's detailed `OfficialSeasonState` inside `GameState`, use named deterministic tournament RNG sub-seeds so unrelated game randomness is unchanged, reuse `simulateMatch` for user matches, and use a lightweight resolver for NPC-only bracket matches. The existing `/api/game/action` revision + operation-id persistence boundary remains authoritative. National guest representatives are tournament-local deterministic identities and are materialized into a temporary simulation state only when the user faces one.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, Playwright, Cloudflare Workers, Supabase/PostgreSQL, Zod.

**Spec:** `docs/superpowers/specs/2026-08-29-phase6-official-tournaments-design.md`

## Global Constraints

- Work only on `feature/court-legacy-v2-phase6-official-tournaments`, stacked on Phase 5.
- Do not merge Phase 4, Phase 5, or Phase 6 without explicit user authorization.
- Browser action for an official match is exactly `{ type: "official-match" }`; it never carries opponent, tournament, round, seed, result, record increment, title, or reward values.
- Interhigh weeks are prefectural 9/10/11/12 and national 16/17/18/19.
- Spring High weeks are prefectural 30/31/32/33 and national 41/42/43/44.
- Prefectural fields use the 16 persistent world schools. National fields use the persistent prefectural champion plus 15 deterministic tournament-local guest representatives.
- User official matches use existing `simulateMatch` with `bestOfSets = 3`; NPC-only matches use a deterministic lightweight resolver.
- Tournament RNG uses named sub-seeds/forks and must not consume or perturb unrelated global `randomCursor` streams.
- Current-week training remains mandatory. If a due user official match is unresolved, `advance-week` fails with `official_match_required`.
- All user-match state, bracket advancement, school records, player stats, title/qualification state, and history commit through the existing authoritative game operation transaction.
- Schema version becomes 3. Phase 5 version-2 saves migrate without rerolling world/player state or changing `randomCursor`.
- Current detailed tournament state is bounded to one academic year. Canonical `history.officialTournaments` is bounded for at least 100 academic years.
- National guest schools/players must never remain in persistent `state.schools`, `state.players`, PvP snapshots, or hidden-data browser DTOs.
- Required mobile widths remain page-safe: 320px, 360px, 390px, and 480px.
- All asynchronous official-match states remain visibly labeled; no blank or apparently frozen screen.

---

## Task 1: Tournament Types, Schedule, and Deterministic Prefectural Brackets

**Files:**

- Create: `src/domain/tournament/tournamentTypes.ts`
- Create: `src/domain/tournament/tournamentSchedule.ts`
- Create: `src/domain/tournament/createOfficialSeason.ts`
- Create: `tests/unit/domain/tournament/createOfficialSeason.test.ts`

**Public interfaces:**

```ts
export type TournamentCircuit = "interhigh" | "spring-high";
export type TournamentLevel = "prefectural" | "national";
export type TournamentRound =
  | "round-of-16"
  | "quarterfinal"
  | "semifinal"
  | "final";

export interface OfficialSeasonState {
  academicYear: number;
  interhigh: OfficialCircuitState;
  springHigh: OfficialCircuitState;
}

export function tournamentRoundWeek(
  circuit: TournamentCircuit,
  level: TournamentLevel,
  round: TournamentRound,
): number;

export function createOfficialSeason(input: {
  state: GameState;
  academicYear?: number;
}): OfficialSeasonState;
```

- [ ] **Step 1: Write the focused tests first.** Verify exact round weeks, two prefectural stages, 16 unique persistent entrants, stable same-seed bracket identity, top-four quadrant separation, no user-specific seed bonus, and unchanged source `randomCursor`.
- [ ] **Step 2: Run `npm test -- tests/unit/domain/tournament/createOfficialSeason.test.ts` and confirm RED** because tournament modules do not exist.
- [ ] **Step 3: Implement minimal immutable domain types and schedule constants.** Keep labels/presentation text out of the core type file.
- [ ] **Step 4: Implement prefectural seed strength** from current live team strength plus bounded reputation contribution. Use `SeededRandom(state.seed).fork("tournament:<year>:<circuit>:prefectural:bracket")`; do not advance `state.randomCursor`.
- [ ] **Step 5: Build a 16-team single-elimination bracket** with eight R16 matches, four QF, two SF, one final. Top four seeds occupy distinct quadrants; remaining entrants are deterministic-shuffled. Later-round participant IDs begin `null` and are filled by progression.
- [ ] **Step 6: Run the focused test and `npm run typecheck`; confirm GREEN.**
- [ ] **Step 7: Commit `feat: add official tournament season model`.**

---

## Task 2: National Guest Field and Lightweight NPC Resolver

**Files:**

- Create: `src/domain/tournament/createNationalStage.ts`
- Create: `src/domain/tournament/resolveNpcTournamentMatch.ts`
- Create: `tests/unit/domain/tournament/nationalStage.test.ts`
- Create: `tests/unit/domain/tournament/resolveNpcTournamentMatch.test.ts`

**Public interfaces:**

```ts
export function createNationalStage(input: {
  state: GameState;
  circuit: TournamentCircuit;
  champion: WorldSchoolTournamentEntrant;
}): TournamentStageState;

export function resolveNpcTournamentMatch(input: {
  tournamentId: string;
  match: TournamentBracketMatch;
  home: TournamentEntrant;
  away: TournamentEntrant;
}): { winnerEntrantId: string; homeSetsWon: 0 | 1 | 2; awaySetsWon: 0 | 1 | 2 };
```

- [ ] Write RED tests proving national fields contain exactly one persistent champion + 15 unique guest entrants, stable public identities/strengths, bounded guest strength, and no permanent world mutation.
- [ ] Confirm RED.
- [ ] Implement deterministic guest identity generation from circuit/year/tournament/slot with persisted `guestSeed` and display identity only.
- [ ] Write RED NPC resolver tests for deterministic output, stronger-team advantage without certainty, legal `2-0`/`2-1` results, and no player-stat generation.
- [ ] Implement a bounded win-probability resolver using a named match seed.
- [ ] Run both focused suites and typecheck; confirm GREEN.
- [ ] Commit `feat: add national tournament guest field`.

---

## Task 3: GameState Schema v3 and Phase 5 Save Migration

**Files:**

- Modify: `src/domain/model/GameState.ts`
- Modify: `src/domain/generation/generateWorld.ts`
- Modify: `src/persistence/gameStateCodec.ts`
- Modify: `tests/unit/domain/generation/generateWorld.test.ts`
- Modify: `tests/unit/persistence/gameStateCodec.test.ts`

**Data changes:**

```ts
GameState.officialSeason: OfficialSeasonState;
GameHistory.officialTournaments: OfficialTournamentSummary[];
HistoricalMatchSummary.homeDisplayName?: string;
HistoricalMatchSummary.awayDisplayName?: string;
CURRENT_GAME_SCHEMA_VERSION = 3;
```

- [ ] Add RED world tests proving a new save starts with both deterministic prefectural stages and an empty canonical tournament history.
- [ ] Add RED codec tests that construct a real version-2 Phase 5 payload, preserve `randomCursor`, player/school/world/recruiting/shop values, create `officialSeason`, and initialize `officialTournaments`.
- [ ] Confirm RED on the focused tests.
- [ ] Add schema-v3 types and `createEmptyGameHistory().officialTournaments = []`.
- [ ] Initialize new games with `createOfficialSeason` only after the base world exists, without consuming global RNG.
- [ ] Implement `migrateVersionTwo()` and adjust v0/v1 migration so all older versions end as valid v3 states.
- [ ] Run focused tests, `npm test`, and typecheck; confirm GREEN.
- [ ] Commit `feat: migrate game state for official tournaments`.

---

## Task 4: Tournament Progression, Titles, and Canonical History

**Files:**

- Create: `src/domain/tournament/progressOfficialTournaments.ts`
- Create: `src/domain/tournament/tournamentHistory.ts`
- Create: `tests/unit/domain/tournament/progressOfficialTournaments.test.ts`
- Modify: `src/domain/calendar/academicYearProgression.ts`
- Modify: corresponding academic-year tests
- Modify: bounded archive logic in `src/domain/world/rivalWorldProgression.ts`

**Public interfaces:**

```ts
export function findDueUserOfficialMatch(state: GameState): DueOfficialMatch | null;
export function hasRequiredOfficialMatch(state: GameState): boolean;
export function advanceOfficialTournamentsThroughWeek(state: GameState): GameState;
export function completeTournamentMatch(...): GameState;
```

- [ ] Write RED progression tests for NPC-only current-round completion, winner propagation, user match becoming `user-required`, elimination stopping future gates, prefectural title increment, national-stage creation, national appearance exactly once, national title increment, and canonical stage summary append exactly once.
- [ ] Confirm RED.
- [ ] Implement pure bracket propagation round-by-round; never resolve a due user match automatically.
- [ ] Add persistent-school official W/L updates for NPC world-school matches. Do not fabricate player stats for those matches.
- [ ] On prefectural final completion, create national field and increment the persistent representative's `nationalAppearances` exactly once.
- [ ] On national final completion, append `OfficialTournamentSummary` and update the Spring High legacy champion mirror when the champion is persistent.
- [ ] Bound official tournament history to at least the latest 400 stage summaries, sufficient for 100 years × four stages/year.
- [ ] On academic-year transition, archive completed season, generate a fresh `OfficialSeasonState` for the new year, and preserve annual reputation ordering so that tournament counters affect the season being resolved.
- [ ] Run focused progression/year tests and `npm test`; confirm GREEN.
- [ ] Commit `feat: progress official tournament brackets`.

---

## Task 5: Deterministic Guest Match Materialization

**Files:**

- Create: `src/domain/tournament/materializeGuestOpponent.ts`
- Create: `tests/unit/domain/tournament/materializeGuestOpponent.test.ts`

**Public interface:**

```ts
export function materializeGuestOpponent(input: {
  state: GameState;
  entrant: GuestTournamentEntrant;
  data: GameDataRegistry;
}): {
  temporaryState: GameState;
  school: School;
  selection: TeamSelection;
};
```

- [ ] Write RED tests proving identical guestSeed produces identical school/roster/selection, at least seven eligible players, strength tracks bounded entrant strength, IDs cannot collide with persistent players/schools, and original state remains byte-equal.
- [ ] Confirm RED.
- [ ] Generate temporary guest `School` + squad with deterministic IDs/names using existing generation primitives and a guest-seed RNG.
- [ ] Apply bounded deterministic ability adjustment to align the generated roster with `seedStrength`; never persist hidden guest truth to browser DTOs.
- [ ] Insert the guest only into a structured-cloned temporary simulation state and auto-select its lineup.
- [ ] Run focused tests and typecheck; confirm GREEN.
- [ ] Commit `feat: materialize national guest opponents`.

---

## Task 6: User Official Match Recorder and Player Career Stats

**Files:**

- Create: `src/domain/tournament/recordOfficialMatch.ts`
- Create: `src/domain/tournament/playerTournamentStats.ts`
- Create: `tests/unit/domain/tournament/recordOfficialMatch.test.ts`
- Modify: `src/domain/world/rivalWorldProgression.ts` only where needed for reusable persistent-school record helpers

**Rules:**

- Persistent-vs-persistent official matches continue through `recordMatchOutcome()`.
- User-vs-guest match history stores immutable display-name snapshots and increments the persistent user's official W/L despite absent guest `School` persistence.
- Starting rotation + libero receive appearance/sets; point/block/ace totals come only from authoritative event log.
- `bestTournamentResultId` only improves according to the spec precedence table.

- [ ] Write RED tests for guest-safe readable history, exact-once official W/L, no guest persistence/rivalry, appearance/sets/points/blocks/aces accounting, and idempotent duplicate matchId handling.
- [ ] Confirm RED.
- [ ] Implement an isolated event-log stat collector and tournament-result rank function.
- [ ] Implement `recordOfficialTournamentOutcome()` that chooses the persistent or guest-safe recording path and then advances the bracket atomically in returned state.
- [ ] Run focused tests and full unit suite; confirm GREEN.
- [ ] Commit `feat: record official tournament careers`.

---

## Task 7: Server-Authoritative Official Match Action and Week Gate

**Files:**

- Modify: `worker/game/actionSchema.ts`
- Modify: `worker/game/applyGameAction.ts`
- Modify: `tests/unit/worker/applyGameAction.test.ts`
- Modify: `tests/unit/worker/gameAction.test.ts`
- Modify: `src/domain/calendar/academicYearProgression.ts` only for progression integration if not completed in Task 4

**Action shape:**

```ts
{ type: "official-match" }
```

- [ ] Add RED schema tests proving the strict action accepts only `type` and rejects client-supplied opponent/tournament/round/seed/result fields.
- [ ] Add RED apply-action tests for `official_match_not_due`, `official_match_training_required`, invalid lineup, deterministic current due opponent selection, and successful result/bracket/stat update.
- [ ] Add RED week-gate test proving training completion alone cannot advance a due official-match week and an eliminated/completed user can advance.
- [ ] Confirm RED.
- [ ] Implement `applyOfficialMatch` by deriving the due match, materializing persistent/guest opponent on the server, running `simulateMatch(bestOfSets: 3)` with a named tournament match seed, and returning the authoritative state/result.
- [ ] Add `hasRequiredOfficialMatch` gate before `advanceGameWeek` and call tournament NPC progression as the week changes.
- [ ] Rely on the existing GameStore operation ledger for replay/revision atomicity; do not add a parallel tournament mutation endpoint.
- [ ] Run worker-focused tests, `npm test`, and typecheck; confirm GREEN.
- [ ] Commit `feat: add authoritative official match action`.

---

## Task 8: Tournament Selectors and Mobile UI

**Files:**

- Create: `src/domain/tournament/tournamentSelectors.ts`
- Create: `src/features/tournament/TournamentScreen.tsx`
- Create: `src/features/tournament/tournament.css`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/home.css`
- Modify: `src/app/GameApp.tsx`
- Modify: `src/features/match/MatchScreen.tsx` only to generalize presentation labels where necessary
- Create: `tests/unit/domain/tournament/tournamentSelectors.test.ts`
- Create: `tests/unit/features/tournament/TournamentScreen.test.tsx`
- Modify: `tests/unit/features/home/HomeScreen.test.tsx`
- Modify: relevant App match-flow tests

- [ ] Write RED selector tests for next upcoming user match, current due match, eliminated state, next circuit start, public entrant identity, and no hidden guest/player truth.
- [ ] Implement selectors as pure presentation DTO builders.
- [ ] Write RED UI tests for `次の公式戦`, round/opponent/week labels, 16-team bracket, user-path marker, defeated/champion states, confirmation, and disabled/start-ready states.
- [ ] Implement a contained bracket scroller with no body-level horizontal overflow.
- [ ] Add `official` match view/entry above practice/PvP in the Match area without removing existing five-tab navigation.
- [ ] Wire visible pending/error/retry copy: `公式戦を開始しています…`, `試合結果を確定しています…`, revision recovery, and same-operation retry for unknown result through the existing session action mechanism.
- [ ] Run focused UI tests and full unit suite; confirm GREEN.
- [ ] Commit `feat: add official tournament mobile UI`.

---

## Task 9: Long-Run, Security, and Regression Verification

**Files:**

- Create: `tests/unit/domain/tournament/tournamentLongRun.test.ts`
- Modify: `tests/unit/app/createBrowserAppDependencies.test.ts` if an authority regression assertion is useful
- Modify/add PvP regression test ensuring tournament-only/guest data never enters published PvP state

- [ ] Write a deterministic 30-year simulation exercising both circuits/year, annual transition, titles, qualification, elimination, and history bounds.
- [ ] Write a bounded 100-year simulation that resolves all NPC tournament work and safely auto-resolves the user path for soak purposes while keeping roster/history bounds intact.
- [ ] Assert no guest school/player IDs remain in persistent `schools`/`players` after national matches/season changes.
- [ ] Assert tournament detailed state is only current-year and canonical history stays within retention bounds.
- [ ] Add/browser authority source test proving no server guest materializer or tournament result resolver is imported into browser dependency assembly.
- [ ] Re-run ranked PvP leakage regression: tournament state and transient shop effects do not enter public/ranked PvP DTOs.
- [ ] Run `npm test` and `npm run verify`; confirm GREEN.
- [ ] Commit `test: harden official tournament long-run rules`.

---

## Task 10: Mobile E2E, Documentation, Final Review, and Stacked Draft PR

**Files:**

- Create: `tests/e2e/tournament-flow.spec.ts`
- Create or modify: `tests/e2e/tournament-responsive.spec.ts`
- Modify: `README.md`
- Create: `docs/superpowers/implementation-progress/2026-08-29-phase6-official-tournaments.md`

- [ ] E2E: reach an official week, complete training, show official-match requirement, start match, visibly show pending state, persist result, and advance week.
- [ ] E2E: verify elimination does not end the save and later weeks remain playable.
- [ ] E2E: verify qualifying for national stage presents a guest representative without exposing hidden roster truth before the authoritative match.
- [ ] E2E: verify 320/360/390/480px body has no horizontal overflow; bracket overflow, if used, stays inside its labeled region.
- [ ] Re-run existing scouting, Shop, PvP, and home/practice E2E flows.
- [ ] Update README with schema-v3/tournament authority, schedule, guest model, deployment implications, and long-run verification.
- [ ] Record task completion and exact CI/test evidence in the Phase 6 progress file.
- [ ] Run final `npm run verify` and `npm run test:e2e`; inspect warnings/vulnerabilities separately from blockers.
- [ ] Review Phase 5 → Phase 6 diff for accidental client authority, guest persistence, RNG coupling, unbounded archives, hidden-data leakage, and temporary workflow files.
- [ ] Create a Draft PR from `feature/court-legacy-v2-phase6-official-tournaments` into `feature/court-legacy-v2-phase5-shop-mvp` with test evidence and stacked-PR note.
- [ ] Leave the PR open, Draft, and unmerged.
