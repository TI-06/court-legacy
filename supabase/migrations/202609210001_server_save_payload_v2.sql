-- Phase 25-6: reduce game save RPC payload without changing replay semantics.
--
-- The Worker already holds the authoritative response object after applying an
-- action. Sending that full response back into Postgres duplicates the same
-- ~1MB state that is already sent as p_state. This V2 RPC reconstructs and
-- stores the exact replay response inside Postgres, while returning no response
-- body for the normal first-write path. Duplicate retries still receive the
-- stored full response.

create or replace function public.apply_game_operation_v2(
  p_user_id uuid,
  p_operation_id text,
  p_expected_revision bigint,
  p_state jsonb,
  p_team_selection jsonb,
  p_outcome jsonb
)
returns table(response jsonb, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_response jsonb;
  v_school_id uuid;
  v_current_revision bigint;
  v_resulting_revision bigint;
  v_response jsonb;
begin
  if p_user_id is null
    or nullif(btrim(p_operation_id), '') is null
    or p_expected_revision is null
    or p_expected_revision < 1 then
    raise exception using errcode = '22023', message = 'invalid_operation';
  end if;

  if jsonb_typeof(p_state) <> 'object'
    or jsonb_typeof(p_team_selection) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_operation_payload';
  end if;

  select operation.response
    into v_existing_response
  from public.game_operations as operation
  where operation.user_id = p_user_id
    and operation.operation_id = btrim(p_operation_id);

  if found then
    return query select v_existing_response, true;
    return;
  end if;

  select save.school_id, save.revision
    into v_school_id, v_current_revision
  from public.game_saves as save
  where save.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'game_not_initialized';
  end if;

  select operation.response
    into v_existing_response
  from public.game_operations as operation
  where operation.user_id = p_user_id
    and operation.operation_id = btrim(p_operation_id);

  if found then
    return query select v_existing_response, true;
    return;
  end if;

  if v_current_revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;

  v_resulting_revision := v_current_revision + 1;

  update public.game_saves
  set revision = v_resulting_revision,
      state = p_state,
      team_selection = p_team_selection,
      updated_at = now()
  where user_id = p_user_id;

  v_response := jsonb_build_object(
    'operationId', btrim(p_operation_id),
    'game', jsonb_build_object(
      'userId', p_user_id,
      'schoolDbId', v_school_id,
      'revision', v_resulting_revision,
      'state', p_state,
      'teamSelection', p_team_selection
    )
  );

  if p_outcome is not null then
    v_response := v_response || jsonb_build_object('outcome', p_outcome);
  end if;

  insert into public.game_operations (
    user_id,
    operation_id,
    school_id,
    expected_revision,
    resulting_revision,
    response
  )
  values (
    p_user_id,
    btrim(p_operation_id),
    v_school_id,
    p_expected_revision,
    v_resulting_revision,
    v_response
  );

  with stale_operations as (
    select retained.operation_id
    from public.game_operations as retained
    where retained.user_id = p_user_id
    order by
      retained.resulting_revision desc,
      retained.created_at desc,
      retained.operation_id desc
    offset 128
  )
  delete from public.game_operations as operation
  using stale_operations as stale
  where operation.user_id = p_user_id
    and operation.operation_id = stale.operation_id;

  -- The Worker already has the exact first-write response in memory. Avoid
  -- sending the ~1MB JSON back over the Supabase RPC on the success path.
  return query select null::jsonb, false;
end;
$$;

revoke execute on function public.apply_game_operation_v2(
  uuid,
  text,
  bigint,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.apply_game_operation_v2(
  uuid,
  text,
  bigint,
  jsonb,
  jsonb,
  jsonb
) to service_role;
