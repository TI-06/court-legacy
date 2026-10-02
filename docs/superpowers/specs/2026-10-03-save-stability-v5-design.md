# Save Stability V5 Design

Date: 2026-10-03

## Root cause confirmed

Production and deterministic diagnostics both show that the save system still routes too many normal game actions to full-state persistence.

Observed production window:
- full-state RPC v3: 33 calls / 15 min
- average request: about 1.16 MB
- delta RPC v4: 18 calls / 15 min
- PostgREST emitted "Thread killed by timeout manager" immediately after the last successful save

Current production state is about 1.21 MB as JSON on the wire even though PostgreSQL stores the JSONB in about 188 KB.

156-week deterministic diagnostic:
- advance-week: 169 / 193 full-state fallbacks
- event-choice: 53 / 59 full-state fallbacks
- match-command: 37 / 159 full-state fallbacks
- maximum raw patch operation count: 5,125

The main trigger is the hard 16-operation safety limit. Player, school, and relationship changes are emitted as hundreds or thousands of tiny JSON patch operations, which forces a full 1+ MB fallback even when the changed data itself is small.

## Fix

Introduce delta protocol V5 with a shallow object merge operation.

New patch operation:
- merge(path, value)

For a JSON object at path, merge replaces/adds only the keys present in value. Removed keys remain explicit remove operations.

Before persistence, coalesce raw patches for high-churn entity maps:
- players
- schools
- playerRelationships
- playerRelationshipBonds

All changed entries in one map become one merge operation instead of hundreds of nested set operations.

Example:
- before: 300 nested player field operations
- after: one merge(players, { changedPlayerA: fullPlayerA, changedPlayerB: fullPlayerB })

## Persistence

Add apply_jsonb_state_patch_v2 and apply_game_operation_v5.

V5 keeps:
- row lock
- revision check
- compact operation replay
- retention of 16 operation ids
- authoritative game_saves snapshot

No save-schema version change is required.

## Delta budget

Use the existing 256 KiB preferred delta budget for all coalesced deltas.

The current 32 KiB normal-action budget is removed because production already proves 50-130 KiB V4 patches complete reliably while 1.1-1.3 MB full-state V3 requests are the problematic path.

The hard patch-operation ceiling remains 16.

## Safety

- browser materialization supports merge patches
- merge requires object target and object value
- deletions stay explicit
- replay semantics unchanged
- if coalesced patch still exceeds 16 operations or 256 KiB, V3 full-state fallback remains as a last resort
- no gameplay behavior changes

## Acceptance

Across the same 156-week diagnostic:
- full-state fallbacks must drop by at least 90%
- event-choice should normally remain delta
- advance-week should normally remain delta
- all reconstructed states must equal authoritative applied states
- existing save/replay/conflict tests remain green
