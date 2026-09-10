# Phase 16 — Match Command Design

Status: Approved product direction; written specification for implementation planning review.

Date: 2026-09-10

## 1. Purpose

Phase 16 turns the current match playback into a limited interactive coaching experience.

The player should make a small number of high-value decisions during a match without turning every rally into manual micromanagement. A coaching decision must be able to change the remaining simulation, so the match engine can no longer calculate the complete final result before the UI reaches the decision.

Phase 16 builds on Phase 15 tactics and the existing `MatchState.phase = "coach-decision"`, `pendingCoachCommandForSchoolId`, `CoachCommand`, `GameState.activeMatch`, event log, deterministic seed, and random cursor foundations.

## 2. Product principles

Phase 16 follows these rules:

- coaching choices must affect only the unrevealed future of the match;
- decisions must be infrequent and meaningful;
- normal team selection and normal team tactics are never overwritten by match-only commands;
- the deterministic random cursor remains authoritative and resumable;
- practice, official, and asynchronous PvP matches use the same match-command domain rules where possible;
- PvP never exposes private opponent player abilities, hidden traits, serve-target IDs, or other private simulation data;
- fatigue is not reintroduced as a recurring manual-management chore;
- rankings, coach skill trees, and season-goal systems stay outside Phase 16.

## 3. Current-state problem

`simulateMatch()` currently simulates every rally, set, and the final result in one call. `MatchScreen` then reveals the already-complete `eventLog` one event at a time.

That architecture cannot support a meaningful in-match command: by the time the user sees the score, the outcome already exists.

Phase 16 therefore separates match simulation into resumable segments.

## 4. Scope

Phase 16 adds three user-facing coaching commands:

1. `タイムアウト`
2. `戦術変更`
3. `選手交代`

Every decision point also provides `このまま続ける`.

Phase 16 does not expose the existing lower-level `serve-target`, `attack-focus`, `defense-bias`, or `encourage` command variants as primary user controls. Those types may remain for compatibility until later cleanup, but Phase 16 user flows are limited to timeout, the Phase-15 three-axis tactic plan, substitution, and continue.

## 5. Decision timing

The match does not pause every point.

There are exactly two classes of user decision opportunity.

### 5.1 Opponent-run decision

A decision opportunity is created when the user's team loses four consecutive points in the same set.

Rules:

- at most one opponent-run decision opportunity per set;
- the trigger is based only on completed point events in the current set;
- if the user chooses `このまま続ける`, another four-point run in the same set does not interrupt play again;
- if the match is already complete, no decision is created;
- the user may choose timeout, tactics change, substitution, or continue.

This gives the coach a chance to react to momentum without repeated interruption.

### 5.2 Set-break decision

After a set completes and before the next set begins, the user's match enters a set-break decision opportunity unless the match itself is complete.

Available actions:

- tactics change;
- substitution;
- continue.

Timeout is not offered between sets because the set break already provides a natural reset.

## 6. Match phases

The existing `MatchPhase` values remain the vocabulary:

- `pre-match`
- `set-in-progress`
- `coach-decision`
- `set-complete`
- `match-complete`

Phase 16 makes these phases operational rather than mostly descriptive.

A normal path is:

```text
pre-match
  -> set-in-progress
  -> coach-decision (optional opponent run)
  -> set-in-progress
  -> set-complete
  -> coach-decision (set break)
  -> set-in-progress
  -> ...
  -> match-complete
```

`pendingCoachCommandForSchoolId` is non-null only while `phase === "coach-decision"`.

## 7. Resumable match runtime

### 7.1 Active match as the resumable state

`GameState.activeMatch` is the authoritative in-progress match state for the user's PvE/official flow.

Phase 16 extends `MatchState` with optional runtime fields required to resume safely while preserving schema-v8 compatibility for older saves that have `activeMatch = null` or legacy completed matches.

The runtime must contain enough information to resume without replaying hidden future rallies:

- current set number and current set score;
- current home/away set wins;
- current serving school;
- current in-match home/away selections;
- current in-match tactic plan for both sides;
- completed sets;
- event log produced so far;
- random seed and consumed random cursor;
- current point-run owner/count;
- whether the opponent-run decision has already been consumed for the current set;
- timeout usage for the current set;
- pending decision reason;
- compact command history needed for result presentation.

The implementation may group these fields under a dedicated runtime structure rather than adding many top-level fields, but there must be exactly one authoritative in-match state.

### 7.2 No precomputed future

When the simulator returns `coach-decision`, no events after that decision may already exist in the authoritative event log.

When the user issues a command, simulation resumes from the stored random cursor. It must not regenerate earlier rallies or consume randomness for unrevealed future rallies before the command is applied.

