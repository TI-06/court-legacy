-- Carry unused shop inventory across academic years, add possession caps for
-- scout-candidate items, and consume carried inventory oldest-first.

alter table public.shop_item_definitions
  add column if not exists inventory_limit integer
  check (inventory_limit is null or inventory_limit > 0);

update public.shop_item_definitions
set display_name = '新入生候補追加',
    description = '新入生スカウト候補を1名追加します。',
    annual_purchase_limit = 5,
    annual_use_limit = 5,
    inventory_limit = 5,
    effect_type = 'extra-scout-candidate',
    enabled = true,
    sort_order = 10,
    updated_at = now()
where item_id = 'extra-scout-candidate';

insert into public.shop_item_definitions (
  item_id,
  display_name,
  description,
  price_yen,
  annual_purchase_limit,
  annual_use_limit,
  inventory_limit,
  effect_type,
  enabled,
  sort_order
)
values (
  'generational-scout-candidate',
  '天才候補生追加',
  '天才ランクの新入生スカウト候補を1名追加します。',
  0,
  1,
  1,
  1,
  'generational-scout-candidate',
  true,
  15
)
on conflict (item_id) do update
set display_name = excluded.display_name,
    description = excluded.description,
    price_yen = excluded.price_yen,
    annual_purchase_limit = excluded.annual_purchase_limit,
    annual_use_limit = excluded.annual_use_limit,
    inventory_limit = excluded.inventory_limit,
    effect_type = excluded.effect_type,
    enabled = excluded.enabled,
    sort_order = excluded.sort_order,
    updated_at = now();

create or replace function public.get_shop_status(
  p_user_id uuid,
  p_current_year_index integer
)
returns table(
  academic_year_index integer,
  item_id text,
  display_name text,
  description text,
  price_yen integer,
  annual_purchase_limit integer,
  annual_use_limit integer,
  purchased_count integer,
  used_count integer,
  quantity_owned integer,
  enabled boolean,
  sort_order integer
)
language sql
security definer
set search_path = ''
as $$
  select
    p_current_year_index,
    item.item_id,
    item.display_name,
    item.description,
    item.price_yen,
    item.annual_purchase_limit,
    item.annual_use_limit,
    coalesce(counter.purchased_count, 0)::integer,
    coalesce(counter.used_count, 0)::integer,
    coalesce(inventory.quantity_remaining, 0)::integer,
    item.enabled,
    item.sort_order
  from public.shop_item_definitions as item
  left join public.shop_yearly_counters as counter
    on counter.user_id = p_user_id
   and counter.item_id = item.item_id
   and counter.academic_year_index = p_current_year_index
  left join lateral (
    select coalesce(sum(inv.quantity_remaining), 0)::integer as quantity_remaining
    from public.shop_inventory as inv
    where inv.user_id = p_user_id
      and inv.item_id = item.item_id
      and inv.academic_year_index <= p_current_year_index
  ) as inventory on true
  where p_user_id is not null
    and p_current_year_index >= 0
  order by item.sort_order, item.item_id;
$$;

