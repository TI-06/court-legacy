# Phase19 PR19-1 CPU / School Strength Balance Plan

Date: 2026-09-14
Base: `main@2d5e30c6a68e765c9d35ef8bbbfe1c806dc5857b` (`v0.1.0`)
Branch: `feature/phase19-cpu-school-balance`

## Goal

Use Phase18 long-run evidence to make rival-school roster strength scale with school stature across multiple seasons, without globally inflating every CPU school or weakening the user's progression.

## Evidence

The v0.1.0 30-season release soak is structurally stable but shows a persistent competitive-balance gap: user-school strength stays roughly in the low/mid 90s while CPU p90 remains around the high 50s. National tournament seed strength can be much higher, so tournament seeding alone is not an acceptable fix; actual rival rosters must improve.

## Design

Use three bounded, deterministic levers:

1. **Recruit baseline by school stature.** Rival recruits receive a small ability baseline bonus derived from the school's canonical reputation. User recruits are unchanged.
2. **Annual rival development by school stature.** Rival annual growth uses a reputation-based budget plus existing coach/facility/archetype effects. Strong programs develop more; weak programs remain beatable.
3. **Long-term cap control.** Development tapers from ability 80 upward so strong rivals become meaningful without every school converging at 100.

Do not alter player growth-type semantics, user weekly training, PvP authority/privacy/idempotency, save schema v8, or economy/facility pricing in this PR. Those belong to later Phase19 PRs.

## Target shape

The deterministic world should preserve a visible school-strength ladder rather than one exact number. After roughly 10 academic-year transitions, the CPU distribution should have:

- median strong enough to avoid permanent low-50 stagnation;
- p90 at least around the low 70s;
- a meaningful p90-minus-p50 spread;
- no unbounded 90-100 saturation across ordinary schools.

Exact thresholds are enforced only where deterministic evidence is stable. Phase18/19 soak reports remain the final tuning evidence.

## TDD sequence

1. Add a failing rival-development test proving that, with identical players/coach/facilities and random seed, a nationally established school develops more than an unknown school.
2. Add a failing recruit-generation test proving an explicit school ability bonus changes the generated player's baseline while preserving deterministic generation.
3. Add a deterministic 10-year world-balance assertion for CPU distribution and school-strength spread.
4. Implement a single reputation-to-balance-profile source of truth.
5. Wire recruit baseline into initial rival squads and annual CPU intakes; user generation stays at zero bonus.
6. Wire annual rival development to the same profile and taper growth at high ability.
7. Run focused tests, world soak, Phase18 soak smoke/balance, `npm run verify`, then open one PR only after the candidate is green.

## CI / notification policy

- Feature-branch pushes do not run normal full CI.
- Known RED tests are not exposed as failing PR checks.
- Before opening the PR, validate the finished candidate as narrowly as possible.
- Long 30-season soak remains release/manual evidence, not ordinary PR CI.
- Do not blindly rerun failed jobs; inspect the exact failing step first.
