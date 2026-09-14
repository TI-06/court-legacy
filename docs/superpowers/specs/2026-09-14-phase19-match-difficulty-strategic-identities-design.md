# Phase19-4 Match Difficulty & Strategic Identities Design

Date: 2026-09-14
Status: Proposed for implementation after user review
Base: `b09f431ef9fd3f51301d9bfb6e58678d4fa50e61`

## Goal

Make solo/PVE matches feel meaningfully different by school identity and coaching quality without introducing hidden flat difficulty bonuses or weakening the existing authoritative PvP/privacy boundary.

The player should be able to recognize what an opponent is trying to do, make a counter-adjustment, and see that adjustment matter. Strong CPU schools should be harder because they have stronger rosters, clearer identities, and better decisions—not because the engine secretly boosts their raw abilities.

## Current State

The match engine already supports three tactical axes:

- serve: `safe | balanced | aggressive`
- attack: `side | balanced | quick`
- block: `commit | mixed | read`

Attack/block matchup points exist, serve has a real risk/reward profile, and interactive matches already stop at two coach-decision boundaries:

- opponent run of 4+ consecutive points
- set break

The engine also contains an `AutomaticCoachPolicy` interface that can issue `timeout` or `continue`, but the current PVE worker path does not connect an automatic opponent coach.

Schools already have eight archetypes:

1. balanced
2. defense
3. height
4. speed
5. ace
6. serve
7. development
8. rotation

Today those identities only partially affect match behavior. Attack tempo and block system are represented, but serve style is not reliably archetype-specific, `defenseBias` is intentionally inert in match simulation, and the opponent does not adapt during an interactive PVE match.

## Design Principles

1. **No hidden flat CPU stat bonus.** Difficulty comes from roster strength, tactical identity, coach quality, and better decisions.
2. **Readable counterplay.** If tactics affect outcomes, the player must be able to see enough public information to reason about the matchup.
3. **No universal best tactic.** Every aggressive choice must carry a trade-off or matchup dependency.
4. **CPU decisions use public match information only.** No access to opponent-private hidden traits, private bench data, unrevealed abilities, or PvP-private runtime data.
5. **PVE-only adaptive AI.** PvP authority, privacy, idempotency, and reconnect semantics remain unchanged.
6. **Deterministic under seed.** All policy choices must be deterministic given the same public match state and seeded source.
7. **Balance by distributions, not anecdotes.** Changes must be validated over many deterministic simulations.

## Alternatives Considered

### A. Flat difficulty multiplier

Add 2–10% hidden bonuses to CPU ability calculations based on reputation.

Rejected because it is difficult to read, feels unfair, and duplicates the roster-strength work already completed in Phase19-1.

### B. Static school identity only

Make archetypes start with more distinctive tactics but do not allow CPU adaptation during matches.

This is safer and smaller, but it leaves the existing coach-decision infrastructure underused and does not create enough managerial gameplay.

### C. Strategic identity + adaptive CPU coach

Use school archetype to define default style, then allow stronger coaches to adapt at public decision boundaries.

**Chosen.** It creates visible school identity, keeps the engine understandable, and makes coaching quality matter without hidden stat inflation.

## Architecture

### 1. Canonical strategic identity profile

Add a pure domain module, tentatively:

`src/domain/match/schoolMatchIdentity.ts`

It maps each school archetype to a canonical match identity profile.

Suggested shape:

```ts
interface SchoolMatchIdentityProfile {
  preferredPlan: MatchTacticPlan;
  attackDistributionBias?: Partial<Record<Position, number>>;
  defensePreference: TeamTactics["defenseBias"];
  substitutionAggression: number;
  adaptationBias: "hold-style" | "balanced" | "counter-heavy";
}
```

The profile does not directly add raw player ability. It determines how the school wants to play.

Initial identity intent:

- balanced: balanced serve / balanced attack / mixed block / balanced defense
- defense: safe or balanced serve / side attack / read block / defense-oriented coverage
- height: balanced serve / side attack / commit block / high-ball and blocking emphasis
- speed: balanced serve / quick attack / read block / tempo emphasis
- ace: aggressive or balanced serve / side-heavy attack / mixed block / ace concentration
- serve: aggressive serve / balanced attack / commit or mixed block
- development: balanced conservative plan / read block / stable decisions
- rotation: balanced plan / mixed block / more substitution willingness

The exact initial values are balance data, not schema guarantees. Tests should verify behavioral identity rather than hard-code every internal coefficient unless needed.

### 2. Archetype defaults at school generation

`generateSchool.ts` currently chooses `serveRisk` mostly randomly. Phase19-4 should make the generated school tactics consistent with the selected archetype profile while retaining small bounded variation.

Examples:

- serve school cannot randomly spawn as a low-risk serving team
- speed school starts with quick-oriented attack tempo
- height school starts with commit-oriented block behavior

This affects newly generated worlds. Existing saves keep their stored tactics; no save migration is required.

### 3. Defense bias becomes a real matchup axis

`defenseBias: line | balanced | cross` currently has no simulation effect.

