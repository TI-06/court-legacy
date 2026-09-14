# Phase20 Design Review Notes

Reviewed: 2026-09-14

## Findings resolved before implementation

1. Incoming-offer monthly caps and cooldowns cannot be derived from completed practice-match history because declined offers disappear. Phase20 therefore uses a bounded optional surfaced-offer ledger and keeps schema v8 via codec defaults.
2. Historical upset/notable-match logic cannot use current school strength or reputation because those values may have changed since the match. Notable-match ranking uses only persisted match facts plus current rivalry identity where explicitly labeled as current context.
3. Player concerns are authoritatively recomputed during official-match dynamics feedback, not generic weekly advance. Resolution notifications are emitted around that existing boundary.
4. The existing notification store retains only one item. Phase20-2 must retain newest-one-per-type so the latest training result and latest concern-resolution feedback can coexist without restoring a long notification backlog.
5. School legacy uses the existing `records` tab; PVE rivalry context uses the existing `PreMatchLineupScreen`. No extra top-level navigation is added.

## PR sequence

- PR20-1: Rivalry & Legacy Foundation
- PR20-2: Player Concern Guidance & Resolution
- PR20-3: Practice Offer Cadence & Diversity

Each PR must be independently testable and merged only after focused verification, repository verification, official PR CI, squash merge, and exact main-SHA CI.
