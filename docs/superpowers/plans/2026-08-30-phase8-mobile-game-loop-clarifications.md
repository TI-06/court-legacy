# Phase 8 Implementation Plan — Normative Clarifications

This file is a normative companion to `2026-08-30-phase8-mobile-game-loop.md` and resolves the four ambiguities found during plan self-review. When a statement here is more specific than the main plan, this file wins. Implementation workers must read the spec, main plan, and this file before Task 1.

## 1. Persisted Weekly Report Must Preserve Useful Before/After Detail

The initial `WeeklyReport` snippet in Task 1 is too thin to support the approved reloadable report UI. Use these report types instead.

```ts
export interface WeeklyTrainingGrowthSummary {
  playerId: PlayerId;
  totalAbilityGrowth: number;
  abilityChanges: Partial<Record<AbilityKey, number>>;
}

export interface WeeklyRestRecoverySummary {
  playerId: PlayerId;
  reason: AutoRestReason;
  fatigueBefore: number;
  fatigueAfter: number;
  conditionBefore: number;
  conditionAfter: number;
}

export interface WeeklyReportMatchSummary {
  kind: "practice" | "official";
  opponentDisplayName: string;
  homeSetsWon: number;
  awaySetsWon: number;
  won: boolean;
  circuit: TournamentCircuit | null;
  level: TournamentLevel | null;
  round: TournamentRound | null;
}

export interface WeeklyReport {
  weekStartDate: GameDate;
  weekEndDate: GameDate;
  trainingMenuId: string;
  trainingGrowth: WeeklyTrainingGrowthSummary[];
  restRecoveries: WeeklyRestRecoverySummary[];
  injuredPlayerIds: PlayerId[];
  healedPlayerIds: PlayerId[];
  match: WeeklyReportMatchSummary | null;
  practiceMatchSkippedReason: "insufficient-players" | null;
  cohesionDelta: number;
  reputationDelta: number;
  nextIncomingOfferSchoolId: SchoolId | null;
}
```

Rules:

- `trainingGrowth` includes only players with `totalAbilityGrowth > 0` and is sorted in user-school roster order.
- `restRecoveries` includes every auto-rested user player, including injured players, and stores start-of-week vs end-of-week fatigue/condition.
- Only one `WeeklyReport` is persisted (`weeklySchedule.latestReport`); reports are not appended to an unbounded list.
- Full `SimulateMatchResult` remains action-outcome/session-only and is never embedded into the persisted report.
- The report can therefore render examples such as `疲労 72 → 49` and `スパイク +2` after a reload without reconstructing previous state.

Task 1 migration tests and Task 9 report tests must use this structure instead of `grownPlayerIds`/`restingPlayerIds` only.

## 2. Exact Practice Planning Percentages and Tier Rules

### Incoming-offer chance by reputation

Use exact Phase 8 values inside the already approved ranges:

```ts
export const PRACTICE_INCOMING_CHANCE: Record<SchoolReputation, number> = {
  unknown: 20,
  "district-contender": 30,
  "prefectural-power": 45,
  "national-qualifier": 52,
  "national-regular": 58,
  elite: 65,
};
```

Incoming opponent target-strength ratio rises with reputation:

```ts
export const PRACTICE_INCOMING_TARGET_RATIO: Record<SchoolReputation, number> = {
  unknown: 0.90,
  "district-contender": 0.95,
  "prefectural-power": 1.00,
  "national-qualifier": 1.05,
  "national-regular": 1.10,
  elite: 1.15,
};
```

If the deterministic offer roll succeeds, select the unused world school whose strength ratio is closest to the target ratio; break equal-distance ties by school ID. Exclude the user school. A due official week has no incoming offer regardless of roll.

### Outgoing candidate tiers

For `ratio = opponentStrength / max(1, homeStrength)`:

- `same`: prefer `0.85 <= ratio <= 1.00`.
- `stronger`: prefer `1.00 < ratio <= 1.15`.
- `challenge`: prefer `ratio > 1.15`.
- If a tier has no member, select the nearest unused school to that tier boundary, tie-breaking by school ID.

### Acceptance percentage

Use this exact formula and clamp to `5..95`:

```ts
const acceptancePercent = clamp(
  70 +
    Math.round((homeReputationPoints - opponentReputationPoints) / 10) -
    Math.max(0, opponentStrength - homeStrength) * 2 -
    recentMeetingCount * 15,
  5,
  95,
);
```

The accept/reject roll is derived from a forked weekly planning RNG label containing date, user school ID, and opponent school ID. It does not mutate `randomCursor`.

