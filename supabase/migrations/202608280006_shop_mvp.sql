-- Court Legacy V2 Phase 5 server-authoritative zero-yen shop persistence.
-- Browser roles never access these tables or mutation RPCs directly.

create table public.shop_item_definitions (
  item_id text primary key check (char_length(btrim(item_id)) between 1 and 80),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  description text not null check (char_length(btrim(description)) between 1 and 240),
  price_yen integer not null default 0 check (price_yen = 0),
  annual_purchase_limit integer not null check (annual_purchase_limit > 0),
  annual_use_limit integer not null check (annual_use_limit > 0),
  effect_type text not null check (char_length(btrim(effect_type)) between 1 and 80),
  enabled boolean not null default true,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_inventory (
  inventory_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.shop_item_definitions(item_id),
  academic_year_index integer not null check (academic_year_index >= 0),
  quantity_remaining integer not null default 0 check (quantity_remaining >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_id, academic_year_index)
);

create table public.shop_operations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation_id text not null check (char_length(btrim(operation_id)) between 1 and 120),
  operation_type text not null check (operation_type in ('purchase', 'use')),
  request_fingerprint text not null check (char_length(btrim(request_fingerprint)) between 1 and 320),
  item_id text not null references public.shop_item_definitions(item_id),
  academic_year_index integer not null check (academic_year_index >= 0),
  resulting_revision bigint not null check (resulting_revision > 0),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);

create table public.shop_transactions (
  transaction_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation_id text not null,
  item_id text not null references public.shop_item_definitions(item_id),
  academic_year_index integer not null check (academic_year_index >= 0),
  price_yen integer not null check (price_yen = 0),
  created_at timestamptz not null default now(),
  foreign key (user_id, operation_id)
    references public.shop_operations(user_id, operation_id) on delete cascade,
  unique (user_id, operation_id)
);

