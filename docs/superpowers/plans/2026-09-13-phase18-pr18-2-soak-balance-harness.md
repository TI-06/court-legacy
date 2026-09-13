# Phase18 PR18-2 — Soak & Balance Harness Implementation Plan

## Goal

Add a deterministic, headless long-run simulation harness that reuses the authoritative production game action path, runs 1/3/10/30-season presets, separates hard invariants from non-blocking balance observations, and emits both structured JSON and a readable summary.

Base: `main` at `2a54203f53259cece4d300d788acc1b311c770ea` (PR18-1 merged and main CI green).

## Architectural constraints

- Reuse `worker/game/applyGameAction.ts` as the orchestration boundary. Do not create a second simplified week/match/event engine.
- Start from `createInitialGame(...)` plus `autoSelectTeam(...)` to create a production-compatible `CloudGameSnapshot`.
- Resolve surfaced events through the production `event-choice` action.
- Resolve active matches through repeated production `match-command` actions using `{ type: "continue" }`; match resumability already uses `match.randomSeed` + `match.randomCursor` through `SeededRandom`.
- Let `advance-week` own training, due official matches, practice matches, academic-year rollover, recruiting, economy, tournament progression, and event surfacing.
- Determinism comes from the game seed/random cursors and deterministic harness policy. Do not globally monkey-patch `Math.random`.
- The harness must not change save schema/version or runtime user persistence.
- Balance observations are report data, not CI failures, unless an explicit hard invariant is violated.
- No new runtime dependency is required. Manual/release runs use the existing Vitest runtime via a small cross-platform Node wrapper.

## Proposed files

Production-unreferenced developer tooling:

- `src/dev/soak/soakTypes.ts`
- `src/dev/soak/createSoakSnapshot.ts`
- `src/dev/soak/soakPolicy.ts`
- `src/dev/soak/soakInvariants.ts`
- `src/dev/soak/soakMetrics.ts`
- `src/dev/soak/runBalanceSoak.ts`
- `src/dev/soak/formatSoakReport.ts`

Tests / executable harness:

- `tests/unit/soak/soakDriver.test.ts`
- `tests/unit/soak/soakInvariants.test.ts`
- `tests/unit/soak/soakMetrics.test.ts`
- `tests/unit/soak/soakDeterminism.test.ts`
- `tests/soak/phase18BalanceSoak.test.ts`
- `scripts/runBalanceSoak.mjs`

Configuration/docs:

- `package.json`
- `docs/phase18-soak-balance.md`

## Task 1 — Deterministic production action driver

### RED

Create `tests/unit/soak/soakDriver.test.ts` first.

Required failing contracts:

1. `createSoakSnapshot(seed)` returns a valid `CloudGameSnapshot` using the requested seed.
2. One harness step delegates to `applyGameAction` and advances a normal week.
3. If `state.pendingEvent` exists, the driver selects a deterministic available choice and clears it through `event-choice` before advancing.
4. If `state.activeMatch` is waiting for the controlled school, the driver sends production `{ type: "match-command", command: { type: "continue" } }` until the match either completes or reaches another valid decision point.
5. A bounded guard rejects a deadlocked step loop with seed/year/week/action context.

Expected new APIs:

```ts
export interface SoakScenario {
  seed: string;
  seasons: number;
  maxActionsPerWeek?: number;
}

export function createSoakSnapshot(seed: string): CloudGameSnapshot;

export function advanceSoakUntilWeekChanges(
  snapshot: CloudGameSnapshot,
  context: SoakStepContext,
): SoakStepResult;
```

Implementation notes:

- Snapshot fixture mirrors the existing authoritative worker test fixture: `createInitialGame` + `autoSelectTeam`.
- Revision is harness-local metadata only; increment when converting each `AppliedGameAction` back to `CloudGameSnapshot`.
- Deterministic event policy: choose the first `pendingEvent.choiceIds` entry after validating it exists.
- Match policy: use `continue` only. Do not inject timeout/substitution/tactics into the baseline preset.
- When `advance-week` returns `weekAdvanced: false` due to a pending official/practice match, continue resolving the active match and retry the week boundary.
- Guard action count per game week (initial default 512) and throw a typed `SoakInvariantError` with reproducibility context instead of hanging.

