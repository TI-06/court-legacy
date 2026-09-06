-- School economy foundation: schema v7 save backfill and atomic zero-yen fund grants.

insert into public.shop_item_definitions (
  item_id,
  display_name,
  description,
  price_yen,
  annual_purchase_limit,
  annual_use_limit,
  effect_type,
  enabled,
  sort_order
)
values
  ('funds-grant-300', '資金 +300', '学校運営資金を300受け取ります。', 0, 3, 3, 'funds-grant', true, 80),
  ('funds-grant-1000', '資金 +1,000', '学校運営資金を1,000受け取ります。', 0, 1, 1, 'funds-grant', true, 90),
  ('funds-grant-3000', '資金 +3,000', '学校運営資金を3,000受け取ります。', 0, 1, 1, 'funds-grant', true, 100)
on conflict (item_id) do update
set display_name = excluded.display_name,
    description = excluded.description,
    price_yen = excluded.price_yen,
    annual_purchase_limit = excluded.annual_purchase_limit,
    annual_use_limit = excluded.annual_use_limit,
    effect_type = excluded.effect_type,
    enabled = excluded.enabled,
    sort_order = excluded.sort_order,
    updated_at = now();

update public.game_saves as save
set state = jsonb_set(
  jsonb_set(save.state, '{schemaVersion}', '7'::jsonb, true),
  '{schoolManagement}',
  jsonb_build_object(
    'assistantCoach', null,
    'fundsHistory', '[]'::jsonb,
    'lastAnnualBudgetYearIndex', (save.state ->> 'yearIndex')::integer
  ),
  true
)
where (save.state ->> 'schemaVersion')::integer = 6
  and not (save.state ? 'schoolManagement');

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
  if not v_item.enabled then
    raise exception using errcode = 'P0001', message = 'item_disabled';
  end if;
  if v_item.price_yen <> 0 then
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
  on conflict (user_id, item_id, academic_year_index) do nothing;

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
    on conflict (user_id, item_id, academic_year_index) do nothing;

    update public.shop_inventory as inventory
    set quantity_remaining = inventory.quantity_remaining + 1,
        updated_at = now()
    where inventory.user_id = p_user_id
      and inventory.item_id = v_item.item_id
      and inventory.academic_year_index = v_year_index
    returning inventory.quantity_remaining into v_quantity;
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
