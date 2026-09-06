# School Economy System Design

Status: Draft for user review
Date: 2026-09-06
Repository: `TI-06/court-legacy`

## 1. Goal

Turn school funds from a mostly facility-only resource into a core long-term progression loop:

`win / build reputation -> receive funds -> choose where to invest -> improve team -> win more`

Funds must support meaningful short-, medium-, and long-term choices without turning the game into a bookkeeping simulator.

The system must preserve existing cloud saves, remain server-authoritative, and keep the current zero-yen shop model.

## 2. Confirmed product decisions

- The shop remains `¥0` for all products.
- Add three immediate fund grants to the shop:
  - Funds +300: 3 claims per academic year.
  - Funds +1,000: 1 claim per academic year.
  - Funds +3,000: 1 claim per academic year.
- Fund grants are one-click claims. They do not enter inventory.
- Facilities increase from max Lv.5 to max Lv.50.
- Facilities provide small per-level growth plus milestone effects every 5 levels.
- Add one assistant-coach contract per school year.
- Assistant coach ranks: beginner, intermediate, advanced, master.
- Intermediate and above choose one specialty: attack, defense, or physical.
- Scouting can spend school funds to deepen information about a candidate.
- Existing zero-yen scouting shop items remain and act as free investigation benefits.
- No debt. Funds may never become negative.
- No monthly maintenance-cost simulation in this phase.

## 3. Economy balance

### 3.1 Starting funds

New games begin with:

- Initial activity funds: +300.
- First-year school budget: +400.
- Effective starting balance: 700.

Existing saves keep their current balance and do not receive a retroactive budget when migrated.

### 3.2 Annual school budget

At the first academic-year transition into a year that has not yet received a budget, award:

| Reputation | Annual budget |
| --- | ---: |
| Unknown | 400 |
| District contender | 500 |
| Prefectural power | 650 |
| National qualifier | 850 |
| National regular | 1,100 |
| Elite | 1,400 |

The alumni facility adds a recurring budget bonus described below.

`lastAnnualBudgetYearIndex` prevents duplicate payment.

### 3.3 Official tournament rewards

Rewards are granted by the existing authoritative tournament transition. Existing completed-match / operation idempotency must also make rewards idempotent.

Prefectural level:

- Each win: +25.
- Best 8 reached: +50.
- Best 4 reached: +80.
- Runner-up: +120.
- Champion: +250.

National level:

- Qualification: +250.
- Each win: +60.
- Best 16 reached: +100.
- Best 8 reached: +200.
- Best 4 reached: +350.
- Runner-up: +600.
- Champion: +1,000.

Milestone rewards are attached to the authoritative match/tournament transition that establishes the milestone, not to UI navigation.

### 3.4 Events and alumni support

Existing `funds-change` event effects remain valid, but obviously out-of-scale legacy rewards must be rebalanced to the new economy scale. Event rewards should normally sit in the +20 to +300 range, with rare major alumni events allowed above that.

## 4. Funds history

Add a user-school management state to `GameState`:

```ts
interface SchoolManagementState {
  assistantCoach: AssistantCoachContract | null;
  fundsHistory: FundsLedgerEntry[];
  lastAnnualBudgetYearIndex: number;
}

interface FundsLedgerEntry {
  id: string;
  gameDate: GameDate;
  academicYearIndex: number;
  kind:
    | "initial-funds"
    | "annual-budget"
    | "tournament-reward"
    | "event"
    | "shop-grant"
    | "facility-upgrade"
    | "assistant-coach"
    | "scouting-research"
    | "camp"
    | "travel";
  amount: number;
  balanceAfter: number;
  label: string;
  relatedId?: string;
}
```

Rules:

- Positive amount = income.
- Negative amount = spending.
- Retain the newest 50 entries.
- Every authoritative funds mutation must append a ledger entry in the same state transition.
- UI must never construct ledger entries independently.

## 5. Save compatibility

