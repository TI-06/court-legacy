# Phase18 Release Readiness Design

Date: 2026-09-13
Status: Design review
Baseline: `main` at `7f5c7c0c833e6c205d55808c127143a09efbaf3a` (PR #81 / Phase17 merged)
Target release: `v0.1.0`

## 1. Purpose

Phase18 is the release-readiness phase for Court Legacy. Phase17 completed the planned game-facing feature sequence. Phase18 intentionally does not add another large gameplay system. Its purpose is to make the existing game safe to ship, update, operate, regression-test, and balance using repeatable evidence.

The phase is split into four PRs:

1. PR18-1 — Release Foundation / PWA
2. PR18-2 — Soak & Balance Harness
3. PR18-3 — Critical E2E / Accessibility
4. PR18-4 — v0.1.0 Release Gate

Each PR should be independently reviewable and leave `main` releasable or closer to releasable. No PR may weaken the existing privacy boundary or existing CI checks to become green.

## 2. Baseline observations

The current repository already has useful release foundations:

- Vite + React frontend with Cloudflare integration.
- Production build is already part of `npm run verify`.
- CI currently separates `dependency-audit`, `quality`, and `mobile-e2e`.
- Playwright currently runs a Pixel 7 mobile Chromium project at 390x844.
- `index.html` already includes `viewport-fit=cover` and a theme color.
- Phase16/17 established PvP command/reconnect/idempotency behavior and match-facing privacy tests.

The missing release-readiness pieces are intentional targets for Phase18:

- no web app manifest / install contract is currently present;
- no service-worker/update lifecycle is currently registered;
- there is no deterministic multi-season soak/balance runner;
- critical user journeys are spread across feature tests rather than expressed as one release contract;
- accessibility is not yet a named release gate;
- the package version is still `0.0.0`, so `v0.1.0` needs an explicit release gate rather than being implied by a normal merge.

## 3. Goals

Phase18 must provide all of the following:

- installable mobile-web/PWA foundation without compromising PvP correctness;
- explicit client-update behavior that avoids silently running an obsolete client against a newer backend;
- preservation of compatible saves across reload/update paths;
- deterministic long-run simulation suitable for detecting regressions and balance drift;
- critical E2E coverage for the complete player loop and reconnect-sensitive PvP path;
- practical accessibility checks for controls, focus, labels, contrast-sensitive states, touch use, and reduced motion;
- one documented v0.1.0 release gate with reproducible commands and rollback criteria.

## 4. Non-goals

Phase18 does not include:

- a new large training system;
- a new tournament family;
- a new school-management subsystem;
- character-content expansion;
- a large PvP feature expansion;
- a full UI redesign;
- monetization or store expansion;
- balance tuning based only on intuition.

Balance changes are allowed only when a Phase18 test exposes a clear release blocker. Broader tuning belongs to Phase19 and should use the Phase18 harness output.

## 5. PR18-1 — Release Foundation / PWA

### 5.1 Objective

Make the existing application installable and update-safe while preserving online/PvP semantics.

### 5.2 Manifest and install contract

Add a standards-compliant web app manifest and required app icons/assets. The manifest must define at least:

- app name and short name;
- `start_url` and standalone display behavior;
- theme/background colors consistent with the current game shell;
- icon sizes required for normal Android/PWA installation;
- orientation/display decisions that do not break current mobile layouts.

`index.html` should link the manifest and preserve the existing `viewport-fit=cover` behavior. Safe-area spacing must be verified in the existing mobile shell rather than duplicated into a parallel PWA-only layout.

### 5.3 Service-worker policy

The service worker is a release shell/cache mechanism, not an offline PvP engine.

Allowed caching:

- hashed static build assets;
- app shell resources that are safe to serve stale only under an explicit update policy;
- immutable icons/fonts/assets where applicable.

Disallowed caching:

- PvP command mutations;
- PvP match status/state responses;
- authentication/session responses;
- Supabase/API mutations;
- any response whose freshness affects authoritative game state.

Those paths remain network-authoritative. A service worker must never convert a network failure into a fake successful PvP action.

### 5.4 Update lifecycle / version skew

The app needs an explicit update contract. A newly deployed build may be detected while an existing tab is open, but activation must not silently invalidate an in-progress command flow.

Required behavior:

- detect that a newer shell is available;
- allow safe activation/reload at a controlled boundary;
- avoid two active app-shell versions indefinitely;
- never replay an already-acknowledged mutation merely because the shell updated;
- preserve Phase16 command-id idempotency semantics during reconnect/update races.

If a hard compatibility boundary is introduced later, the client should have one place to surface a required-refresh state instead of scattering version checks across screens.

### 5.5 Save compatibility

PWA installation and shell updates must not create a second logical save namespace accidentally. Existing save/load compatibility rules remain authoritative.

Tests must cover at least:

- existing compatible save -> reload -> same save available;
- existing compatible save -> simulated app update -> same save available;
- malformed/unsupported data follows existing safe failure behavior and is not overwritten merely to make startup succeed.

No save migration is added unless the implementation actually changes the persisted schema.

### 5.6 PR18-1 acceptance criteria

PR18-1 is complete when:

- manifest validation is covered by tests;
- install-related metadata is present in the production build;
- service-worker caching rules have automated tests around forbidden network-authoritative routes;
- update lifecycle behavior has focused tests;
- save persistence survives reload/update tests;
- existing PvP privacy/idempotency tests remain green;
- `npm run verify` is green;
- mobile E2E remains green.

## 6. PR18-2 — Soak & Balance Harness

### 6.1 Objective

Provide a deterministic headless runner that exercises production domain logic over long game horizons and emits machine-readable balance evidence.

The harness must reuse production simulation/domain functions. It must not implement a simplified second game engine whose results can diverge from the real game.

### 6.2 Determinism

Every run is identified by:

- seed;
- initial scenario/preset;
- number of seasons/weeks;
- build/version metadata where practical.

Given the same code, preset, and seed, the harness must reproduce the same material result. Any random path that prevents determinism should be injected/controlled rather than globally monkey-patched when possible.

### 6.3 Presets

Initial supported horizons:

- 1 season smoke;
- 3 season short run;
- 10 season balance run;
- 30 season long-run soak.

CI does not need to run the most expensive matrix on every commit. The architecture must distinguish:

- fast deterministic regression checks suitable for normal CI;
- larger balance/soak matrices suitable for release/manual execution.

### 6.4 Metrics

The harness should emit structured JSON plus a human-readable summary for at least:

- school funds and yearly income/expense;
- team/school strength distribution;
- player ability distribution and progression;
- tournament progression/results;
- scouting/recruitment outcomes;
- growth-type outcomes where relevant;
- facility progression and time to high levels;
- coach lifecycle/effects where relevant;
- injury and condition frequencies where relevant;
- CPU school strength distribution;
- national tournament participant/winner strength distribution.

Metrics should make outliers inspectable by seed rather than only returning one global average.

### 6.5 Hard invariants vs balance observations

The harness must separate two concepts.

Hard invariant failure examples:

- NaN/Infinity/negative values where domain rules forbid them;
- impossible roster/state transitions;
- simulation crash/deadlock;
- corrupted tournament state;
- invalid season/year transition;
- non-deterministic result for the same seed and inputs.

Balance observations are not automatically CI failures. Examples:

- funds trend high after ten seasons;
- too many players reach top grades;
- one position becomes disproportionately valuable;
- elite schools dominate more often than desired;
- facility level 50 is reached faster than desired.

Initial Phase18 thresholds should only block release when the team has an explicit, justified invariant/limit. Exploratory balance metrics should be recorded for Phase19 instead of creating flaky gates.

### 6.6 PR18-2 acceptance criteria

- deterministic rerun test passes;
- at least one fast CI-compatible multi-season run passes;
- 10/30-season presets are executable locally/release-side;
- structured report and readable summary are generated;
- hard invariant failures return non-zero exit status;
- normal balance observations remain visible without falsely failing CI;
- production domain logic is reused rather than forked.

## 7. PR18-3 — Critical E2E / Accessibility

### 7.1 Objective

Turn the user-visible release path into a small, explicit browser-level contract and add practical accessibility coverage.

### 7.2 Critical solo journey

Critical E2E should cover the highest-value integrated path, with test setup helpers used to keep runtime bounded:

1. start/new-game path;
2. save persistence and reload/load;
3. week progression;
4. training interaction;
5. roster/lineup interaction;
6. official tournament entry/progression;
7. match start and completion;
8. result presentation including volleyball-specific stats already implemented;
9. season end;
10. year transition and continued playable state.

The test is a release contract, not an attempt to duplicate every feature test in one huge spec. Expensive setup may use deterministic fixtures/helpers as long as the actual critical transition being verified occurs through the public UI or production boundary under test.

### 7.3 Critical PvP journey

The PvP release contract must preserve the Phase16 correctness boundary:

1. enter/join PvP path;
2. start or load authoritative match status;
3. issue a public client command;
4. observe authoritative result/status;
5. simulate transport failure/ambiguous response;
6. refresh authoritative status;
7. retry only when required, using the same commandId;
8. continue the match without duplicate command effects;
9. verify the browser does not receive opponent-private runtime/selection/ability detail beyond the established public contract.

### 7.4 Accessibility scope

Phase18 targets practical gameplay accessibility rather than claiming full WCAG certification.

Release-relevant checks:

- interactive controls have accessible names;
- forms/inputs have labels or equivalent accessible naming;
- dialogs manage focus predictably;
- keyboard focus remains visible and usable for critical flows;
- disabled/loading/error states are not communicated by color alone where practical;
- touch targets for primary mobile actions are not unreasonably small;
- reduced-motion preference does not make critical flows unusable.

If an automated accessibility library is introduced, it should be added deliberately with focused rules and reviewed dependencies. Phase18 must not add a dependency solely to produce a green badge while ignoring existing UI behavior.

### 7.5 Browser/device scope

Keep the existing Pixel 7 mobile Chromium project as the required fast baseline. Add another project only when it adds meaningful release coverage without making normal CI unstable. WebKit/iPhone coverage may be a release-side check if CI cost or environment behavior makes it inappropriate for every pull request.

### 7.6 PR18-3 acceptance criteria

- solo critical journey is green;
- PvP reconnect/idempotency critical journey is green;
- opponent-private information remains absent at the browser contract boundary;
- critical dialogs/controls have focused accessibility tests;
- existing mobile E2E runtime remains bounded and diagnosable with Playwright artifacts.

## 8. PR18-4 — v0.1.0 Release Gate

### 8.1 Objective

Create a single release decision point. PR18-4 should primarily assemble and enforce evidence created by PR18-1 through PR18-3 rather than introduce gameplay behavior.

### 8.2 Required gate

The v0.1.0 gate covers:

- production dependency audit;
- formatting;
- lint;
- typecheck;
- structural verification;
- unit/integration/domain/worker tests as represented by the existing test suites;
- production build;
- mobile E2E;
- Phase18 critical E2E;
- fast soak/invariant run;
- PWA/install/update checks;
- save compatibility check;
- PvP public/private boundary check;
- PvP idempotency/reconnect check.

Where a test is already included inside `npm run verify`, the release gate should reference/reuse it instead of running identical work twice without a reason.

### 8.3 Release-only evidence

Before tagging v0.1.0, also require:

- larger soak/balance report (including long-run preset);
- migration/schema review for any DB/save changes since the previous release baseline;
- environment/config review for production deployment;
- release notes;
- known issues list;
- rollback procedure;
- confirmation that no release-blocking privacy regression is open.

### 8.4 Versioning

The repository currently reports package version `0.0.0`. PR18-4 owns the explicit transition to the intended `0.1.0` release metadata/tag-ready state. Earlier Phase18 PRs should not opportunistically bump the public release version.

### 8.5 Failure policy

A release is blocked by:

- any required CI failure;
- reproducible state corruption;
- failed deterministic invariant;
- broken save compatibility within the supported policy;
- duplicate PvP command effect;
- opponent-private data exposure;
- install/update behavior that can trap users on a known incompatible client;
- production build/deploy configuration failure.

A non-blocking balance anomaly is documented and deferred to Phase19 unless it makes the game effectively unplayable or violates an explicit invariant.

## 9. PR dependency/order

The PRs are intentionally sequential:

`PR18-1 -> PR18-2 -> PR18-3 -> PR18-4`

Reasons:

- E2E in PR18-3 should test the final app-shell/update behavior from PR18-1.
- PR18-3 can use deterministic utilities/fixtures informed by PR18-2 without coupling browser tests to the full soak runner.
- PR18-4 must only compose gates after the underlying checks exist.

Each PR branches from then-current `main` after the previous PR is merged, unless an explicit reason to stack branches is documented.

## 10. Test strategy

Phase18 continues the project TDD workflow:

1. write the focused failing test (RED);
2. prove the failure is for the intended missing behavior;
3. implement the minimum production change (GREEN);
4. refactor while preserving tests;
5. run focused suites;
6. run repository quality/type/build checks appropriate to the task;
7. run required E2E before merge.

Release-only long soak runs should not replace fast deterministic tests. Normal PR feedback must remain reasonably fast.

## 11. Risk controls

### PWA stale-state risk

Mitigation: cache only safe resources, keep authoritative APIs network-based, add explicit update tests.

### Save loss risk

Mitigation: no accidental storage-key migration; compatibility tests before activating shell changes.

### PvP duplicate-action risk

Mitigation: retain same-commandId retry semantics and test update/reconnect ambiguity.

### Soak harness divergence risk

Mitigation: drive production domain logic and inject deterministic randomness instead of maintaining a second simulation.

### CI runtime/flakiness risk

Mitigation: separate fast blocking matrix from long release-only soak, keep deterministic fixtures, preserve Playwright diagnostics.

### False balance gate risk

Mitigation: distinguish hard invariants from exploratory balance observations.

## 12. Definition of Phase18 complete

Phase18 is complete only when all four PRs are merged to `main`, main CI is green, the release-only checklist has evidence, and the repository is in a tag-ready `v0.1.0` state.

At that point Phase19 may use the deterministic reports to perform data-driven balance tuning and further game-content work.