### 7.3 Determinism

For a fixed:

- initial game state;
- initial lineups;
- initial match-only tactic plans;
- seed/cursor;
- ordered sequence of coach commands;

Phase 16 must produce the same final match, score, event log, command history, and final random cursor.

## 8. Domain API shape

The one-shot `simulateMatch()` remains available as a compatibility helper for non-interactive/internal uses if required, but it must be implemented on top of the same resumable core or otherwise remain behaviorally consistent.

The resumable domain should expose responsibilities equivalent to:

```ts
startMatch(input): MatchStepResult
resumeMatch(input): MatchStepResult
applyCoachCommand(input): MatchState
```

Exact function names may follow repository conventions during planning, but responsibilities must remain separate:

- initialize a match;
- simulate only until the next decision or match completion;
- validate and apply one command to the authoritative current match state;
- resume from the stored random cursor.

A `MatchStepResult` contains the updated `MatchState` and includes final `MatchAnalysis` only when the match completes.

## 9. Command model

Phase 16 adds/uses a high-level match tactic command instead of exposing low-level individual tactic fields independently.

The user-facing command union is conceptually:

```ts
type MatchCommand =
  | { type: "timeout" }
  | { type: "set-match-tactics"; plan: MatchTacticPlan }
  | {
      type: "substitute";
      outgoingPlayerId: PlayerId;
      incomingPlayerId: PlayerId;
    }
  | { type: "continue" };
```

The implementation can adapt the existing `CoachCommand` type, but the server/domain validation must accept only commands valid for the current decision reason.

## 10. Timeout behavior

Timeout is intentionally simple and bounded.

Rules:

- timeout is available only at an opponent-run decision;
- maximum one user timeout per set;
- attempting another timeout in the same set is rejected;
- timeout never restores fatigue because Phase 16 does not revive fatigue micromanagement;
- timeout creates a temporary stabilization effect for the user's next five rallies.

Initial stabilization target:

- decision effective ability: +4%;
- mental effective ability: +5%;
- effect expires after five completed rallies or at set end, whichever comes first;
- effective abilities remain clamped to existing match-engine safety bounds.

The exact effect is applied once and is not displayed as permanent player growth.

A timeout creates a `timeout` match event and one command-history record before simulation resumes.

## 11. In-match tactics change

The tactics command uses the Phase-15 `MatchTacticPlan` with the same three axes:

- serve: safe / balanced / aggressive;
- attack: side / balanced / quick;
- block: commit / mixed / read.

Rules:

- the full three-axis plan is submitted together;
- it replaces only the user's current match-local tactic plan;
- it applies from the next simulated rally;
- it never writes to authoritative normal `School.tactics`;
- Phase-15 matchup trade-offs and serve risk/reward remain the underlying simulation model;
- the opponent's PvE tactics remain controlled by its match-local plan;
- a PvP defender continues to use the tactics frozen in the published snapshot / deterministic server-side opponent state.

## 12. Substitution behavior

Substitution is match-local.

Rules:

- outgoing player must currently be in the six-player rotation;
- incoming player must be a valid current match bench player;
- injured or otherwise invalid players remain subject to existing team-selection validation rules;
- position/selection invariants must remain valid after the substitution;
- the updated in-match selection persists for subsequent rallies and subsequent sets until changed again during this match;
- persistent normal `teamSelection` is never modified;
- the command creates a `substitution` event and command-history record before simulation resumes.

Phase 16 does not implement full official volleyball substitution-count bookkeeping. The user can make one substitution action at each available decision point, subject to lineup validity. This is a deliberate game abstraction.

## 13. Continue behavior

`continue` consumes the current decision opportunity without changing lineup or tactics.

It records that the decision was consumed so the same trigger cannot immediately re-open on resume.

For a set-break decision, `continue` begins the next set.

## 14. Command validation

Commands are accepted only when:

- `activeMatch.phase === "coach-decision"`;
- `pendingCoachCommandForSchoolId` is the user school for a user command;
- the submitted decision reason matches the current pending decision;
- the command is allowed for that reason;
- tactic enums are valid;
- substitution player IDs are valid for the current in-match selection;
- timeout has not already been used in the current set.

Invalid commands fail explicitly. They never silently coerce to another tactic, silently repair a lineup, or advance the random cursor.

A rejected command leaves `activeMatch`, persistent team state, and random cursor unchanged.

## 15. Match engine rally changes

The existing rally pipeline stays recognizable:

1. serve;
2. receive;
3. set;
4. attack;
5. block/dig;
6. point;
7. side-out rotation when required.

After each completed point, the runtime updates the current scoring-run counter and checks whether the user's four-point opponent-run decision should open.

