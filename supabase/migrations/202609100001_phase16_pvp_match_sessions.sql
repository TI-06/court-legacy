-- Court Legacy Phase 16 private resumable PvP match sessions.
-- Raw match runtime stays service-role-only. Rated match/rating finalization remains
-- exclusively owned by commit_pvp_rated_match from the Phase 4 migration.

create table public.pvp_match_sessions (
  challenger_user_id uuid not null references public.profiles(id) on delete cascade,
  operation_id text not null check (char_length(btrim(operation_id)) between 1 and 120),
  defender_snapshot_id uuid not null references public.pvp_team_snapshots(id),
  challenger_source_revision bigint not null check (challenger_source_revision > 0),
  current_cursor bigint not null check (current_cursor >= 0),
  private_session jsonb not null check (jsonb_typeof(private_session) = 'object'),
  public_response jsonb not null check (jsonb_typeof(public_response) = 'object'),
  final_response jsonb check (final_response is null or jsonb_typeof(final_response) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (challenger_user_id, operation_id)
);

create table public.pvp_match_command_receipts (
  challenger_user_id uuid not null,
  operation_id text not null,
  command_id text not null check (char_length(btrim(command_id)) between 1 and 120),
  command jsonb not null check (jsonb_typeof(command) = 'object'),
  resulting_cursor bigint not null check (resulting_cursor >= 0),
  public_response jsonb not null check (jsonb_typeof(public_response) = 'object'),
  created_at timestamptz not null default now(),
  primary key (challenger_user_id, operation_id, command_id),
  foreign key (challenger_user_id, operation_id)
    references public.pvp_match_sessions(challenger_user_id, operation_id)
    on delete cascade
);

alter table public.pvp_match_sessions enable row level security;
alter table public.pvp_match_command_receipts enable row level security;

revoke all on table public.pvp_match_sessions from public, anon, authenticated;
revoke all on table public.pvp_match_command_receipts from public, anon, authenticated;

grant select, insert, update, delete on table public.pvp_match_sessions to service_role;
grant select, insert, update, delete on table public.pvp_match_command_receipts to service_role;

create or replace function public.create_pvp_match_session(
  p_challenger_user_id uuid,
  p_operation_id text,
  p_defender_snapshot_id uuid,
  p_challenger_source_revision bigint,
  p_current_cursor bigint,
  p_private_session jsonb,
  p_public_response jsonb
)
returns table(
  challenger_user_id uuid,
  operation_id text,
  defender_snapshot_id uuid,
  challenger_source_revision bigint,
  current_cursor bigint,
  private_session jsonb,
  public_response jsonb,
  final_response jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation_kind text;
  v_existing_defender uuid;
  v_existing_revision bigint;
begin
  if p_challenger_user_id is null
    or p_defender_snapshot_id is null
    or nullif(btrim(p_operation_id), '') is null
    or char_length(btrim(p_operation_id)) > 120
    or p_challenger_source_revision <= 0
    or p_current_cursor < 0
    or jsonb_typeof(p_private_session) <> 'object'
    or jsonb_typeof(p_public_response) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_pvp_match_session';
  end if;

  perform 1
  from public.profiles as profiles
  where profiles.id = p_challenger_user_id
  for update;

  select operations.kind
  into v_operation_kind
  from public.pvp_operations as operations
  where operations.user_id = p_challenger_user_id
    and operations.operation_id = btrim(p_operation_id);

  if found then
    raise exception using errcode = 'P0001', message = 'pvp_operation_conflict';
  end if;

  select sessions.defender_snapshot_id, sessions.challenger_source_revision
  into v_existing_defender, v_existing_revision
  from public.pvp_match_sessions as sessions
  where sessions.challenger_user_id = p_challenger_user_id
    and sessions.operation_id = btrim(p_operation_id)
  for update;

  if found then
    if v_existing_defender <> p_defender_snapshot_id
      or v_existing_revision <> p_challenger_source_revision then
      raise exception using errcode = 'P0001', message = 'pvp_session_operation_conflict';
    end if;

    return query
    select
      sessions.challenger_user_id,
      sessions.operation_id,
      sessions.defender_snapshot_id,
      sessions.challenger_source_revision,
      sessions.current_cursor,
      sessions.private_session,
      sessions.public_response,
      sessions.final_response,
      sessions.created_at,
      sessions.updated_at
    from public.pvp_match_sessions as sessions
    where sessions.challenger_user_id = p_challenger_user_id
      and sessions.operation_id = btrim(p_operation_id);
    return;
  end if;

  insert into public.pvp_match_sessions (
    challenger_user_id,
    operation_id,
    defender_snapshot_id,
    challenger_source_revision,
    current_cursor,
    private_session,
    public_response
  )
  values (
    p_challenger_user_id,
    btrim(p_operation_id),
    p_defender_snapshot_id,
    p_challenger_source_revision,
    p_current_cursor,
    p_private_session,
    p_public_response
  );

  return query
  select
    sessions.challenger_user_id,
    sessions.operation_id,
    sessions.defender_snapshot_id,
    sessions.challenger_source_revision,
    sessions.current_cursor,
    sessions.private_session,
    sessions.public_response,
    sessions.final_response,
    sessions.created_at,
    sessions.updated_at
  from public.pvp_match_sessions as sessions
  where sessions.challenger_user_id = p_challenger_user_id
    and sessions.operation_id = btrim(p_operation_id);
end;
$$;

create or replace function public.get_pvp_match_session(
  p_challenger_user_id uuid,
  p_operation_id text
)
returns table(
  challenger_user_id uuid,
  operation_id text,
  defender_snapshot_id uuid,
  challenger_source_revision bigint,
  current_cursor bigint,
  private_session jsonb,
  public_response jsonb,
  final_response jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    sessions.challenger_user_id,
    sessions.operation_id,
    sessions.defender_snapshot_id,
    sessions.challenger_source_revision,
    sessions.current_cursor,
    sessions.private_session,
    sessions.public_response,
    sessions.final_response,
    sessions.created_at,
    sessions.updated_at
  from public.pvp_match_sessions as sessions
  where sessions.challenger_user_id = p_challenger_user_id
    and sessions.operation_id = btrim(p_operation_id)
  limit 1;
$$;

create or replace function public.get_pvp_match_session_command_receipt(
  p_challenger_user_id uuid,
  p_operation_id text,
  p_command_id text
)
returns table(
  command_id text,
  command jsonb,
  public_response jsonb
)
language sql
security definer
set search_path = ''
as $$
  select
    receipts.command_id,
    receipts.command,
    receipts.public_response
  from public.pvp_match_command_receipts as receipts
  where receipts.challenger_user_id = p_challenger_user_id
    and receipts.operation_id = btrim(p_operation_id)
    and receipts.command_id = btrim(p_command_id)
  limit 1;
$$;

create or replace function public.save_pvp_match_session_command(
  p_challenger_user_id uuid,
  p_operation_id text,
  p_command_id text,
  p_command jsonb,
  p_expected_cursor bigint,
  p_next_cursor bigint,
  p_private_session jsonb,
  p_public_response jsonb
)
returns table(
  challenger_user_id uuid,
  operation_id text,
  defender_snapshot_id uuid,
  challenger_source_revision bigint,
  current_cursor bigint,
  private_session jsonb,
  public_response jsonb,
  final_response jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  replayed boolean,
  command_response jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_cursor bigint;
  v_final_response jsonb;
  v_receipt_command jsonb;
  v_receipt_response jsonb;
begin
  if nullif(btrim(p_operation_id), '') is null
    or nullif(btrim(p_command_id), '') is null
    or char_length(btrim(p_operation_id)) > 120
    or char_length(btrim(p_command_id)) > 120
    or p_expected_cursor < 0
    or p_next_cursor < p_expected_cursor
    or jsonb_typeof(p_command) <> 'object'
    or jsonb_typeof(p_private_session) <> 'object'
    or jsonb_typeof(p_public_response) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_pvp_match_session_command';
  end if;

  select sessions.current_cursor, sessions.final_response
  into v_current_cursor, v_final_response
  from public.pvp_match_sessions as sessions
  where sessions.challenger_user_id = p_challenger_user_id
    and sessions.operation_id = btrim(p_operation_id)
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'pvp_match_session_not_found';
  end if;

  select receipts.command, receipts.public_response
  into v_receipt_command, v_receipt_response
  from public.pvp_match_command_receipts as receipts
  where receipts.challenger_user_id = p_challenger_user_id
    and receipts.operation_id = btrim(p_operation_id)
    and receipts.command_id = btrim(p_command_id);

  if found then
    if v_receipt_command <> p_command then
      raise exception using errcode = 'P0001', message = 'pvp_command_conflict';
    end if;

    return query
    select
      sessions.challenger_user_id,
      sessions.operation_id,
      sessions.defender_snapshot_id,
      sessions.challenger_source_revision,
      sessions.current_cursor,
      sessions.private_session,
      sessions.public_response,
      sessions.final_response,
      sessions.created_at,
      sessions.updated_at,
      true,
      v_receipt_response
    from public.pvp_match_sessions as sessions
    where sessions.challenger_user_id = p_challenger_user_id
      and sessions.operation_id = btrim(p_operation_id);
    return;
  end if;

  if v_final_response is not null then
    raise exception using errcode = 'P0001', message = 'pvp_match_session_finalized';
  end if;

  if v_current_cursor <> p_expected_cursor then
    raise exception using errcode = 'P0001', message = 'pvp_match_session_stale';
  end if;

  update public.pvp_match_sessions as sessions
  set
    current_cursor = p_next_cursor,
    private_session = p_private_session,
    public_response = p_public_response,
    updated_at = now()
  where sessions.challenger_user_id = p_challenger_user_id
    and sessions.operation_id = btrim(p_operation_id);

  insert into public.pvp_match_command_receipts (
    challenger_user_id,
    operation_id,
    command_id,
    command,
    resulting_cursor,
    public_response
  )
  values (
    p_challenger_user_id,
    btrim(p_operation_id),
    btrim(p_command_id),
    p_command,
    p_next_cursor,
    p_public_response
  );

  return query
  select
    sessions.challenger_user_id,
    sessions.operation_id,
    sessions.defender_snapshot_id,
    sessions.challenger_source_revision,
    sessions.current_cursor,
    sessions.private_session,
    sessions.public_response,
    sessions.final_response,
    sessions.created_at,
    sessions.updated_at,
    false,
    p_public_response
  from public.pvp_match_sessions as sessions
  where sessions.challenger_user_id = p_challenger_user_id
    and sessions.operation_id = btrim(p_operation_id);
end;
$$;

create or replace function public.store_pvp_match_session_final_response(
  p_challenger_user_id uuid,
  p_operation_id text,
  p_final_response jsonb
)
returns table(
  challenger_user_id uuid,
  operation_id text,
  defender_snapshot_id uuid,
  challenger_source_revision bigint,
  current_cursor bigint,
  private_session jsonb,
  public_response jsonb,
  final_response jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_final_response jsonb;
begin
  if nullif(btrim(p_operation_id), '') is null
    or char_length(btrim(p_operation_id)) > 120
    or jsonb_typeof(p_final_response) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_pvp_final_response';
  end if;

  select sessions.final_response
  into v_existing_final_response
  from public.pvp_match_sessions as sessions
  where sessions.challenger_user_id = p_challenger_user_id
    and sessions.operation_id = btrim(p_operation_id)
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'pvp_match_session_not_found';
  end if;

  if v_existing_final_response is not null then
    if v_existing_final_response <> p_final_response then
      raise exception using errcode = 'P0001', message = 'pvp_final_response_conflict';
    end if;
  else
    update public.pvp_match_sessions as sessions
    set
      final_response = p_final_response,
      public_response = p_final_response,
      updated_at = now()
    where sessions.challenger_user_id = p_challenger_user_id
      and sessions.operation_id = btrim(p_operation_id);
  end if;

  return query
  select
    sessions.challenger_user_id,
    sessions.operation_id,
    sessions.defender_snapshot_id,
    sessions.challenger_source_revision,
    sessions.current_cursor,
    sessions.private_session,
    sessions.public_response,
    sessions.final_response,
    sessions.created_at,
    sessions.updated_at
  from public.pvp_match_sessions as sessions
  where sessions.challenger_user_id = p_challenger_user_id
    and sessions.operation_id = btrim(p_operation_id);
end;
$$;

revoke execute on function public.create_pvp_match_session(uuid, text, uuid, bigint, bigint, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.get_pvp_match_session(uuid, text) from public, anon, authenticated;
revoke execute on function public.get_pvp_match_session_command_receipt(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.save_pvp_match_session_command(uuid, text, text, jsonb, bigint, bigint, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.store_pvp_match_session_final_response(uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.create_pvp_match_session(uuid, text, uuid, bigint, bigint, jsonb, jsonb) to service_role;
grant execute on function public.get_pvp_match_session(uuid, text) to service_role;
grant execute on function public.get_pvp_match_session_command_receipt(uuid, text, text) to service_role;
grant execute on function public.save_pvp_match_session_command(uuid, text, text, jsonb, bigint, bigint, jsonb, jsonb) to service_role;
grant execute on function public.store_pvp_match_session_final_response(uuid, text, jsonb) to service_role;
