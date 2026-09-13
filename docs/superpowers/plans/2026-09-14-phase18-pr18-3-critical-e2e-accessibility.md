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
- Keep `pull_request` CI for branches targeting `main`.
- Add `concurrency` with `cancel-in-progress`.
- Do not change required job contents: dependency audit, quality/verify + soak smoke, and mobile E2E remain intact.

**Verification**

- Workflow syntax remains valid.
- Feature branch pushes no longer run the full CI workflow after this change is present on the branch.
- PR CI and post-merge main CI still execute the full gate.

## Task 2 — Make the critical solo release contract explicit

**Files**

- Modify: `tests/e2e/v2-auth-game-flow.spec.ts`
- Modify: `tests/e2e/app-shell.spec.ts`
- Modify: `tests/e2e/official-tournament-flow.spec.ts`
- Modify: `tests/e2e/phase17-season-end.spec.ts`
- Modify: `package.json`

**Contract**

- Mark stable existing release-critical journeys with `@critical` rather than duplicating them in one giant spec.
- Cover registration/new game, save persistence/reload, week progression, training, lineup interaction, official tournament progression, match start/completion, volleyball-specific result presentation, year transition, and continued playable state.
- Add `npm run test:e2e:critical` as the explicit release-contract command.

**TDD**

- Add focused assertions only where the existing journey does not yet express a release requirement.
- Any genuine missing release behavior is fixed minimally in production code.
- Do not duplicate every historical feature E2E assertion.

## Task 3 — Make the PvP reconnect/privacy release contract explicit

**Files**

- Modify: `tests/e2e/pvp-flow.spec.ts`

**Contract**

- Enter/load authoritative PvP status.
- Send a public command.
- Simulate an ambiguous/transport failure after server application.
- Refresh authoritative status.
- Retry only if needed with the same `commandId` through the existing production path.
- Verify no duplicate rated result/effect.
- Verify browser-visible pre-match presentation excludes the established opponent-private comparison/detail surfaces.

**Verification**

- Existing Phase16 tests remain green.
- Release-critical test names clearly communicate reconnect/idempotency/privacy coverage.

## Task 4 — Add practical accessibility release checks

**Files**

- Add: `tests/e2e/phase18-accessibility.spec.ts`
- Modify: `src/ui/ui.css` only where a focused assertion exposes a real accessibility gap.

**Checks**

- Critical navigation and primary controls expose accessible names.
- Relevant registration inputs expose explicit accessible labels.
- Critical dialogs expose a named dialog role and predictable focus behavior.
- Keyboard focus is visible/usable on primary critical controls.
- Saved-state feedback is communicated with text rather than color alone.
- Primary mobile touch targets meet a practical 44px minimum for release-critical actions.
- `prefers-reduced-motion: reduce` disables the bottom-sheet entrance animation without making the dialog unusable.

**Approach**

- Use Playwright role/name/focus/geometry/media-emulation assertions.
- Do not claim full WCAG certification.

## Task 5 — Preserve bounded E2E diagnostics

**Files**

- Keep existing `playwright.config.ts` diagnostics unless a concrete failure demonstrates a gap.

**Changes**

- Retain screenshots/traces already present.
- Avoid adding duplicate critical/full executions to normal CI; the critical command is available for focused/release use while the normal mobile job still runs the full E2E suite once.
- Keep workers/retries bounded and deterministic.

## Task 6 — Verification and PR gate

Run before/through the PR gate:

1. `npm run test:e2e:critical`
2. `npm run verify`
3. `npm run soak:smoke`
4. full `npm run test:e2e`

Then:

1. open PR18-3 only when implementation is believed GREEN;
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