### Display ratings

For practice screen display, map strength ratio to growth/load rating:

```ts
function practiceRating(ratio: number): 1 | 2 | 3 | 4 | 5 {
  if (ratio <= 0.85) return 1;
  if (ratio <= 0.95) return 2;
  if (ratio <= 1.05) return 3;
  if (ratio <= 1.15) return 4;
  return 5;
}
```

`growthRating` and initial `loadRating` use this same mapping in Phase 8. A later balance phase may separate them.

Task 3 tests must assert these exact constants/formulas rather than only monotonic behavior.

## 3. Exact Position-Relevant Ability Pools for Practice Growth

On each successful `+1` practice-growth roll, select one ability from the player’s position pool using the deterministic resolution RNG:

```ts
export const PRACTICE_GROWTH_ABILITIES: Record<Position, readonly AbilityKey[]> = {
  OH: ["spike", "receive", "serve", "jump"],
  MB: ["block", "jump", "speed", "spike"],
  OP: ["spike", "serve", "jump", "stamina"],
  S: ["set", "decision", "speed", "serve"],
  L: ["receive", "speed", "decision", "mental"],
};
```

If the selected ability is already 100, rotate forward through that pool until finding an ability below 100. If every ability in the pool is 100, record no ability growth for that player and do not mutate another non-position ability.

Task 4 tests must cover the 100-cap fallback and all five positions.

## 4. Official-Week Availability Rules

The main plan correctly states that injury is a hard official-match restriction while fatigue/condition are soft avoidance. Implement this exact selection policy before official simulation:

1. Start from the saved user `TeamSelection` when all seven active players are healthy enough and uninjured.
2. `hardUnavailable` = every injured user player. Injured players must never be in the official active seven.
3. `softAvoid` = non-injured players where fatigue >= 65 or condition <= 35.
4. If the saved active seven intersects `hardUnavailable` or `softAvoid`, first attempt a deterministic replacement selection excluding `hardUnavailable + softAvoid`.
5. If fewer than seven players are available under that strict set, retry excluding only `hardUnavailable`; this may use fatigued/low-condition players but never injured players.
6. If fewer than seven non-injured players exist, reject the confirmed official weekly action with `official_match_insufficient_players` and leave the persisted snapshot unchanged.
7. Preserve the user’s `substitutionPolicy` object in the auto-adjusted official selection. Remove only starter-lock IDs that are hard-unavailable; keep other lock IDs in the selected roster/bench set.
8. This auto-adjusted selection is used for that official simulation outcome only. Do not overwrite the user’s saved long-term lineup unless the academic-year rollover already requires the existing rebuild behavior.

Add `src/domain/weekly/resolveOfficialWeekSelection.ts` and `tests/unit/domain/weekly/resolveOfficialWeekSelection.test.ts` to Task 5.

Required RED cases:

- healthy saved lineup -> byte-equivalent selection;
- injured starter -> replaced and never active;
- fatigue 65 starter -> avoided when seven healthier players exist;
- condition 35 starter -> avoided when seven healthier players exist;
- soft-avoid player used only when strict healthy roster has fewer than seven;
- fewer than seven non-injured players -> `official_match_insufficient_players`;
- input `TeamSelection` remains immutable.

## 5. Clarification of Illustrative Snippets in the Main Plan

Three abbreviated snippets in the main plan are explanatory, not unresolved implementation placeholders:

- `ResolveWeeklyTrainingInput` is the existing full interface plus `restingPlayerIds?: ReadonlySet<PlayerId>`; retain its existing `state`, `schoolId`, `plan`, `data`, `random`, and `additionalGrowthModifiers` fields.
- The temporary Task 6 `GameAction` union retains the exact existing `team-selection`, `set-team-leadership`, `facility-upgrade`, and `event-choice` variants plus the three legacy weekly variants only until Task 13 removes those legacy weekly variants.
- Auto-rest injury fixtures must use a valid `PlayerInjury` object with `injuryId`, `severity`, `remainingWeeks`, and `recurrenceRisk`; do not use an incomplete object.

## 6. Plan Self-Review Result

- Spec coverage: PASS after the report/detail and official-availability clarifications above.
- Placeholder scan: no `TODO` or `TBD`; abbreviated snippets are resolved explicitly in section 5.
- Type/interface consistency: PASS with `WeeklyReport` structure in section 1 taking precedence over the earlier thin snippet.
- Task dependency order: PASS. Persistence -> rest -> planning -> practice resolution -> weekly orchestration -> Worker contract -> UI migration -> legacy action removal -> E2E/release verification.
