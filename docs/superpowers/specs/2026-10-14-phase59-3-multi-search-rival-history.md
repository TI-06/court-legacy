# Phase59-3 — Multi-search rival recruitment history

## Purpose

Before this change, each scouting search replaces the previous candidate pool. As a result, a recruit taken by a competing school might disappear when the player scouts again.

## Design

- Save at most 24 rival-eligible candidates per user/academic-year cycle in the server-only `scouting_candidate_pools.archived_rival_candidates` JSONB column.
- Archive only candidates with a genuine opponent and a valid signing deadline, and never archive a player already committed to the user.
- Snapshot the complete authoritative player truth plus the **stable rival school ID** and signing week when replacing a search. No candidate truth is added to browser-visible reports or the game save.
- Resolve both past and active search pools at academic rollover. Respect unexpired deadlines, deduplicate players and preserve existing NPC roster limits.
- Ignore old saves without a known search week, instead of inventing elapsed time.
- Keep the existing API and save schema unchanged.

## Migration and rollout

Apply `supabase/migrations/202610140001_rival_scout_candidate_archive.sql` before expecting multi-search history to persist. The worker falls back to legacy scouting pool queries when the column is absent, preventing existing scouting and saving functionality from breaking during staggered deployment. **The fallback does not archive historical candidates.**

Existing searches made before the migration are not recoverable. Existing active candidate pools remain valid. SQL permissions remain service-role-only with RLS active on the parent table.

## Validation

- Historic candidates retain identity, destination and original commitment deadline.
- Duplicate candidates are removed and the server archive never exceeds 24.
- Legacy saves and databases remain usable without retroactive signing.
- Archived prospects join the correct NPC school's incoming class, not the player's school, and never bypass roster caps.
- No additional requests or persistent properties in the client save.
- Full CI, 10/30-year season progression tests and mobile E2E.
