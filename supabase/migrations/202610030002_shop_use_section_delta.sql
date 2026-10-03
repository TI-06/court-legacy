-- Save stability: keep shop item use atomic without sending the full GameState
-- through PostgREST. The worker sends the same section-level delta used by the
-- canonical game action path; this wrapper reconstructs the next state inside
-- Postgres and delegates to the existing authoritative shop mutation.

create or replace function public.commit_shop_item_use_v2(
  p_user_id uuid,
  p_operation_id text,
  p_request_fingerprint text,
  p_expected_revision bigint,
  p_item_id text,
  p_state_delta jsonb,
  p_team_selection jsonb,
  p_target_type text,
  p_target_id text,
  p_safe_request jsonb,
  p_public_result jsonb,
  p_scouting_cycle_key text,
  p_scouting_candidates jsonb,
  p_scouting_insight jsonb
)
returns table(
  operation_id text,
  operation_type text,
  request_fingerprint text,
  revision bigint,
  academic_year_index integer,
  item_id text,
  quantity_owned integer,
  purchased_count integer,
  used_count integer,
  response jsonb,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_state jsonb;
  v_next_state jsonb;
  v_current_year integer;
  v_next_year integer;
begin
  if jsonb_typeof(p_state_delta) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_shop_use_payload';
  end if;

  select save.state
    into v_current_state
  from public.game_saves as save
  where save.user_id = p_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'game_not_initialized';
  end if;

  v_next_state := public.apply_jsonb_state_delta(
    v_current_state,
    p_state_delta
  );

  begin
    v_current_year := (v_current_state ->> 'yearIndex')::integer;
    v_next_year := (v_next_state ->> 'yearIndex')::integer;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid_shop_year';
  end;

  if v_current_year is null
    or v_current_year < 0
    or v_next_year is distinct from v_current_year then
    raise exception using errcode = '22023', message = 'invalid_shop_year';
  end if;

  return query
  select *
  from public.commit_shop_item_use(
    p_user_id,
    p_operation_id,
    p_request_fingerprint,
    p_expected_revision,
    p_item_id,
    v_next_state,
    p_team_selection,
    p_target_type,
    p_target_id,
    p_safe_request,
    p_public_result,
    p_scouting_cycle_key,
    p_scouting_candidates,
    p_scouting_insight
  );
end;
$$;

revoke execute on function public.commit_shop_item_use_v2(
  uuid, text, text, bigint, text, jsonb, jsonb, text, text,
  jsonb, jsonb, text, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.commit_shop_item_use_v2(
  uuid, text, text, bigint, text, jsonb, jsonb, text, text,
  jsonb, jsonb, text, jsonb, jsonb
) to service_role;
