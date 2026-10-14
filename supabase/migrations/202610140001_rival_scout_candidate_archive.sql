-- Phase59-3: bounded server-only archive of rival recruitment outcomes.
-- Existing scouting_candidate_pools grants/RLS remain unchanged.
-- This column MUST NOT be queried by browser-authenticated roles.
alter table public.scouting_candidate_pools
  add column if not exists archived_rival_candidates jsonb
  not null default '[]'::jsonb;

alter table public.scouting_candidate_pools
  add constraint scouting_rival_archive_bounded
  check (
    jsonb_typeof(archived_rival_candidates) = 'array'
    and jsonb_array_length(archived_rival_candidates) <= 24
  );