### GREEN verification

Run focused:

```bash
npx vitest run tests/unit/soak/soakDriver.test.ts
npm run typecheck
```

Commit after GREEN:

`feat: add deterministic soak action driver`

## Task 2 — Hard invariant validator

### RED

Create `tests/unit/soak/soakInvariants.test.ts`.

Hard failures to cover:

- non-finite values in player abilities/condition/fatigue/morale/trust/academic, school funds/reputation points, facility levels, relationship values, and relevant random cursors;
- abilities outside 0..100;
- negative school funds where production economy forbids them;
- facility level outside 0..`FACILITY_MAX_LEVEL`;
- injury remaining weeks < 0;
- duplicate/missing user roster references;
- player listed in a school but missing from `state.players` or belonging to a different school;
- invalid `teamSelection` according to `validateTeamSelection`;
- year/calendar/date mismatch severe enough to indicate invalid rollover state;
- active match terminal/runtime contradictions;
- corrupted official tournament state that existing production selectors/progression reject;
- action/weekly deadlock from Task 1.

API:

```ts
export interface SoakInvariantViolation {
  code: string;
  message: string;
  path?: string;
}

export function inspectSoakInvariants(
  snapshot: CloudGameSnapshot,
): SoakInvariantViolation[];

export function assertSoakInvariants(
  snapshot: CloudGameSnapshot,
  context: SoakReproductionContext,
): void;
```

Keep checks explicit and deterministic. Reuse production validators (`validateTeamSelection`, facility max constant, tournament/progression helpers) where possible instead of duplicating domain rules.

### GREEN verification

```bash
npx vitest run tests/unit/soak/soakInvariants.test.ts
npm run typecheck
```

Commit:

`feat: add soak hard invariant checks`

## Task 3 — Balance metrics and report model

### RED

Create `tests/unit/soak/soakMetrics.test.ts`.

Report must retain per-seed/per-season inspectability and include at least:

- metadata: seed, preset, target seasons, completed seasons/weeks/actions, schema version;
- user-school funds: start/end/min/max, yearly ledger income/expense, zero-fund weeks;
- school strength: user and CPU distribution per season (min/p50/p90/max/mean using existing player/school strength selectors where available);
- player abilities: min/p50/p90/max/mean, yearly growth totals from `history.playerDevelopmentWeeks`, growth by `growthTypeId`, position and tier counts;
- tournament progression: official summaries, user best rounds/titles, national participant/champion strength when observable from tournament/history state;
- scouting/recruitment: intake counts and tier/growth-type distribution by academic year;
- facilities: levels by year, first season each level milestone is reached, max level observation against `FACILITY_MAX_LEVEL`;
- assistant coach lifecycle: contract rank/specialty by year and contract changes observable from state/history;
- injury/condition: injured-player week observations, new/healed injury counts where derivable, condition histogram/mean per year;
- CPU school strength distribution and national champion strength snapshots;
- `observations: SoakBalanceObservation[]` for suspicious but non-failing trends.

Use stable ordering and deterministic percentile calculations so JSON equality is meaningful.

Human-readable summary must include seed, horizon, final year, funds trend, user strength trend, player growth, tournament results, facility/coach state, injury/condition summary, and balance observations.

### GREEN verification

```bash
npx vitest run tests/unit/soak/soakMetrics.test.ts
npm run typecheck
```

Commit:

`feat: add soak balance metrics and report formatting`

## Task 4 — Multi-season runner and deterministic rerun contract

### RED

Create `tests/unit/soak/soakDeterminism.test.ts`.

Tests:

1. Same seed + same 1-season scenario => identical material report JSON.
2. Different seeds produce a different material result in at least one tracked metric.
3. Fast CI-compatible multi-season run (3 seasons, one fixed seed) completes with zero hard invariant violations.
4. Report has exactly the requested completed season horizon and no unresolved pending event/active-match deadlock at completion.
5. Failure messages include seed, academic year, week/date, and action count.

