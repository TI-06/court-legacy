-- Phase 36: persist only changed GameState paths instead of uploading the full
-- ~1.2MB state on every operation. The existing v3 RPC remains available for
-- rollback compatibility; v4 applies ordered JSON patch operations atomically.

create or replace function public.apply_game_operation_v4(
  p_user_id uuid,
  p_operation_id text,
  p_expected_revision bigint,
  p_state_operations jsonb,
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
  v_compact_response jsonb;
  v_state jsonb;
  v_operation jsonb;
  v_operation_kind text;
  v_path text[];
  v_value jsonb;
  v_current_value jsonb;
begin
  if p_user_id is null
    or nullif(btrim(p_operation_id), '') is null
    or p_expected_revision is null
    or p_expected_revision < 1 then
    raise exception using errcode = '22023', message = 'invalid_operation';
  end if;

  if jsonb_typeof(p_state_operations) <> 'array'
    or jsonb_typeof(p_team_selection) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_operation_payload';
  end if;

  select operation.response into v_existing_response
  from public.game_operations as operation
  where operation.user_id = p_user_id
    and operation.operation_id = btrim(p_operation_id);

  if found then
    return query select v_existing_response, true;
    return;
  end if;

  select save.school_id, save.revision, save.state
    into v_school_id, v_current_revision, v_state
  from public.game_saves as save
  where save.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'game_not_initialized';
  end if;

  select operation.response into v_existing_response
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

  for v_operation in
    select patch.value
    from jsonb_array_elements(p_state_operations) as patch(value)
  loop
    v_operation_kind := v_operation ->> 'op';
    v_path := array(
      select jsonb_array_elements_text(v_operation -> 'path')
    );

    if coalesce(cardinality(v_path), 0) = 0 then
      raise exception using errcode = '22023', message = 'invalid_state_patch_path';
    end if;

    if v_operation_kind = 'set' then
      if not (v_operation ? 'value') then
        raise exception using errcode = '22023', message = 'invalid_state_patch_value';
      end if;
      v_state := jsonb_set(v_state, v_path, v_operation -> 'value', true);
    elsif v_operation_kind = 'delete' then
      v_state := v_state #- v_path;
    elsif v_operation_kind = 'append' then
      v_value := v_operation -> 'value';
      v_current_value := v_state #> v_path;
      if jsonb_typeof(v_value) <> 'array'
        or jsonb_typeof(v_current_value) <> 'array' then
        raise exception using errcode = '22023', message = 'invalid_state_patch_append';
      end if;
      v_state := jsonb_set(v_state, v_path, v_current_value || v_value, false);
    else
      raise exception using errcode = '22023', message = 'invalid_state_patch_operation';
    end if;
  end loop;

  if jsonb_typeof(v_state) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_resulting_state';
  end if;

  v_resulting_revision := v_current_revision + 1;

  update public.game_saves
  set revision = v_resulting_revision,
      state = v_state,
      team_selection = p_team_selection,
      updated_at = now()
  where user_id = p_user_id;

  v_compact_response := jsonb_build_object(
    'operationId', btrim(p_operation_id),
    'resultingRevision', v_resulting_revision
  );
  if p_outcome is not null then
    v_compact_response := v_compact_response || jsonb_build_object('outcome', p_outcome);
  end if;

  insert into public.game_operations (
    user_id, operation_id, school_id, expected_revision, resulting_revision, response
  )
  values (
    p_user_id, btrim(p_operation_id), v_school_id, p_expected_revision,
    v_resulting_revision, v_compact_response
  );

  with stale_operations as (
    select retained.operation_id
    from public.game_operations as retained
    where retained.user_id = p_user_id
    order by retained.resulting_revision desc, retained.created_at desc, retained.operation_id desc
    offset 16
  )
  delete from public.game_operations as operation
  using stale_operations as stale
  where operation.user_id = p_user_id
    and operation.operation_id = stale.operation_id;

  return query select null::jsonb, false;
end;
$$;

revoke execute on function public.apply_game_operation_v4(
  uuid, text, bigint, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.apply_game_operation_v4(
  uuid, text, bigint, jsonb, jsonb, jsonb
) to service_role;