Increment `CURRENT_GAME_SCHEMA_VERSION` from 6 to 7.

Migration from v6 to v7:

```ts
schoolManagement: {
  assistantCoach: null,
  fundsHistory: [],
  lastAnnualBudgetYearIndex: legacy.yearIndex,
}
```

This deliberately treats the current academic year's budget as already paid for legacy saves, preventing an update-time windfall.

Existing:

- school funds are preserved exactly;
- facility levels are preserved exactly;
- recruiting and shop state are preserved;
- cloud revision semantics are unchanged.

New games create v7 state directly and record the initial +300 and +400 ledger entries.

## 6. Facility progression: Lv.0-50

### 6.1 Common rules

- `FACILITY_MAX_LEVEL = 50`.
- Upgrade cost:

```ts
Math.round(baseCost * (1 + currentLevel * 0.06))
```

- `currentLevel` is 0 through 49 for an upgrade.
- Level 50 is max.
- Upgrade is rejected if funds are insufficient.
- Facility upgrade and funds deduction are one authoritative game operation.
- UI displays `Lv.X / 50`, next cost, and progress.
- Every fifth level shows a milestone description and a milestone-complete result when reached.

Existing base costs remain:

- Gym 80.
- Training room 70.
- Analysis room 55.
- Recovery room 60.
- Dormitory 90.
- Scouting network 75.
- Alumni association 50.
- Study room 45.

### 6.2 Gym

Purpose: overall team-practice quality.

- Per level: +0.2% team-training growth.
- Milestone at Lv.10/20/30/40/50: additional +2% team-training growth each.
- Maximum direct gym training bonus: +20%.

Milestone labels:

- Lv.5: Better practice environment.
- Lv.10: Efficient court rotation.
- Lv.15: Improved high-intensity practice stability.
- Lv.20: High-quality team sessions.
- Lv.25: Better team-practice cohesion gains.
- Lv.30: Strong-school practice environment.
- Lv.35: Reduced condition loss from demanding team sessions.
- Lv.40: National-level practice environment.
- Lv.45: Further high-intensity stability.
- Lv.50: Elite gym.

Where a milestone label describes a non-growth effect, that effect is implemented only if the corresponding domain already has a clean hook; otherwise it is represented by the common training bonus in the first facility PR and may be expanded in a later balancing PR. No placeholder UI claims effects that are not implemented.

### 6.3 Training room

Purpose: raw ability growth.

- Per level: +0.4% ability growth.
- Lv.10: +3% to physical specialty abilities.
- Lv.20: +3% to speed/jump.
- Lv.30: +4% to stamina/block.
- Lv.40: +5% all ability growth.
- Lv.50: +5% all ability growth.
- Total general facility bonus remains around the current Lv.5 ceiling rather than scaling to +400%.

The old `trainingRoom * 8` formula is removed.

### 6.4 Analysis room

Purpose: opponent and tactical information.

Progressively unlock:

- Lv.5: basic opponent tactical profile.
- Lv.10: key players.
- Lv.15: attack tendency.
- Lv.20: serve tendency.
- Lv.25: reception weakness hints.
- Lv.30: block tendency.
- Lv.35: improved expected lineup information.
- Lv.40: advanced tactical preparation.
- Lv.45: high-confidence weakness analysis.
- Lv.50: one highlighted key weakness before an official match.

This facility primarily changes information quality instead of applying a large hidden stat multiplier.

### 6.5 Recovery room

Purpose: condition and injury management.

- Each level slightly improves weekly condition recovery.
- Lv.10: faster recovery from poor condition.
- Lv.20: reduced injury probability.
- Lv.30: reduced duration of very poor condition.
- Lv.40: improved injury recovery.
- Lv.50: top medical environment with the maximum recovery / prevention effect.

Effects must use capped formulas so Lv.50 cannot eliminate injury or condition variance entirely.

### 6.6 Dormitory

Purpose: condition, morale, and cohesion stability.