Runner API:

```ts
export const SOAK_PRESETS = {
  smoke: 1,
  short: 3,
  balance: 10,
  long: 30,
} as const;

export function runBalanceSoak(
  options: RunBalanceSoakOptions,
): SoakRunResult;
```

Execution loop:

- assert invariants at initial snapshot;
- capture initial metrics;
- repeatedly call production action driver until `yearIndex` reaches start + requested seasons;
- after every material action/week boundary, assert hard invariants and collect observations/metrics;
- handle year transition via production `advance-week`; do not synthesize recruits/budgets/tournaments;
- finalize stable JSON report + readable summary.

Runtime guard: short test must stay suitable for normal CI. If 3-season runtime is too high, optimize report collection or reduce redundant validation cost before lowering the acceptance horizon. Do not replace production simulation with shortcuts.

### GREEN verification

```bash
npx vitest run tests/unit/soak/soakDeterminism.test.ts
npm run verify
```

Commit:

`feat: add deterministic multi-season soak runner`

## Task 5 — Manual/release executable presets

Create `tests/soak/phase18BalanceSoak.test.ts` and `scripts/runBalanceSoak.mjs`.

`runBalanceSoak.mjs` responsibilities:

- parse `--preset smoke|short|balance|long` (default `short`);
- parse repeatable/comma-separated `--seed` values (default documented seed set);
- optional `--output <directory>`;
- invoke the existing local Vitest entry with environment variables using `process.execPath`, avoiding platform-specific shell env assignment;
- propagate Vitest exit code so hard invariant failures are non-zero.

`tests/soak/phase18BalanceSoak.test.ts` responsibilities:

- read validated runner environment;
- execute each seed/preset through `runBalanceSoak`;
- write `<seed>-<preset>.json` and `.txt` when output directory is requested;
- always print concise human summary;
- fail only on hard invariant/runner failure, not balance observations.

Add package scripts without changing package version:

```json
"soak": "node scripts/runBalanceSoak.mjs --preset short",
"soak:smoke": "node scripts/runBalanceSoak.mjs --preset smoke",
"soak:balance": "node scripts/runBalanceSoak.mjs --preset balance",
"soak:long": "node scripts/runBalanceSoak.mjs --preset long"
```

Document example:

```bash
npm run soak:smoke
node scripts/runBalanceSoak.mjs --preset balance --seed release-a,release-b --output artifacts/soak
node scripts/runBalanceSoak.mjs --preset long --seed release-long --output artifacts/soak
```

No generated report artifacts are committed.

### Verification

```bash
npm run soak:smoke
npm run soak
```

For release-side evidence, additionally prove the 10/30 preset commands start and are structurally executable. Run full 10/30 locally/CI only when runtime is acceptable for the environment; PR18-4 release gate owns the required larger release evidence.

Commit:

`feat: add executable soak presets and reports`

## Task 6 — Documentation, review, and merge gate

Create `docs/phase18-soak-balance.md` documenting:

- architecture and production reuse boundary;
- presets and commands;
- JSON fields;
- hard invariants vs observations;
- how to reproduce a failed seed;
- output artifact examples;
- what PR18-4 should execute as release evidence.

Final review checklist:

- no simplified match/week/event/tournament engine added;
- same seed deterministic test is stable;
- 3-season fast run is green;
- 10/30 presets exist and use the same production runner;
- hard invariant failures have non-zero exit status and reproduction context;
- balance observations do not falsely fail CI;
- no save schema/package version bump;
- existing PvP code is untouched;
- `npm run verify` green;
- `npm run soak:smoke` green;
- normal mobile E2E green because package/script-only tooling must not regress runtime app.

Open/maintain Draft PR during implementation. Before merge, request review of the complete diff, resolve findings, mark Ready, merge only after all required CI gates are green, then confirm main CI green.