At set completion, the engine writes `set-end`, updates set wins, then either:

- completes the match; or
- transitions to the set-break `coach-decision` before the next set starts.

The engine must not reset match-local tactic changes or substitutions simply because a set ended.

## 16. UI — interactive match screen

The current match playback screen becomes an interactive live coaching screen while preserving fast/instant accessibility paths.

During live play it shows:

- competition/match label;
- both school names;
- current set score;
- set wins;
- visible team strength summary;
- current play/event;
- recent event timeline;
- current user tactic labels in compact form;
- a clear momentum warning when a coach decision opens.

When `phase === "coach-decision"`, normal auto playback pauses and a prominent command panel appears.

Opponent-run copy example:

```text
相手に4連続ポイントを許しています
監督指示
[タイムアウト] [戦術変更]
[選手交代]
[このまま続ける]
```

Set-break copy example:

```text
セット間の監督指示
[戦術変更] [選手交代]
[このまま次セットへ]
```

### 16.1 Tactics command UI

The command panel reuses Phase-15 tactic presentation/helpers. It must not create a new persistent tactics editor.

The user can select the three axes, see the opponent public tendency/matchup hint when allowed, and apply the full match-local plan.

### 16.2 Substitution UI

The substitution flow is optimized for mobile:

- first choose one current court player;
- then choose one eligible bench player;
- show position, condition, and public own-player grade information already available elsewhere in the game;
- confirm one swap;
- return directly to match continuation.

No drag-and-drop requirement is introduced.

### 16.3 Playback controls

The existing playback speeds remain useful between decision points.

- `再生` automatically advances visible events until the authoritative segment ends;
- `次のプレー` advances one visible event;
- `結果まで進む` is replaced/adjusted while an interactive match is active so it may fast-forward only to the next required coach decision or final result, never silently skip an unresolved decision;
- instant/reduced-motion modes still surface required decision panels.

## 17. Result screen — command impact

The result screen adds a compact `監督采配` section when at least one command was issued.

It shows factual before/after evidence derived from the event log rather than invented causal claims.

For each command, present data such as:

- set and score when the command was issued;
- command label;
- next-five-rally point split for timeout/tactics commands where available;
- substitution player names and subsequent points while the substitute was active where reliably derivable.

Example presentation:

```text
第1セット 13-16
タイムアウト
次の5ラリー: 4-1
```

The UI must not state that a command "caused" a turnaround. It reports observed post-command results only.

## 18. PvE and official-match integration

Practice and official matches use `GameState.activeMatch` as the authoritative interactive match session.

Week/tournament progression must not finalize rewards, history, schedule advancement, or tournament bracket advancement until the match reaches `match-complete`.

Starting a match creates/updates the active match and returns the first simulation segment. Applying a command resumes the same match. Finalization occurs exactly once after completion.

Existing retry/idempotency safeguards for official progression must be preserved.

## 19. Asynchronous PvP integration

PvP remains asynchronous, not live head-to-head.

The challenger may receive Phase-16 coaching decisions while playing its challenge. The defender does not need to be online.

Defender behavior is deterministic and server-owned. It uses:

- the published defender lineup snapshot;
- the published defender tactics snapshot;
- bounded automatic coach decisions when appropriate.

The public PvP response must not expose defender private runtime fields, player abilities, private traits, raw serve-target IDs, or automatic decision inputs.

The challenger cannot submit a command on behalf of the defender.

If interactive PvP session persistence would materially expand PR16-1, PvP integration is deferred to PR16-3; the resumable core must nevertheless be designed without blocking that integration.

## 20. Automatic defender coaching

For PvE opponents and asynchronous PvP defenders, the match engine may make a deterministic automatic response instead of pausing for a human command.

Initial YAGNI policy:

- do not build a complex AI coach tree;
- at a four-point opponent run, choose deterministically between timeout and continue based on simple coach-tactics/leadership thresholds and remaining timeout availability;
- at set breaks, keep current tactics/lineup unless an existing deterministic system explicitly provides a safe change;
- automatic choices consume no extra hidden randomness unless the rule explicitly uses the match random source and is covered by deterministic tests.

Human-user decision semantics remain the priority.

## 21. Persistence and schema compatibility

Target: keep `CURRENT_GAME_SCHEMA_VERSION = 8`.

Rationale:

- `GameState.activeMatch` already exists;
- older normal saves generally have `activeMatch = null`;
- completed historical summaries do not require new fields;
- new runtime fields can be optional/defaulted when reading an old active match.

If implementation discovers that an existing persisted non-null active match cannot be safely interpreted without migration, planning must stop and explicitly justify a schema change rather than silently weakening compatibility.