- Each level adds a small condition-stability bonus.
- Lv.10: reduced morale loss.
- Lv.20: stronger cohesion / trust gains.
- Lv.30: lower chance of poor-condition swings.
- Lv.40: better initial integration of new students.
- Lv.50: strong-school dormitory with the maximum stability bonus.

### 6.7 Scouting network

Purpose: candidate count and baseline information quality.

- Base annual candidate pool remains 6.
- Candidate count gains:
  - Lv.5: +1.
  - Lv.10: +1.
  - Lv.20: +1.
  - Lv.30: +1.
  - Lv.40: +1.
  - Lv.50: +2.
- Maximum normal pool target: 13 candidates before temporary shop effects.
- Each level narrows baseline estimate ranges slightly.
- Lv.25 improves potential-estimate quality.
- Lv.35 exposes one hidden-style hint where available.
- Lv.45 substantially improves potential precision.
- Lv.50 increases the chance of higher-tier candidates, but never guarantees a star player.

### 6.8 Alumni association

Purpose: long-term income engine.

- Annual budget bonus: `level * 8`.
- Lv.10: improved alumni-support event weight.
- Lv.20: additional +100 annual alumni grant.
- Lv.30: improved alumni event rewards.
- Lv.40: unlock rare major-donation events.
- Lv.50: additional +300 annual alumni grant.

At Lv.50 the deterministic annual alumni contribution is therefore +800 before event income (`50 * 8 + 100 + 300`).

### 6.9 Study room

Purpose: reduce academic restrictions on training.

- Each level gradually raises the effective floor for academically restricted training.
- Lv.50 guarantees at least 75% training participation efficiency for academic restriction alone.
- It does not bypass injuries, condition, or other modifiers.

The existing academic bands remain recognizable; the study room mitigates their penalty rather than deleting academics from the game.

## 7. Assistant coach contracts

### 7.1 Contract model

```ts
type AssistantCoachRank =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "master";

type AssistantCoachSpecialty = "attack" | "defense" | "physical";

interface AssistantCoachContract {
  rank: AssistantCoachRank;
  specialty: AssistantCoachSpecialty | null;
  contractYearIndex: number;
}
```

Only one assistant coach may be active.

Contract expires when `contractYearIndex !== state.yearIndex`.

Changing coaches mid-year is allowed; no refund is issued for the previous contract.

### 7.2 Prices and training effects

| Rank | Annual cost | General modifier | Specialty modifier |
| --- | ---: | ---: | ---: |
| Beginner | 80 | +5% | N/A |
| Intermediate | 200 | +8% | +14% |
| Advanced | 450 | +12% | +22% |
| Master | 900 | +18% | +30% |

Specialty ability groups:

- Attack: spike, serve, set.
- Defense: receive, block.
- Physical: speed, jump, stamina.

Advanced:

- When a player's condition is below 60, add an extra +4% assistant-coach recovery modifier to training growth.

Master:

- Same low-condition modifier at +8%.
- Grade-1 players receive an additional +5% development modifier.
- One seeded 10% chance per resolved weekly training to trigger special instruction for one eligible player, granting a small additional focused growth result. It must use the game random source and remain deterministic under replay.

Assistant-coach modifiers are separate from the existing head-coach development modifier.

## 8. Staff UI

Add `staff` to school navigation.

Staff screen shows:

- current contract;
- contract expiry;
- specialty;
- exact training modifiers;
- all four available ranks;
- post-contract funds preview;
- insufficient-funds reason where applicable.

For intermediate/advanced/master, choosing the contract opens a specialty selector before confirmation.

## 9. Paid scouting research

### 9.1 Candidate research levels

Persist a candidate investigation tier:

```ts
type ScoutingResearchTier = 0 | 1 | 2 | 3;
```

Tier 0 is free baseline information.

Paid actions:

- Additional research: 50 -> tier at least 1.
- Thorough research: 150 -> tier at least 2.
- Complete research: 300 -> tier 3.

