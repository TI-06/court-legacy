-- Save progression endurance: apply compact section-level deltas without
-- rewriting the entire state payload from the Worker and without thousands of
-- repeated jsonb_set calls inside Postgres.
--
-- Delta shape:
-- {
--   "set": { "date": "...", "activeMatch": null },
--   "merge": { "players": { "player-1": {...} } },
--   "remove": ["optionalTopLevelKey"],
--   "removeKeys": { "players": ["retired-player-id"] }
-- }

create or replace function public.apply_jsonb_state_delta(
  p_state jsonb,
  p_delta jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result jsonb := p_state;
  v_set jsonb;
  v_merge jsonb;
  v_remove jsonb;
  v_remove_keys jsonb;
  v_root text;
  v_root_value jsonb;
  v_root_patch jsonb;
  v_root_removals jsonb;
  v_child_key text;
begin
  if jsonb_typeof(p_state) <> 'object'
    or jsonb_typeof(p_delta) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_state_delta';
  end if;

  v_set := coalesce(p_delta -> 'set', '{}'::jsonb);
  v_merge := coalesce(p_delta -> 'merge', '{}'::jsonb);
  v_remove := coalesce(p_delta -> 'remove', '[]'::jsonb);
  v_remove_keys := coalesce(p_delta -> 'removeKeys', '{}'::jsonb);

  if jsonb_typeof(v_set) <> 'object'
    or jsonb_typeof(v_merge) <> 'object'
    or jsonb_typeof(v_remove) <> 'array'
    or jsonb_typeof(v_remove_keys) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_state_delta_shape';
  end if;

  -- Direct top-level replacements can be applied in one object concatenation.
  v_result := v_result || v_set;

  -- Remove optional top-level keys that disappeared from the authoritative state.
  for v_child_key in
    select value from jsonb_array_elements_text(v_remove)
  loop
    v_result := v_result - v_child_key;
  end loop;

  -- Merge object roots one root at a time. Each root is rebuilt once, then
  -- written back once, avoiding thousands of whole-state jsonb_set rewrites.
  for v_root in
    select root_key
    from (
      select jsonb_object_keys(v_merge) as root_key
      union
      select jsonb_object_keys(v_remove_keys) as root_key
    ) as roots
  loop
    v_root_value := coalesce(v_result -> v_root, '{}'::jsonb);
    v_root_patch := coalesce(v_merge -> v_root, '{}'::jsonb);
    v_root_removals := coalesce(v_remove_keys -> v_root, '[]'::jsonb);

    if jsonb_typeof(v_root_value) <> 'object'
      or jsonb_typeof(v_root_patch) <> 'object'
      or jsonb_typeof(v_root_removals) <> 'array' then
      raise exception using errcode = '22023', message = 'invalid_state_delta_root';
    end if;

    v_root_value := v_root_value || v_root_patch;
    for v_child_key in
      select value from jsonb_array_elements_text(v_root_removals)
    loop
      v_root_value := v_root_value - v_child_key;
    end loop;

    v_result := jsonb_set(v_result, array[v_root], v_root_value, true);
  end loop;

  if jsonb_typeof(v_result) <> 'object' then
    raise exception using errcode = '22023', message = 'delta_state_must_be_object';
  end if;

  return v_result;
end;
$$;

revoke execute on function public.apply_jsonb_state_delta(
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.apply_jsonb_state_delta(
  jsonb,
  jsonb
) to service_role;

create or replace function public.apply_game_operation_v5(
  p_user_id uuid,
  p_operation_id text,
  p_expected_revision bigint,
  p_state_delta jsonb,
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

  if jsonb_typeof(p_state_delta) <> 'object'
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

  v_next_state := public.apply_jsonb_state_delta(
    v_current_state,
    p_state_delta
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
  uuid, text, bigint, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.apply_game_operation_v5(
  uuid, text, bigint, jsonb, jsonb, jsonb
) to service_role;
