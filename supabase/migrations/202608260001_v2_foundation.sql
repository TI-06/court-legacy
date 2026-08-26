-- Court Legacy V2 Phase 1 cloud persistence foundation.
-- Game state is intentionally snapshot-based in Phase 1; normalized long-term
-- recruiting/history/PvP tables are added in later phases.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  school_name text not null check (char_length(btrim(school_name)) between 1 and 60),
  school_short_name text not null check (char_length(btrim(school_short_name)) between 1 and 30),
  coach_name text not null check (char_length(btrim(coach_name)) between 1 and 40),
  region_id text not null check (char_length(btrim(region_id)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_saves (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  school_id uuid not null unique references public.schools(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  team_selection jsonb not null check (jsonb_typeof(team_selection) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_operations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation_id text not null check (char_length(btrim(operation_id)) between 1 and 120),
  school_id uuid not null references public.schools(id) on delete cascade,
  expected_revision bigint not null check (expected_revision > 0),
  resulting_revision bigint not null check (resulting_revision > expected_revision),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);

create index schools_user_id_idx on public.schools(user_id);
create index game_saves_school_id_idx on public.game_saves(school_id);
create index game_operations_created_at_idx on public.game_operations(created_at);

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.game_saves enable row level security;
alter table public.game_operations enable row level security;

-- Phase 1 does not expose game tables directly to browsers. All reads and
-- mutations pass through the authenticated Cloudflare Worker.
revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.schools from public, anon, authenticated;
revoke all on table public.game_saves from public, anon, authenticated;
revoke all on table public.game_operations from public, anon, authenticated;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.schools to service_role;
grant select, insert, update, delete on table public.game_saves to service_role;
grant select, insert, update, delete on table public.game_operations to service_role;

create or replace function public.create_v2_game(
  p_user_id uuid,
  p_display_name text,
  p_school_name text,
  p_school_short_name text,
  p_coach_name text,
  p_region_id text,
  p_state jsonb,
  p_team_selection jsonb
)
returns table(school_id uuid, revision bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_revision bigint := 1;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'user id is required';
  end if;

  if nullif(btrim(p_display_name), '') is null
    or nullif(btrim(p_school_name), '') is null
    or nullif(btrim(p_school_short_name), '') is null
    or nullif(btrim(p_coach_name), '') is null
    or nullif(btrim(p_region_id), '') is null then
    raise exception using errcode = '22023', message = 'onboarding fields are required';
  end if;

  if jsonb_typeof(p_state) <> 'object'
    or jsonb_typeof(p_team_selection) <> 'object' then
    raise exception using errcode = '22023', message = 'game state must be JSON objects';
  end if;

  insert into public.profiles (id, display_name)
  values (p_user_id, btrim(p_display_name))
  on conflict (id) do update
    set display_name = excluded.display_name,
        updated_at = now();

  insert into public.schools (
    user_id,
    school_name,
    school_short_name,
    coach_name,
    region_id
  )
  values (
    p_user_id,
    btrim(p_school_name),
    btrim(p_school_short_name),
    btrim(p_coach_name),
    btrim(p_region_id)
  )
  returning id into v_school_id;

  insert into public.game_saves (
    user_id,
    school_id,
    revision,
    state,
    team_selection
  )
  values (
    p_user_id,
    v_school_id,
    v_revision,
    p_state,
    p_team_selection
  );

  return query select v_school_id, v_revision;
end;
$$;

revoke execute on function public.create_v2_game(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_v2_game(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) to service_role;