A player may jump directly to a higher tier and pays that tier's listed price. Previous spending is not refunded or credited.

A tier cannot be purchased again once the candidate already has that tier or higher.

### 9.2 Information revealed

Tier 0:

- broad overall estimate;
- broad potential estimate;
- basic physical / achievement information;
- low or facility-adjusted confidence.

Tier 1:

- narrower overall estimate;
- more reliable achievement data;
- one strength hint.

Tier 2:

- further narrowed overall and potential estimates;
- personality tendency;
- growth-type hint;
- one weakness hint.

Tier 3:

- high-precision current ability estimate;
- narrow potential range, but never exact future certainty;
- growth type;
- personality;
- available hidden-trait/style hints.

Scouting-network level improves the starting widths at every tier.

### 9.3 Existing zero-yen shop scouting items

Keep:

- `scout-research`.
- `potential-appraisal`.

They remain free shop benefits and improve candidate insight without consuming school funds.

They must never reduce a candidate's existing research tier or precision.

### 9.4 Authoritative mutation

Paid scouting research must atomically:

1. validate candidate/cycle;
2. validate current tier;
3. validate school funds;
4. deduct funds;
5. update scouting insight;
6. append a funds ledger entry;
7. increment game revision;
8. return the updated scout report and balance.

A single server-side RPC or equivalent transaction boundary must own this mutation. Do not split deduction and insight persistence across independent requests.

## 10. Zero-yen fund grants in the shop

Add item IDs:

- `funds-grant-300`.
- `funds-grant-1000`.
- `funds-grant-3000`.

Definitions:

| Item | Shop price | Annual purchase limit | Effect |
| --- | ---: | ---: | ---: |
| funds-grant-300 | ¥0 | 3 | +300 funds |
| funds-grant-1000 | ¥0 | 1 | +1,000 funds |
| funds-grant-3000 | ¥0 | 1 | +3,000 funds |

Existing yearly counters remain the source of annual limits.

These are immediate-delivery items:

- purchase button label is `¥0で受け取る`;
- no inventory quantity is created;
- no separate use action is required;
- the authoritative shop purchase transaction updates the cloud game state, appends `shop-grant` to the ledger, and increments revision atomically;
- response includes `fundsGranted` and `balanceAfter` for result presentation.

The current database constraint that shop price is exactly zero remains unchanged.

## 11. School funds UI

The school hero continues to show current funds.

Make the funds display interactive. Opening it shows a bottom sheet with the latest ledger entries, newest first.

Example:

- `9/5  National tournament win  +60`
- `8/28 Thorough scouting research  -150`
- `8/12 Advanced assistant coach  -450`
- `7/20 Alumni support  +120`
- `6/15 Gym Lv.12 -> 13  -138`
- `4/1 Annual school budget  +650`

Every spending confirmation shows:

- required funds;
- current funds;
- resulting funds;
- if insufficient, the missing amount.

## 12. Server-authoritative boundaries

Funds are authoritative game state and must not be mutated only in React state.

All fund-changing operations must pass through an existing or new Worker operation with:

- authentication;
- expected revision;
- operation ID / replay safety;
- atomic persistence;
- updated revision in the response.

This applies to:

- facility upgrades;
- assistant-coach contracts;
- paid scouting research;
- shop fund grants;
- tournament rewards;
- annual budgets;
- fund-changing events.

## 13. API / action changes

### Game actions

Add:

```ts
{ type: "assistant-coach-contract"; rank; specialty }
```

Facility upgrade stays on the existing game-action path.

Annual budgets and tournament rewards are automatic consequences of existing authoritative progression and do not get client-triggerable reward actions.

### Scouting

Add a dedicated paid-research mutation under the scouting route family rather than exposing candidate internals through generic game actions.

Suggested contract:

```ts
POST /api/scouting/research
{
  operationId,
  revision,
  candidateId,
  tier: 1 | 2 | 3
}
```

### Shop

