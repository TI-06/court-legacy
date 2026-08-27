-- Atomically persist one authoritative game mutation and its idempotency record.

create or replace function public.apply_game_operation(
  p_user_id uuid,
  p_operation_id text,
  p_expected_revision bigint,
  p_state jsonb,
  p_team_selection jsonb,
  p_response jsonb
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
begin
  if p_user_id is null
    or nullif(btrim(p_operation_id), '') is null
    or p_expected_revision is null
    or p_expected_revision < 1 then
    raise exception using errcode = '22023', message = 'invalid_operation';
  end if;

  if jsonb_typeof(p_state) <> 'object'
    or jsonb_typeof(p_team_selection) <> 'object'
    or jsonb_typeof(p_response) <> 'object' then
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

  -- A concurrent retry may have committed while this request waited for the
  -- save-row lock. Re-check the operation record before comparing revisions.
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
    p_response
  );

  return query select p_response, false;
end;
$$;

revoke execute on function public.apply_game_operation(
  uuid,
  text,
  bigint,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.apply_game_operation(
  uuid,
  text,
  bigint,
  jsonb,
  jsonb,
  jsonb
) to service_role;