create or replace function public.purchase_shop_item(
  p_user_id uuid,
  p_operation_id text,
  p_request_fingerprint text,
  p_expected_revision bigint,
  p_item_id text
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
  v_state jsonb;
  v_current_revision bigint;
  v_resulting_revision bigint;
  v_year_index integer;
  v_item public.shop_item_definitions%rowtype;
  v_purchased_count integer;
  v_used_count integer;
  v_quantity integer;
  v_existing_type text;
  v_existing_fingerprint text;
  v_existing_response jsonb;
  v_response jsonb;
  v_funds_granted integer;
  v_school_id text;
  v_balance_before integer;
  v_balance_after integer;
  v_history jsonb;
  v_history_with_entry jsonb;
  v_ledger_entry jsonb;
begin
  if p_user_id is null
    or nullif(btrim(p_operation_id), '') is null
    or nullif(btrim(p_request_fingerprint), '') is null
    or p_expected_revision is null
    or p_expected_revision < 1
    or nullif(btrim(p_item_id), '') is null then
    raise exception using errcode = '22023', message = 'invalid_shop_purchase';
  end if;

  if char_length(btrim(p_operation_id)) > 120
    or char_length(btrim(p_request_fingerprint)) > 320 then
    raise exception using errcode = '22023', message = 'invalid_shop_purchase';
  end if;

  select save.state, save.revision
    into v_state, v_current_revision
  from public.game_saves as save
  where save.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'game_not_initialized';
  end if;

  select operation.operation_type, operation.request_fingerprint, operation.response
    into v_existing_type, v_existing_fingerprint, v_existing_response
  from public.shop_operations as operation
  where operation.user_id = p_user_id
    and operation.operation_id = btrim(p_operation_id);

  if found then
    if v_existing_type <> 'purchase'
      or v_existing_fingerprint <> btrim(p_request_fingerprint) then
      raise exception using errcode = 'P0001', message = 'operation_id_reused';
    end if;

    return query select
      btrim(p_operation_id),
      'purchase'::text,
      btrim(p_request_fingerprint),
      (v_existing_response ->> 'revision')::bigint,
      (v_existing_response ->> 'academicYearIndex')::integer,
      v_existing_response ->> 'itemId',
      (v_existing_response ->> 'quantityOwned')::integer,
      (v_existing_response ->> 'purchasedCount')::integer,
      (v_existing_response ->> 'usedCount')::integer,
      v_existing_response,
      true;
    return;
  end if;

  if v_current_revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;

  begin
    v_year_index := (v_state ->> 'yearIndex')::integer;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid_shop_year';
  end;

  if v_year_index is null or v_year_index < 0 then
    raise exception using errcode = '22023', message = 'invalid_shop_year';
  end if;

  select item.* into v_item
  from public.shop_item_definitions as item
  where item.item_id = btrim(p_item_id)
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'item_not_found';
  end if;
  if not v_item.enabled or v_item.price_yen <> 0 then
    raise exception using errcode = 'P0001', message = 'item_disabled';
  end if;

  insert into public.shop_yearly_counters (
    user_id,
    item_id,
    academic_year_index,
    purchased_count,
    used_count
  )
  values (p_user_id, v_item.item_id, v_year_index, 0, 0)
  on conflict on constraint shop_yearly_counters_pkey do nothing;

  select counter.purchased_count, counter.used_count
    into v_purchased_count, v_used_count
  from public.shop_yearly_counters as counter
  where counter.user_id = p_user_id
    and counter.item_id = v_item.item_id
    and counter.academic_year_index = v_year_index
  for update;

  if v_purchased_count >= v_item.annual_purchase_limit then
    raise exception using errcode = 'P0001', message = 'purchase_limit_reached';
  end if;

  perform 1
  from public.shop_inventory as inventory
  where inventory.user_id = p_user_id
    and inventory.item_id = v_item.item_id
    and inventory.academic_year_index <= v_year_index
  for update;

  select coalesce(sum(inventory.quantity_remaining), 0)::integer
    into v_quantity
  from public.shop_inventory as inventory
  where inventory.user_id = p_user_id
    and inventory.item_id = v_item.item_id
    and inventory.academic_year_index <= v_year_index;

  if v_item.inventory_limit is not null
    and v_quantity >= v_item.inventory_limit then
    raise exception using errcode = 'P0001', message = 'purchase_limit_reached';
  end if;

  v_funds_granted := case v_item.item_id
    when 'funds-grant-300' then 300
    when 'funds-grant-1000' then 1000
    when 'funds-grant-3000' then 3000
    else 0
  end;

  if v_funds_granted > 0 then
    v_quantity := 0;
    v_school_id := v_state ->> 'userSchoolId';
    if nullif(v_school_id, '') is null then
      raise exception using errcode = '22023', message = 'invalid_game_state';
    end if;

    begin
      v_balance_before := (v_state #>> array['schools', v_school_id, 'funds'])::integer;
    exception when others then
      raise exception using errcode = '22023', message = 'invalid_game_state';
    end;

    if v_balance_before is null or v_balance_before < 0 then
      raise exception using errcode = '22023', message = 'invalid_game_state';
    end if;

    v_history := v_state #> '{schoolManagement,fundsHistory}';
    if v_history is null or jsonb_typeof(v_history) <> 'array' then
      raise exception using errcode = '22023', message = 'invalid_game_state';
    end if;

    v_balance_after := v_balance_before + v_funds_granted;
    v_ledger_entry := jsonb_build_object(
      'id', 'shop-grant:' || btrim(p_operation_id),
      'gameDate', v_state ->> 'date',
      'academicYearIndex', v_year_index,
      'kind', 'shop-grant',
      'amount', v_funds_granted,
      'balanceAfter', v_balance_after,
      'label', v_item.display_name,
      'relatedId', v_item.item_id
    );
    v_history_with_entry := v_history || jsonb_build_array(v_ledger_entry);

    select coalesce(jsonb_agg(entry.value order by entry.ordinality), '[]'::jsonb)
      into v_history
    from jsonb_array_elements(v_history_with_entry) with ordinality as entry(value, ordinality)
    where entry.ordinality > greatest(jsonb_array_length(v_history_with_entry) - 50, 0);

    v_state := jsonb_set(
      v_state,
      array['schools', v_school_id, 'funds'],
      to_jsonb(v_balance_after),
      false
    );
    v_state := jsonb_set(
      v_state,
      '{schoolManagement,fundsHistory}',
      v_history,
      false
    );
  else
    insert into public.shop_inventory (
      user_id,
      item_id,
      academic_year_index,
      quantity_remaining
    )
    values (p_user_id, v_item.item_id, v_year_index, 0)
    on conflict on constraint shop_inventory_user_id_item_id_academic_year_index_key do nothing;

    update public.shop_inventory as inventory
    set quantity_remaining = inventory.quantity_remaining + 1,
        updated_at = now()
    where inventory.user_id = p_user_id
      and inventory.item_id = v_item.item_id
      and inventory.academic_year_index = v_year_index;

    select coalesce(sum(inventory.quantity_remaining), 0)::integer
      into v_quantity
    from public.shop_inventory as inventory
    where inventory.user_id = p_user_id
      and inventory.item_id = v_item.item_id
      and inventory.academic_year_index <= v_year_index;
  end if;

  update public.shop_yearly_counters as counter
  set purchased_count = counter.purchased_count + 1,
      updated_at = now()
  where counter.user_id = p_user_id
    and counter.item_id = v_item.item_id
    and counter.academic_year_index = v_year_index
  returning counter.purchased_count, counter.used_count
    into v_purchased_count, v_used_count;

  v_resulting_revision := v_current_revision + 1;

  if v_funds_granted > 0 then
    update public.game_saves
    set state = v_state,
        revision = v_resulting_revision,
        updated_at = now()
    where user_id = p_user_id;
  else
    update public.game_saves
    set revision = v_resulting_revision,
        updated_at = now()
    where user_id = p_user_id;
  end if;

  v_response := jsonb_build_object(
    'operationId', btrim(p_operation_id),
    'operationType', 'purchase',
    'revision', v_resulting_revision,
    'academicYearIndex', v_year_index,
    'itemId', v_item.item_id,
    'quantityOwned', v_quantity,
    'purchasedCount', v_purchased_count,
    'usedCount', v_used_count
  );

  if v_funds_granted > 0 then
    v_response := v_response || jsonb_build_object(
      'result', jsonb_build_object(
        'fundsGranted', v_funds_granted,
        'balanceAfter', v_balance_after
      )
    );
  end if;

  insert into public.shop_operations (
    user_id,
    operation_id,
    operation_type,
    request_fingerprint,
    item_id,
    academic_year_index,
    resulting_revision,
    response
  )
  values (
    p_user_id,
    btrim(p_operation_id),
    'purchase',
    btrim(p_request_fingerprint),
    v_item.item_id,
    v_year_index,
    v_resulting_revision,
    v_response
  );

  insert into public.shop_transactions (
    user_id,
    operation_id,
    item_id,
    academic_year_index,
    price_yen
  )
  values (
    p_user_id,
    btrim(p_operation_id),
    v_item.item_id,
    v_year_index,
    0
  );

  return query select
    btrim(p_operation_id),
    'purchase'::text,
    btrim(p_request_fingerprint),
    v_resulting_revision,
    v_year_index,
    v_item.item_id,
    v_quantity,
    v_purchased_count,
    v_used_count,
    v_response,
    false;
end;
$$;

create or replace function public.commit_shop_item_use(
  p_user_id uuid,
  p_operation_id text,
  p_request_fingerprint text,
  p_expected_revision bigint,
  p_item_id text,
  p_state jsonb,
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
  v_current_revision bigint;
  v_resulting_revision bigint;
  v_year_index integer;
  v_submitted_year_index integer;
  v_item public.shop_item_definitions%rowtype;
  v_purchased_count integer;
  v_used_count integer;
  v_quantity integer;
  v_inventory_id uuid;
  v_inventory_row_quantity integer;
  v_existing_type text;
  v_existing_fingerprint text;
  v_existing_response jsonb;
  v_response jsonb;
  v_candidate_id text;
  v_overall_precision text;
  v_potential_precision text;
begin
  if p_user_id is null
    or nullif(btrim(p_operation_id), '') is null
    or nullif(btrim(p_request_fingerprint), '') is null
    or p_expected_revision is null
    or p_expected_revision < 1
    or nullif(btrim(p_item_id), '') is null
    or nullif(btrim(p_target_type), '') is null then
    raise exception using errcode = '22023', message = 'invalid_shop_use';
  end if;

  if jsonb_typeof(p_state) <> 'object'
    or jsonb_typeof(p_team_selection) <> 'object'
    or jsonb_typeof(p_safe_request) <> 'object'
    or jsonb_typeof(p_public_result) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_shop_use_payload';
  end if;

  if p_scouting_candidates is not null
    and jsonb_typeof(p_scouting_candidates) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_shop_scouting_payload';
  end if;
  if p_scouting_insight is not null
    and jsonb_typeof(p_scouting_insight) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_shop_scouting_payload';
  end if;

  select save.state, save.revision
    into v_current_state, v_current_revision
  from public.game_saves as save
  where save.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'game_not_initialized';
  end if;

  select operation.operation_type, operation.request_fingerprint, operation.response
    into v_existing_type, v_existing_fingerprint, v_existing_response
  from public.shop_operations as operation
  where operation.user_id = p_user_id
    and operation.operation_id = btrim(p_operation_id);

  if found then
    if v_existing_type <> 'use'
      or v_existing_fingerprint <> btrim(p_request_fingerprint) then
      raise exception using errcode = 'P0001', message = 'operation_id_reused';
    end if;

    return query select
      btrim(p_operation_id),
      'use'::text,
      btrim(p_request_fingerprint),
      (v_existing_response ->> 'revision')::bigint,
      (v_existing_response ->> 'academicYearIndex')::integer,
      v_existing_response ->> 'itemId',
      (v_existing_response ->> 'quantityOwned')::integer,
      (v_existing_response ->> 'purchasedCount')::integer,
      (v_existing_response ->> 'usedCount')::integer,
      v_existing_response,
      true;
    return;
  end if;

  if v_current_revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'revision_conflict';
  end if;

  begin
    v_year_index := (v_current_state ->> 'yearIndex')::integer;
    v_submitted_year_index := (p_state ->> 'yearIndex')::integer;
  exception when others then
    raise exception using errcode = '22023', message = 'invalid_shop_year';
  end;

  if v_year_index is null
    or v_year_index < 0
    or v_submitted_year_index is distinct from v_year_index then
    raise exception using errcode = '22023', message = 'invalid_shop_year';
  end if;

  select item.* into v_item
  from public.shop_item_definitions as item
  where item.item_id = btrim(p_item_id)
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'item_not_found';
  end if;
  if not v_item.enabled then
    raise exception using errcode = 'P0001', message = 'item_disabled';
  end if;

  select inventory.inventory_id, inventory.quantity_remaining
    into v_inventory_id, v_inventory_row_quantity
  from public.shop_inventory as inventory
  where inventory.user_id = p_user_id
    and inventory.item_id = v_item.item_id
    and inventory.academic_year_index <= v_year_index
    and inventory.quantity_remaining > 0
  order by inventory.academic_year_index, inventory.created_at, inventory.inventory_id
  limit 1
  for update;

  if not found or v_inventory_row_quantity <= 0 then
    raise exception using errcode = 'P0001', message = 'inventory_empty';
  end if;

  insert into public.shop_yearly_counters (
    user_id,
    item_id,
    academic_year_index,
    purchased_count,
    used_count
  )
  values (p_user_id, v_item.item_id, v_year_index, 0, 0)
  on conflict on constraint shop_yearly_counters_pkey do nothing;

  select counter.purchased_count, counter.used_count
    into v_purchased_count, v_used_count
  from public.shop_yearly_counters as counter
  where counter.user_id = p_user_id
    and counter.item_id = v_item.item_id
    and counter.academic_year_index = v_year_index
  for update;

  if v_used_count >= v_item.annual_use_limit then
    raise exception using errcode = 'P0001', message = 'use_limit_reached';
  end if;

  if p_scouting_candidates is not null then
    if nullif(btrim(coalesce(p_scouting_cycle_key, '')), '') is null
      or jsonb_array_length(p_scouting_candidates) = 0 then
      raise exception using errcode = 'P0001', message = 'scouting_cycle_unavailable';
    end if;

    update public.scouting_candidate_pools as pool
    set candidates = p_scouting_candidates
    where pool.user_id = p_user_id
      and pool.cycle_key = btrim(p_scouting_cycle_key);

    if not found then
      raise exception using errcode = 'P0001', message = 'scouting_cycle_unavailable';
    end if;
  end if;

  if p_scouting_insight is not null then
    if nullif(btrim(coalesce(p_scouting_cycle_key, '')), '') is null then
      raise exception using errcode = 'P0001', message = 'scouting_cycle_unavailable';
    end if;

    v_candidate_id := nullif(btrim(p_scouting_insight ->> 'candidateId'), '');
    v_overall_precision := p_scouting_insight ->> 'overallPrecision';
    v_potential_precision := p_scouting_insight ->> 'potentialPrecision';

    if v_candidate_id is null
      or v_overall_precision not in ('normal', 'researched')
      or v_potential_precision not in ('normal', 'researched', 'appraised') then
      raise exception using errcode = '22023', message = 'invalid_shop_scouting_payload';
    end if;

    if not exists (
      select 1
      from public.scouting_candidate_pools as pool
      where pool.user_id = p_user_id
        and pool.cycle_key = btrim(p_scouting_cycle_key)
    ) then
      raise exception using errcode = 'P0001', message = 'scouting_cycle_unavailable';
    end if;

    insert into public.scouting_candidate_insights (
      user_id,
      cycle_key,
      candidate_id,
      overall_precision,
      potential_precision
    )
    values (
      p_user_id,
      btrim(p_scouting_cycle_key),
      v_candidate_id,
      v_overall_precision,
      v_potential_precision
    )
    on conflict on constraint scouting_candidate_insights_pkey do update
      set overall_precision = excluded.overall_precision,
          potential_precision = excluded.potential_precision,
          updated_at = now();
  end if;

  update public.shop_inventory as inventory
  set quantity_remaining = inventory.quantity_remaining - 1,
      updated_at = now()
  where inventory.inventory_id = v_inventory_id;

  select coalesce(sum(inventory.quantity_remaining), 0)::integer
    into v_quantity
  from public.shop_inventory as inventory
  where inventory.user_id = p_user_id
    and inventory.item_id = v_item.item_id
    and inventory.academic_year_index <= v_year_index;

  update public.shop_yearly_counters as counter
  set used_count = counter.used_count + 1,
      updated_at = now()
  where counter.user_id = p_user_id
    and counter.item_id = v_item.item_id
    and counter.academic_year_index = v_year_index
  returning counter.purchased_count, counter.used_count
    into v_purchased_count, v_used_count;

  v_resulting_revision := v_current_revision + 1;

  update public.game_saves
  set revision = v_resulting_revision,
      state = p_state,
      team_selection = p_team_selection,
      updated_at = now()
  where user_id = p_user_id;

  v_response := jsonb_build_object(
    'operationId', btrim(p_operation_id),
    'operationType', 'use',
    'revision', v_resulting_revision,
    'academicYearIndex', v_year_index,
    'itemId', v_item.item_id,
    'quantityOwned', v_quantity,
    'purchasedCount', v_purchased_count,
    'usedCount', v_used_count,
    'result', p_public_result
  );

  insert into public.shop_operations (
    user_id,
    operation_id,
    operation_type,
    request_fingerprint,
    item_id,
    academic_year_index,
    resulting_revision,
    response
  )
  values (
    p_user_id,
    btrim(p_operation_id),
    'use',
    btrim(p_request_fingerprint),
    v_item.item_id,
    v_year_index,
    v_resulting_revision,
    v_response
  );

  insert into public.shop_item_uses (
    user_id,
    operation_id,
    item_id,
    academic_year_index,
    target_type,
    target_id,
    safe_request,
    public_result
  )
  values (
    p_user_id,
    btrim(p_operation_id),
    v_item.item_id,
    v_year_index,
    btrim(p_target_type),
    nullif(btrim(coalesce(p_target_id, '')), ''),
    p_safe_request,
    p_public_result
  );

  return query select
    btrim(p_operation_id),
    'use'::text,
    btrim(p_request_fingerprint),
    v_resulting_revision,
    v_year_index,
    v_item.item_id,
    v_quantity,
    v_purchased_count,
    v_used_count,
    v_response,
    false;
end;
$$;

revoke execute on function public.get_shop_status(uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.purchase_shop_item(uuid, text, text, bigint, text)
  from public, anon, authenticated;
revoke execute on function public.commit_shop_item_use(
  uuid, text, text, bigint, text, jsonb, jsonb, text, text,
  jsonb, jsonb, text, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.get_shop_status(uuid, integer) to service_role;
grant execute on function public.purchase_shop_item(uuid, text, text, bigint, text)
  to service_role;
grant execute on function public.commit_shop_item_use(
  uuid, text, text, bigint, text, jsonb, jsonb, text, text,
  jsonb, jsonb, text, jsonb, jsonb
) to service_role;