The existing purchase endpoint remains. Immediate fund-grant items are distinguished server-side by item/effect definition and return an immediate grant result rather than inventory.

## 14. Database migration

Add one new Supabase migration after `202609040008_fix_scouting_candidate_pool_conflict.sql`.

Responsibilities:

- insert the three zero-yen fund-grant item definitions;
- extend shop purchase logic for immediate fund grants while preserving inventory semantics for existing items;
- extend candidate insight storage from the current coarse precision fields to a research-tier model compatible with existing rows;
- add/replace the paid scouting research RPC with service-role-only execution;
- preserve RLS / revoked browser access;
- preserve operation replay and revision conflict semantics.

Existing insight rows migrate conservatively:

- normal -> tier 0;
- researched overall -> at least tier 1;
- appraised potential -> at least tier 2.

No existing insight becomes less precise after migration.

## 15. Testing strategy

Every implementation phase follows RED -> GREEN.

### Save migration

- v6 save decodes into v7.
- funds and facility levels are unchanged.
- assistant coach is null.
- current-year budget is not duplicated.
- new v7 state round-trips.

### Economy

- annual budget is awarded once per academic year.
- reputation budget table is exact.
- alumni annual bonus is exact.
- tournament reward is awarded once.
- duplicate operation/replay cannot duplicate funds.
- ledger tracks balance correctly and caps at 50.
- funds never go negative.

### Facilities

- level 49 -> 50 succeeds when affordable.
- level 50 cannot upgrade.
- costs match formula.
- training room no longer uses `level * 8`.
- milestone effects and UI labels match actual domain effects.

### Assistant coach

- contract deducts exact funds.
- insufficient funds rejects without mutation.
- specialties affect only intended ability groups.
- contract expires on year change.
- replacement has no refund.
- master special instruction is deterministic from seeded RNG.

### Scouting

- each research tier narrows/reveals expected data.
- direct jump to tier 3 costs 300.
- repeat same/lower tier is rejected.
- insufficient funds is atomic: no funds or insight mutation.
- zero-yen scouting items never reduce precision.
- scouting-network level improves baseline quality.

### Shop fund grants

- +300 grants exactly 300 and can be claimed three times/year.
- fourth +300 claim is rejected.
- +1,000 and +3,000 are once/year.
- grant creates no inventory.
- grant updates state, ledger, counter, and revision atomically.
- replay does not duplicate grant.

### Regression suite

Before each PR is merged:

- format;
- lint;
- typecheck;
- domain/unit/integration tests;
- production build;
- mobile E2E;
- dependency audit.

## 16. Implementation decomposition

### PR 1 - Economy foundation

- schema v7 and migration;
- ledger helpers;
- annual budget;
- tournament rewards;
- event reward rebalance;
- three immediate shop fund grants;
- funds history UI.

### PR 2 - Facility Lv.50

- max level / cost curve;
- per-level effects;
- milestone model;
- training formula rebalance;
- facility UI.

### PR 3 - Assistant coaches

- contract model and action;
- yearly expiry;
- training modifiers;
- staff tab / UI.

### PR 4 - Paid scouting research

- research tier persistence;
- atomic paid research RPC;
- scouting-network baseline effects;
- scouting UI;
- coexistence with existing free shop investigation items.

Each PR must be independently green before the next is merged.

## 17. Non-goals

Not part of this scope:

- real-money payment integration;
- changing the shop away from ¥0;
- debt / loans;
- monthly payroll or maintenance fees;
- transfer-market style player purchases;
- multiple simultaneous assistant coaches;
- removing head-coach attributes;
- exact future-potential revelation in scouting.

## 18. Success criteria

The design is successful when a player can clearly answer all three questions:

1. How do I earn funds?
2. What can I spend funds on?
3. Why should I choose one investment over another?

A normal multi-year game should produce competing choices between facilities, coaching, and scouting, while the zero-yen shop fund grants remain an optional fast-progression / test path rather than being required for normal play.
