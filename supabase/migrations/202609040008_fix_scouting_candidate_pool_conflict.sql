-- Fix PL/pgSQL ambiguity between RETURNS TABLE output variables and
-- scouting_candidate_pools columns in the atomic candidate-pool RPC.

create or replace function public.create_scouting_candidate_pool(
  p_user_id uuid,
  p_cycle_key text,
  p_creation_operation_id text,
  p_candidates jsonb
)
returns table(
  user_id uuid,
  cycle_key text,
  creation_operation_id text,
  candidates jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'user id is required';
  end if;

  if nullif(btrim(p_cycle_key), '') is null
    or nullif(btrim(p_creation_operation_id), '') is null then
    raise exception using errcode = '22023', message = 'scouting identifiers are required';
  end if;

  if char_length(btrim(p_cycle_key)) > 160
    or char_length(btrim(p_creation_operation_id)) > 120 then
    raise exception using errcode = '22023', message = 'scouting identifiers are too long';
  end if;

  if jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) = 0 then
    raise exception using errcode = '22023', message = 'scouting candidates must be a non-empty array';
  end if;

  insert into public.scouting_candidate_pools (
    user_id,
    cycle_key,
    creation_operation_id,
    candidates
  )
  values (
    p_user_id,
    btrim(p_cycle_key),
    btrim(p_creation_operation_id),
    p_candidates
  )
  on conflict on constraint scouting_candidate_pools_pkey do nothing;

  return query
  select
    pool.user_id,
    pool.cycle_key,
    pool.creation_operation_id,
    pool.candidates
  from public.scouting_candidate_pools as pool
  where pool.user_id = p_user_id
    and pool.cycle_key = btrim(p_cycle_key);
end;
$$;