Phase19-4 will connect it to attack direction in a bounded, symmetric way rather than as a flat defense boost.

Add a deterministic attack-direction decision per attacking rally:

- `line`
- `cross`
- `middle/neutral` when appropriate

Direction probability should be derived from attacker role, decision ability, current attack plan, and bounded randomness.

Defense bias then modifies dig effectiveness:

- correct read: modest defensive advantage
- wrong read: modest defensive disadvantage
- balanced: smaller but stable outcome

The adjustment must be small enough that raw ability remains primary. Proposed target is roughly an effective ±2–4 points in the relevant defensive comparison, subject to simulation tuning.

The public event log should contain a non-sensitive detail code sufficient for presentation/analysis, e.g. `attack.line`, `attack.cross`, or an equivalent existing-safe code path.

### 4. CPU coach policy

Add a PVE-only pure policy module, tentatively:

`src/domain/match/cpuCoachPolicy.ts`

It consumes only public or school-owned information:

- own school archetype / own stored tactics
- own coach `tactics` rating
- school reputation
- current score/set
- public current match tactics
- event log / aggregate visible match statistics
- whether own timeout is available
- current scoring run

It must not inspect opponent hidden traits, private abilities that are not already public in PVE presentation, unrevealed bench information, or PvP-private structures.

### 5. CPU decision tiers

Decision quality is derived from coach tactics plus school reputation, without directly changing player stats.

Suggested tiers:

- **Tier 0 — Hold style**: weak coach / weak reputation. Mostly sticks to archetype identity, uses timeout only on obvious long runs.
- **Tier 1 — Basic adjustment**: can switch one tactical axis when evidence is clear.
- **Tier 2 — Counter-aware**: can recognize serve pressure or attack/block mismatch and respond.
- **Tier 3 — Strong national AI**: evaluates multiple public signals and chooses the best bounded response while still respecting archetype identity.

The tier formula should be deterministic and monotonic in coach tactics/reputation. It should not expose reputation as a direct win multiplier.

### 6. Automatic decision behavior

At `opponent-run`:

- use timeout if available and the run is sufficiently severe
- otherwise optionally adjust one tactical axis
- otherwise continue

At `set-break`:

- no timeout
- assess previous-set public statistics
- optionally adjust serve/attack/block plan
- optionally prepare a substitution recommendation/action only if this can be implemented without exposing hidden data and without destabilizing the current match-command model

For Phase19-4, automatic substitution is **not required for initial scope**. The rotation archetype may express higher substitution intent in policy scoring, but actual automatic substitutions should be deferred unless implementation remains clean and testable. This prevents Phase19-4 from expanding into a new substitution AI subsystem.

### 7. Extend automatic coach command support

Current `AutomaticCoachPolicy` only returns `timeout | continue`. Phase19-4 should extend the PVE automatic policy path to support:

- `timeout`
- `set-match-tactics`
- `continue`

The automatic path should use the same authoritative match-state mutation rules as human commands wherever practical.

Do not create a second independent tactical mutation implementation.

### 8. PVE worker integration

Wire automatic CPU coaching into:

- interactive practice matches
- interactive official matches

The worker identifies the opponent school and passes:

- `automaticCoachSchoolId`
- deterministic CPU policy

into `startMatch` / `resumeMatch`.

Non-interactive simulations may keep their existing static behavior unless balance evidence shows that CPU-vs-CPU tournament results need the adaptive policy as well. Phase19-4 scope prioritizes user-facing PVE matches.

### 9. User-facing opponent adjustment feedback

When the CPU changes tactics, append a public match event / command-history presentation entry such as:

- `相手がサーブを強気に変更`
- `相手が速攻重視へ変更`
- `相手がリードブロックへ変更`

The user does not need to see the CPU's internal reason score.

The existing user command panel remains at the same two decision boundaries. No extra interruption cadence is introduced in this phase.

### 10. Difficulty model

Phase19-4 does **not** add a user-selectable Easy/Normal/Hard toggle.

Difficulty emerges from:

- opponent roster strength (Phase19-1)
- opponent strategic identity
- opponent coach/reputation decision tier
- tactical matchup
- user decisions

A selectable difficulty mode can be considered later if playtesting still needs one. Avoid layering it on before the natural difficulty model is validated.

## Tactical Balance Targets

These are validation targets, not hard-coded formulas.

### Equal-strength baseline

Across a sufficiently large deterministic seed set:

- same strength + same tactical plan should remain approximately 50/50
- home/away ordering should not create a material persistent advantage

### Matchup effect

At equal strength:

- a clearly favorable tactical matchup should produce a measurable edge
- target aggregate win rate: roughly 55–60%, not 70–90%
- a single tactic must never dominate every opposing plan

### Ability remains primary

When roster average ability has a meaningful gap, tactics can narrow but should not routinely erase it.

A rough acceptance target:

- +8 to +10 average ability should still be strongly favored
- tactical advantage should improve underdog outcomes without making them near-coinflip by default

### CPU intelligence

Against the same opponent and same deterministic seed distribution:

- stronger CPU decision tiers should improve or preserve win rate compared with Tier 0
- improvements should come from changed tactics/timeouts, not raw stat mutation
- weak CPU schools remain capable of poor/stubborn decisions

## Public Information Boundary

CPU policy may read:

- own full team data
- opponent school identity that is already public
- public/current match tactics
- score, set, run length
- public event log and derived match stats

CPU policy must not read for decision-making:

- opponent hidden trait definitions not exposed to the user
- opponent private scouting-only values
- PvP defender-private selection/runtime data
- private command transport metadata

Even though solo PVE state contains both schools in memory, the policy API should accept an intentionally narrowed view so future code cannot accidentally rely on hidden opponent data.

## Determinism and Idempotency

- Policy evaluation must not call unseeded randomness.
- If randomness is necessary for imperfect CPU choices, derive it from existing deterministic match seed/cursor or a stable fork keyed by decision identity.
- The same authoritative match state must produce the same CPU decision.
- Existing PvP `commandId` idempotency behavior is untouched.
- Reconnect/resume of a solo match must not cause a CPU decision to execute twice. Existing command-history consumption semantics should be extended to tactic-change automatic decisions.

## Data / Save Compatibility

Preferred implementation requires no schema bump.

- school archetype already exists
- school tactics already exist
- runtime tactics already exist
- command history already exists

If implementation requires persisting additional runtime-only public event detail, it should be optional/backward-compatible. A save schema bump is a last resort and requires a separate explicit review.

## Testing Strategy

### Unit tests

Add Phase19-4 focused tests for:

1. archetype-to-identity mapping
2. generated serve/speed/height schools preserve recognizable identity
3. defenseBias correct-read vs wrong-read effect
4. balanced defense remains stable and not strictly dominant
5. CPU decision tier derivation
6. weak CPU holds style more often
7. strong CPU counters known public mismatch
8. automatic tactic change is recorded exactly once
9. resume does not duplicate automatic decisions
10. CPU policy cannot require hidden opponent player data
11. PvP command/authority/privacy tests remain unchanged and GREEN

### Simulation harness

Add a deterministic multi-seed tactical matrix harness.

Minimum matrix:

- same vs same
- quick vs each block plan
- side vs each block plan
- safe/balanced/aggressive serve profiles
- line/cross/balanced defense against representative attack direction mixes
- each of the eight archetypes against representative contrasting archetypes

Record:

- match win rate
- set win rate
- point differential
- serve ace/error rates
- attack points
- block points
- defense points
- tactic changes per match
- timeout usage

### CPU intelligence A/B

Run identical seed sets with the same roster and school identity under:

- Tier 0 static/hold policy
- highest CPU decision tier

Acceptance: stronger policy should produce a modest aggregate improvement where counterplay exists without gaining an artificial edge in symmetric neutral matchups.

### Regression suite

Before PR:

- focused Phase19-4 tests GREEN
- full `npm run verify` GREEN
- release check GREEN
- existing Phase15 tactical tradeoff tests GREEN or deliberately updated only where the new defense axis changes the approved contract
- Phase16 resumable/command/privacy tests GREEN
- mobile E2E GREEN on official PR CI

## UI / Presentation Scope

Keep UI changes small and mobile-first.

Required:

- visible opponent tactic-change notification/event
- current public opponent tactical summary remains understandable

Not required:

- new full-screen tactical dashboard
- new difficulty settings page
- new character animation
- new substitution AI UI

## Non-Goals

Phase19-4 will not:

- change PvP authority or privacy contracts
- add selectable difficulty levels
- add hidden CPU stat bonuses
- rebalance player growth/economy
- redesign match result UI
- implement long-term rival memory/history (Phase19-5)
- add full automatic substitution AI unless it is trivially safe within the existing command model

## Expected Files / Boundaries

Likely new domain files:

- `src/domain/match/schoolMatchIdentity.ts`
- `src/domain/match/cpuCoachPolicy.ts`

Likely modified files:

- `src/domain/generation/generateSchool.ts`
- `src/domain/match/simulateMatch.ts`
- `src/domain/match/applyMatchCommand.ts` if command reuse requires it
- `worker/game/applyGameAction.ts`
- match presentation components for public CPU tactic-change feedback
- focused unit/simulation tests

Avoid unrelated refactors.

## Acceptance Criteria

Phase19-4 is complete only when all of the following are evidenced:

1. all eight school archetypes have recognizable tactical identities
2. serve archetype no longer randomly behaves as a low-risk serving school by default
3. defenseBias has a bounded real matchup effect
4. PVE opponent coach adapts at existing decision boundaries
5. stronger CPU coaching quality outperforms or matches weak coaching in appropriate A/B simulations
6. no hidden raw-stat difficulty multiplier is introduced
7. no universal tactical best choice appears in the matrix
8. PvP privacy/authority/idempotency tests remain GREEN
9. focused tests, full verify, release check, PR CI, and post-merge main CI are GREEN
10. final merge is not declared complete until post-merge main CI is confirmed GREEN