## 22. Error and recovery behavior

- reloading during `coach-decision` restores the same score, event log, pending decision, in-match lineup/tactics, and random cursor;
- retrying a rejected command does not consume randomness;
- duplicate accepted command submission must not apply twice;
- network failure after a command submission must be recoverable by reloading authoritative active-match state;
- match finalization must be idempotent so rewards/history/bracket progression cannot duplicate;
- a corrupt active match fails visibly rather than fabricating a result.

## 23. Mobile acceptance

Interactive match and all command sheets/panels must pass the established widths:

- 320 px
- 360 px
- 390 px
- 414 px
- 480 px

Acceptance includes:

- no horizontal page overflow;
- command actions remain reachable above bottom navigation/safe area;
- sticky actions never cover score or selection content;
- long Japanese school/player names degrade gracefully;
- tactics options and substitution rows remain tap-safe;
- reduced-motion mode does not hide decisions;
- decision sheets do not create nested scrolling traps.

## 24. Testing strategy

### 24.1 Domain tests

Cover at minimum:

- first simulation stops before any future event after a user decision;
- four consecutive opponent points trigger exactly one run decision per set;
- fewer than four do not trigger;
- set completion creates a set-break decision unless match complete;
- continue resumes from the exact stored cursor;
- identical command sequences reproduce identical final results;
- different valid commands can change future event outcomes under fixed deterministic fixtures;
- timeout is limited to one per set and expires after five rallies or set end;
- tactics changes affect only future rallies and stay match-local;
- substitution validates court/bench membership and stays match-local;
- invalid commands do not mutate state or cursor;
- match-local selection/tactics survive set boundaries;
- match completion still obeys best-of-three/five and two-point-lead rules;
- one-shot compatibility simulation remains deterministic if retained.

### 24.2 Application/action tests

Cover:

- starting practice/official match creates an active resumable match;
- unresolved coach decision blocks match finalization/progression;
- accepted command updates authoritative active match exactly once;
- completion finalizes history/reward/bracket exactly once;
- reload/retry returns the same pending decision;
- persistent normal lineup and normal tactics remain unchanged.

### 24.3 PvP tests

Cover:

- challenger commands affect only challenger runtime;
- defender decisions remain deterministic/server-owned;
- defender published tactics remain frozen;
- no hidden defender individual data leaks in public response;
- duplicate challenge command requests cannot apply twice.

### 24.4 UI/E2E tests

At 320/360/390/414/480 widths cover:

- opponent-run decision panel;
- timeout then resume;
- tactics change then resume;
- substitution then resume;
- continue;
- set-break decision;
- fast-forward stopping at decisions;
- final result and command-impact panel;
- no overflow/bottom-nav collision.

## 25. Delivery decomposition

Phase 16 is implemented in three focused PRs.

### PR16-1 — Match Command Foundation

- resumable deterministic match engine;
- active-match runtime state;
- decision triggers;
- timeout/tactics/substitution/continue domain validation and effects;
- compatibility with existing match analysis/final result;
- unit/integration coverage;
- no major new UI beyond wiring required for tests.

### PR16-2 — Interactive Match Command UX

- live match screen command panel;
- tactics command sheet/panel;
- substitution flow;
- playback/fast-forward decision handling;
- command impact result presentation;
- five-width mobile coverage.

### PR16-3 — Official/PvP Completion

- authoritative official-tournament finalization around resumable matches;
- asynchronous PvP challenger command session;
- deterministic defender coaching;
- idempotency/privacy regression suite;
- full end-to-end CI and final roadmap documentation.

## 26. Non-goals

Phase 16 does not add:

- manual command every rally/point;
- real-time synchronous PvP;
- user-visible individual opponent hidden ability data;
- manual fatigue recovery;
- libero-specialized substitution management beyond current selection validity;
- full FIVB substitution/timeout bookkeeping;
- serve-target player selection UI;
- defense-bias UI;
- attack-focus-by-player UI;
- coach skill trees;
- rankings or season objectives;
- new progression currencies or consumable tactical items.

## 27. Success criteria

Phase 16 succeeds when:

1. the match result is not precomputed beyond an unresolved human coaching decision;
2. a user can make timeout, tactics, substitution, or continue decisions at bounded meaningful moments;
3. commands affect only the future match state and never overwrite persistent normal lineup/tactics;
4. deterministic replay is preserved from seed/cursor plus command history;
5. official and PvP finalization remain authoritative/idempotent;
6. PvP privacy remains unchanged or stronger;
7. the match feels interactive without becoming a per-point management chore;
8. all required unit/integration/E2E/mobile quality gates are green before merge.
