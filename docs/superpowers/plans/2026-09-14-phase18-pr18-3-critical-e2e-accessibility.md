# Phase18 PR18-3 Critical E2E / Accessibility Implementation Plan

Date: 2026-09-14
Base: `main@b13fe0436efb80c5d3f7c7a4e085ad1b6ed066b2`
Branch: `feature/phase18-critical-e2e-accessibility`

## Goal

Turn the Phase18 release-critical browser journeys into a small explicit Playwright contract, add focused practical accessibility coverage, preserve the Phase16 PvP authority/privacy/idempotency boundary, and reduce duplicate GitHub Actions executions that create unnecessary failure notifications.

## Constraints

- Keep Pixel 7 mobile Chromium as the required baseline.
- Reuse existing deterministic fixtures and production boundaries instead of creating a parallel game engine or a giant duplicated E2E scenario.
- Do not weaken existing assertions or skip suites to make CI green.
- Do not add an accessibility dependency solely for a badge; use focused Playwright/DOM assertions for the release-relevant contract.
- Preserve save schema v8 and package version `0.0.0`; PR18-4 owns the v0.1.0 version transition.
- Preserve Phase16 PvP public/private and same-commandId retry semantics.
- Keep normal CI bounded; release-only long soak remains outside normal PR CI.

## Task 1 — Reduce duplicate CI runs

**Files**

- Modify: `.github/workflows/ci.yml`

**Changes**

- Run `push` CI only for `main`.
- Keep `pull_request` CI for feature/fix/chore branches.
- Preserve `concurrency` with `cancel-in-progress`.
- Do not change required job contents: dependency audit, quality/verify + soak smoke, and mobile E2E remain intact.

**Verification**

- Workflow syntax remains valid.
- A feature branch push without an open PR no longer triggers the full CI workflow after this change is present on the branch.
- PR CI and post-merge main CI still execute the full gate.

## Task 2 — Add a critical solo release contract

**Files**

- Add: `tests/e2e/phase18-critical-solo.spec.ts`
- Reuse helpers from existing E2E specs where practical.

**Contract**

- Start from the public app/new-game boundary.
- Perform a training interaction.
- Perform a roster/lineup interaction through the UI.
- Advance a week and verify persistence/reload.
- Exercise an official tournament transition through the public UI/production boundary.
- Complete a match and verify volleyball-specific result presentation.
- Exercise season/year transition with deterministic fixture setup where needed.
- Verify the transitioned save remains playable and persists after reload.

**TDD**

- First add the contract assertions against current behavior.
- Any genuine missing release behavior is fixed minimally in production code.
- Do not duplicate every historical feature E2E assertion.

## Task 3 — Make the PvP reconnect/privacy release contract explicit

**Files**

- Modify or extend: `tests/e2e/phase16-match-command-ux.spec.ts`
- Add a release-contract helper/spec only if it materially improves clarity without duplicating the whole Phase16 suite.

**Contract**

- Enter/load authoritative PvP status.
- Send a public command.
- Simulate an ambiguous/transport failure after server application.
- Refresh authoritative status.
- Retry only if needed with the same `commandId`.
- Verify no duplicate command effect.
- Verify browser-visible payload/state excludes opponent-private runtime, ability, and private selection detail beyond the established public contract.

**Verification**

- Existing Phase16 tests remain green.
- Release-critical test names clearly communicate reconnect/idempotency/privacy coverage.

## Task 4 — Add practical accessibility release checks

**Files**

- Add: `tests/e2e/phase18-accessibility.spec.ts`
- Modify production UI/CSS only where a focused RED assertion exposes a real accessibility gap.

**Checks**

- Critical navigation and primary controls expose accessible names.
- Relevant inputs/forms expose labels or equivalent accessible naming.
- Critical dialogs expose a named dialog role and predictable focus behavior.
- Keyboard focus is visible/usable on primary critical controls.
- Loading/disabled/error states have non-color-only text/status where applicable.
- Primary mobile touch targets meet a practical minimum target size for release-critical actions.
- `prefers-reduced-motion: reduce` does not make critical navigation/dialog/match setup unusable.

**Approach**

- Use Playwright role/name/focus/geometry/media-emulation assertions.
- Do not claim full WCAG certification.

## Task 5 — Improve E2E failure diagnostics without bloating CI

**Files**

- Modify: `playwright.config.ts` only if needed.

**Changes**

- Retain screenshots/traces already present.
- Add retained-on-failure video only if it improves release triage without materially destabilizing runtime.
- Keep workers/retries bounded and deterministic.

## Task 6 — Verification and PR gate

Run before opening the PR where possible:

1. focused Phase18 solo E2E
2. focused Phase18 accessibility E2E
3. focused Phase16 PvP E2E
4. `npm run verify`
5. `npm run soak:smoke`
6. full `npm run e2e`

Then:

1. open PR18-3 as Draft or ready only when implementation is believed GREEN;
2. require exact-head `dependency-audit`, `quality`, and `mobile-e2e` GREEN;
3. review the complete diff for accidental privacy/schema/version changes;
4. mark Ready if needed;
5. merge using the repository's normal merge-commit method;
6. require post-merge `main` CI GREEN.

## Done definition

PR18-3 is complete only when:

- critical solo release contract is green;
- PvP reconnect/idempotency/privacy release contract is green;
- focused practical accessibility contract is green;
- duplicate feature-branch push CI is removed while PR/main gates remain intact;
- exact PR-head CI is fully green;
- PR is merged;
- exact merge SHA has fully green `main` CI.
