-- Save Stability V5: batch high-churn object-map updates without
-- falling back to a 1+ MB full-state request.
--
-- V4 remains available for rolling deployment. V5 adds a shallow "merge"
-- patch operation so maps such as players and relationships can be updated
-- in one JSONB rewrite while retaining explicit remove operations.

create or replace function public.apply_jsonb_state_patch_v2(
  p_state jsonb,
  p_patch jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result jsonb := p_state;
  v_operation jsonb;
  v_op text;
  v_path text[];
  v_target jsonb;
begin
  if jsonb_typeof(p_state) <> 'object'
    or jsonb_typeof(p_patch) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_state_patch';
  end if;

  for v_operation in
    select value from jsonb_array_elements(p_patch)
  loop
    if jsonb_typeof(v_operation) <> 'object'
      or jsonb_typeof(v_operation -> 'path') <> 'array' then
      raise exception using errcode = '22023', message = 'invalid_state_patch_operation';
    end if;

    v_op := v_operation ->> 'op';

    select coalesce(
      array_agg(path_part.value order by path_part.ordinality),
      array[]::text[]
    )
    into v_path
    from jsonb_array_elements_text(v_operation -> 'path')
      with ordinality as path_part(value, ordinality);

    if v_op = 'set' then
      if not (v_operation ? 'value') then
        raise exception using errcode = '22023', message = 'state_patch_value_required';
      end if;

      if cardinality(v_path) = 0 then
        v_result := v_operation -> 'value';
      else
        v_result := jsonb_set(v_result, v_path, v_operation -> 'value', true);
      end if;
    elsif v_op = 'merge' then
      if not (v_operation ? 'value')
        or jsonb_typeof(v_operation -> 'value') <> 'object' then
        raise exception using errcode = '22023', message = 'state_patch_merge_object_required';
      end if;

      if cardinality(v_path) = 0 then
        if jsonb_typeof(v_result) <> 'object' then
          raise exception using errcode = '22023', message = 'state_patch_merge_target_invalid';
        end if;
        v_result := v_result || (v_operation -> 'value');
      else
        v_target := v_result #> v_path;
        if v_target is null or jsonb_typeof(v_target) <> 'object' then
          raise exception using errcode = '22023', message = 'state_patch_merge_target_invalid';
        end if;
        v_result := jsonb_set(
          v_result,
          v_path,
          v_target || (v_operation -> 'value'),
          false
        );
      end if;
    elsif v_op = 'remove' then
      if cardinality(v_path) = 0 then
        raise exception using errcode = '22023', message = 'cannot_remove_state_root';
      end if;

      v_result := v_result #- v_path;
    else
      raise exception using errcode = '22023', message = 'unknown_state_patch_operation';
    end if;
  end loop;

  if jsonb_typeof(v_result) <> 'object' then
    raise exception using errcode = '22023', message = 'patched_state_must_be_object';
  end if;

  return v_result;
end;
$$;

revoke execute on function public.apply_jsonb_state_patch_v2(
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.apply_jsonb_state_patch_v2(
  jsonb,
  jsonb
) to service_role;

create or replace function public.apply_game_operation_v5(
  p_user_id uuid,
  p_operation_id text,
  p_expected_revision bigint,
  p_state_patch jsonb,
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
  v_current_state jsonb;
  v_next_state jsonb;
  v_compact_response jsonb;
begin
  if p_user_id is null
    or nullif(btrim(p_operation_id), '') is null
    or p_expected_revision is null
    or p_expected_revision < 1 then
    raise exception using errcode = '22023', message = 'invalid_operation';
  end if;

  if jsonb_typeof(p_state_patch) <> 'array'
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
    into v_school_id, v_current_revision, v_current_state
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

  v_next_state := public.apply_jsonb_state_patch_v2(
    v_current_state,
    p_state_patch
  );
  v_resulting_revision := v_current_revision + 1;

  update public.game_saves
  set revision = v_resulting_revision,
      state = v_next_state,
      team_selection = p_team_selection,
      updated_at = now()
  where user_id = p_user_id;

  v_compact_response := jsonb_build_object(
    'operationId', btrim(p_operation_id),
    'resultingRevision', v_resulting_revision
  );
  if p_outcome is not null then
    v_compact_response := v_compact_response || jsonb_build_object(
      'outcome',
      p_outcome
    );
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
    v_compact_response
  );

  with stale_operations as (
    select retained.operation_id
    from public.game_operations as retained
    where retained.user_id = p_user_id
    order by
      retained.resulting_revision desc,
      retained.created_at desc,
      retained.operation_id desc
    offset 16
  )
  delete from public.game_operations as operation
  using stale_operations as stale
  where operation.user_id = p_user_id
    and operation.operation_id = stale.operation_id;

  return query select null::jsonb, false;
end;
$$;

revoke execute on function public.apply_game_operation_v5(
  uuid,
  text,
  bigint,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.apply_game_operation_v5(
  uuid,
  text,
  bigint,
  jsonb,
  jsonb,
  jsonb
) to service_role;