create table public.shop_item_uses (
  use_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation_id text not null,
  item_id text not null references public.shop_item_definitions(item_id),
  academic_year_index integer not null check (academic_year_index >= 0),
  target_type text not null check (char_length(btrim(target_type)) between 1 and 40),
  target_id text,
  safe_request jsonb not null check (jsonb_typeof(safe_request) = 'object'),
  public_result jsonb not null check (jsonb_typeof(public_result) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (user_id, operation_id)
    references public.shop_operations(user_id, operation_id) on delete cascade,
  unique (user_id, operation_id)
);

create table public.shop_yearly_counters (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.shop_item_definitions(item_id),
  academic_year_index integer not null check (academic_year_index >= 0),
  purchased_count integer not null default 0 check (purchased_count >= 0),
  used_count integer not null default 0 check (used_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id, academic_year_index)
);

create table public.scouting_candidate_insights (
  user_id uuid not null references public.profiles(id) on delete cascade,
  cycle_key text not null check (char_length(btrim(cycle_key)) between 1 and 160),
  candidate_id text not null check (char_length(btrim(candidate_id)) between 1 and 160),
  overall_precision text not null default 'normal'
    check (overall_precision in ('normal', 'researched')),
  potential_precision text not null default 'normal'
    check (potential_precision in ('normal', 'researched', 'appraised')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, cycle_key, candidate_id),
  foreign key (user_id, cycle_key)
    references public.scouting_candidate_pools(user_id, cycle_key) on delete cascade
);

create index shop_inventory_active_idx
  on public.shop_inventory(user_id, academic_year_index, item_id);
create index shop_transactions_history_idx
  on public.shop_transactions(user_id, created_at desc);
create index shop_item_uses_history_idx
  on public.shop_item_uses(user_id, created_at desc);
create index shop_operations_created_idx
  on public.shop_operations(user_id, created_at desc);

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
  ('extra-scout-candidate', '新入生候補追加', '今年度の新入生スカウト候補を1名追加します。', 0, 1, 1, 'extra-scout-candidate', true, 10),
  ('scout-research', 'スカウト再調査', '指定した候補のスカウト情報を高精度で再調査します。', 0, 2, 2, 'scout-research', true, 20),
  ('potential-appraisal', '潜在能力鑑定', '指定した候補の将来性をより狭い推定範囲で鑑定します。', 0, 3, 3, 'potential-appraisal', true, 30),
  ('training-camp', '強化合宿', 'チーム全体へ追加の特別育成を実施します。', 0, 1, 1, 'training-camp', true, 40),
  ('fatigue-recovery', '疲労回復', '指定した選手1名の疲労を大きく回復します。', 0, 3, 3, 'fatigue-recovery', true, 50),
  ('special-coach', '特別コーチ', '指定した選手1名へ重点個別育成を実施します。', 0, 1, 1, 'special-coach', true, 60),
  ('training-efficiency-boost', '練習効率アップ', '次回の通常練習1回だけ成長効率を20%高めます。', 0, 1, 1, 'training-efficiency-boost', true, 70);

alter table public.shop_item_definitions enable row level security;
alter table public.shop_inventory enable row level security;
alter table public.shop_operations enable row level security;
alter table public.shop_transactions enable row level security;
alter table public.shop_item_uses enable row level security;
alter table public.shop_yearly_counters enable row level security;
alter table public.scouting_candidate_insights enable row level security;

revoke all on table public.shop_item_definitions from public, anon, authenticated;
revoke all on table public.shop_inventory from public, anon, authenticated;
revoke all on table public.shop_operations from public, anon, authenticated;
revoke all on table public.shop_transactions from public, anon, authenticated;
revoke all on table public.shop_item_uses from public, anon, authenticated;
revoke all on table public.shop_yearly_counters from public, anon, authenticated;
revoke all on table public.scouting_candidate_insights from public, anon, authenticated;

grant select, insert, update, delete on table public.shop_item_definitions to service_role;
grant select, insert, update, delete on table public.shop_inventory to service_role;
grant select, insert, update, delete on table public.shop_operations to service_role;
grant select, insert, update, delete on table public.shop_transactions to service_role;
grant select, insert, update, delete on table public.shop_item_uses to service_role;
grant select, insert, update, delete on table public.shop_yearly_counters to service_role;
grant select, insert, update, delete on table public.scouting_candidate_insights to service_role;

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
  left join public.shop_inventory as inventory
    on inventory.user_id = p_user_id
   and inventory.item_id = item.item_id
   and inventory.academic_year_index = p_current_year_index
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

  update public.shop_yearly_counters as counter
  set purchased_count = counter.purchased_count + 1,
      updated_at = now()
  where counter.user_id = p_user_id
    and counter.item_id = v_item.item_id
    and counter.academic_year_index = v_year_index
  returning counter.purchased_count, counter.used_count
    into v_purchased_count, v_used_count;

  v_resulting_revision := v_current_revision + 1;

  update public.game_saves
  set revision = v_resulting_revision,
      updated_at = now()
  where user_id = p_user_id;

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

  select inventory.quantity_remaining into v_quantity
  from public.shop_inventory as inventory
  where inventory.user_id = p_user_id
    and inventory.item_id = v_item.item_id
    and inventory.academic_year_index = v_year_index
  for update;

  if not found or v_quantity <= 0 then
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
  on conflict (user_id, item_id, academic_year_index) do nothing;

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
    on conflict (user_id, cycle_key, candidate_id) do update
      set overall_precision = excluded.overall_precision,
          potential_precision = excluded.potential_precision,
          updated_at = now();
  end if;

  update public.shop_inventory as inventory
  set quantity_remaining = inventory.quantity_remaining - 1,
      updated_at = now()
  where inventory.user_id = p_user_id
    and inventory.item_id = v_item.item_id
    and inventory.academic_year_index = v_year_index
  returning inventory.quantity_remaining into v_quantity;

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

revoke execute on function public.get_shop_status(
  uuid,
  integer
) from public, anon, authenticated;
revoke execute on function public.purchase_shop_item(
  uuid,
  text,
  text,
  bigint,
  text
) from public, anon, authenticated;
revoke execute on function public.commit_shop_item_use(
  uuid,
  text,
  text,
  bigint,
  text,
  jsonb,
  jsonb,
  text,
  text,
  jsonb,
  jsonb,
  text,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.get_shop_status(
  uuid,
  integer
) to service_role;
grant execute on function public.purchase_shop_item(
  uuid,
  text,
  text,
  bigint,
  text
) to service_role;
grant execute on function public.commit_shop_item_use(
  uuid,
  text,
  text,
  bigint,
  text,
  jsonb,
  jsonb,
  text,
  text,
  jsonb,
  jsonb,
  text,
  jsonb,
  jsonb
) to service_role;
