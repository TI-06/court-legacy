-- Court Legacy V2 Phase 4 server-authoritative asynchronous PvP.
-- Hidden team truth is service-role-only. Browser roles never read these tables directly.

create table public.pvp_team_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_revision bigint not null check (source_revision > 0),
  source_academic_year integer not null,
  source_year_index integer not null check (source_year_index >= 0),
  school_name text not null check (char_length(btrim(school_name)) between 1 and 120),
  school_short_name text not null check (char_length(btrim(school_short_name)) between 1 and 40),
  reputation_rank text not null check (char_length(btrim(reputation_rank)) between 1 and 20),
  team_power integer not null check (team_power between 0 and 100),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index pvp_team_snapshots_one_active_per_user_idx
  on public.pvp_team_snapshots(user_id)
  where is_active;

create index pvp_team_snapshots_active_published_idx
  on public.pvp_team_snapshots(is_active, published_at desc, id);

create table public.pvp_ratings (
  season_id text not null check (season_id ~ '^[0-9]{4}-[0-9]{2}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null default 1000 check (rating >= 0),
  matches integer not null default 0 check (matches >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  current_win_streak integer not null default 0 check (current_win_streak >= 0),
  best_win_streak integer not null default 0 check (best_win_streak >= 0),
  best_rating integer not null default 1000 check (best_rating >= 0),
  updated_at timestamptz not null default now(),
  primary key (season_id, user_id),
  check (wins + losses = matches)
);

create index pvp_ratings_leaderboard_idx
  on public.pvp_ratings(season_id, rating desc, wins desc, user_id);

create table public.pvp_operations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation_id text not null check (char_length(btrim(operation_id)) between 1 and 120),
  kind text not null check (kind in ('publish', 'challenge')),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);

create table public.pvp_matches (
  id uuid primary key default gen_random_uuid(),
  season_id text not null check (season_id ~ '^[0-9]{4}-[0-9]{2}$'),
  challenge_day_key text not null check (challenge_day_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  operation_id text not null check (char_length(btrim(operation_id)) between 1 and 120),
  challenger_user_id uuid not null references public.profiles(id) on delete cascade,
  defender_user_id uuid not null references public.profiles(id) on delete cascade,
  defender_snapshot_id uuid not null references public.pvp_team_snapshots(id),
  challenger_source_revision bigint not null check (challenger_source_revision > 0),
  match_seed text not null check (char_length(btrim(match_seed)) between 1 and 240),
  challenger_rating_before integer not null check (challenger_rating_before >= 0),
  defender_rating_before integer not null check (defender_rating_before >= 0),
  challenger_rating_after integer not null check (challenger_rating_after >= 0),
  defender_rating_after integer not null check (defender_rating_after >= 0),
  winner_user_id uuid not null references public.profiles(id) on delete cascade,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  unique (challenger_user_id, operation_id),
  check (challenger_user_id <> defender_user_id),
  check (winner_user_id in (challenger_user_id, defender_user_id))
);

create index pvp_matches_daily_opponent_idx
  on public.pvp_matches(challenger_user_id, defender_user_id, challenge_day_key);

create index pvp_matches_user_history_idx
  on public.pvp_matches(season_id, created_at desc, id);

alter table public.pvp_team_snapshots enable row level security;
alter table public.pvp_ratings enable row level security;
alter table public.pvp_matches enable row level security;
alter table public.pvp_operations enable row level security;

revoke all on table public.pvp_team_snapshots from public, anon, authenticated;
revoke all on table public.pvp_ratings from public, anon, authenticated;
revoke all on table public.pvp_matches from public, anon, authenticated;
revoke all on table public.pvp_operations from public, anon, authenticated;

grant select, insert, update, delete on table public.pvp_team_snapshots to service_role;
grant select, insert, update, delete on table public.pvp_ratings to service_role;
grant select, insert, update, delete on table public.pvp_matches to service_role;
grant select, insert, update, delete on table public.pvp_operations to service_role;

create or replace function public.publish_pvp_team_snapshot(
  p_user_id uuid,
  p_operation_id text,
  p_source_revision bigint,
  p_source_academic_year integer,
  p_source_year_index integer,
  p_school_name text,
  p_school_short_name text,
  p_reputation_rank text,
  p_team_power integer,
  p_snapshot jsonb
)
returns table(
  id uuid,
  user_id uuid,
  source_revision bigint,
  source_academic_year integer,
  source_year_index integer,
  school jsonb,
  players jsonb,
  team_selection jsonb,
  is_active boolean,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_kind text;
  v_existing_response jsonb;
  v_snapshot_id uuid;
begin
  if p_user_id is null
    or nullif(btrim(p_operation_id), '') is null
    or char_length(btrim(p_operation_id)) > 120 then
    raise exception using errcode = '22023', message = 'invalid_pvp_publish_request';
  end if;

  if jsonb_typeof(p_snapshot) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_pvp_snapshot';
  end if;

  -- Serialize all publish operations for one user before checking idempotency.
  perform 1
  from public.profiles
  where profiles.id = p_user_id
  for update;

  select operations.kind, operations.response
  into v_existing_kind, v_existing_response
  from public.pvp_operations as operations
  where operations.user_id = p_user_id
    and operations.operation_id = btrim(p_operation_id);

  if found then
    if v_existing_kind <> 'publish' then
      raise exception using errcode = 'P0001', message = 'pvp_operation_conflict';
    end if;

    v_snapshot_id := nullif(v_existing_response ->> 'snapshotId', '')::uuid;

    return query
    select
      snapshots.id,
      snapshots.user_id,
      snapshots.source_revision,
      snapshots.source_academic_year,
      snapshots.source_year_index,
      snapshots.snapshot -> 'school',
      snapshots.snapshot -> 'players',
      snapshots.snapshot -> 'teamSelection',
      snapshots.is_active,
      snapshots.published_at
    from public.pvp_team_snapshots as snapshots
    where snapshots.id = v_snapshot_id;
    return;
  end if;

  update public.pvp_team_snapshots
  set is_active = false
  where pvp_team_snapshots.user_id = p_user_id
    and pvp_team_snapshots.is_active;

  insert into public.pvp_team_snapshots (
    user_id,
    source_revision,
    source_academic_year,
    source_year_index,
    school_name,
    school_short_name,
    reputation_rank,
    team_power,
    snapshot,
    is_active,
    published_at
  )
  values (
    p_user_id,
    p_source_revision,
    p_source_academic_year,
    p_source_year_index,
    btrim(p_school_name),
    btrim(p_school_short_name),
    btrim(p_reputation_rank),
    p_team_power,
    p_snapshot,
    true,
    now()
  )
  returning pvp_team_snapshots.id into v_snapshot_id;

  insert into public.pvp_operations(user_id, operation_id, kind, response)
  values (
    p_user_id,
    btrim(p_operation_id),
    'publish',
    jsonb_build_object('snapshotId', v_snapshot_id)
  );

  return query
  select
    snapshots.id,
    snapshots.user_id,
    snapshots.source_revision,
    snapshots.source_academic_year,
    snapshots.source_year_index,
    snapshots.snapshot -> 'school',
    snapshots.snapshot -> 'players',
    snapshots.snapshot -> 'teamSelection',
    snapshots.is_active,
    snapshots.published_at
  from public.pvp_team_snapshots as snapshots
  where snapshots.id = v_snapshot_id;
end;
$$;

create or replace function public.find_pvp_operation(
  p_user_id uuid,
  p_operation_id text
)
returns table(
  user_id uuid,
  operation_id text,
  kind text,
  response jsonb
)
language sql
security definer
set search_path = ''
as $$
  select operations.user_id, operations.operation_id, operations.kind, operations.response
  from public.pvp_operations as operations
  where operations.user_id = p_user_id
    and operations.operation_id = btrim(p_operation_id)
  limit 1;
$$;

create or replace function public.get_pvp_snapshot_by_id(
  p_snapshot_id uuid
)
returns table(
  id uuid,
  user_id uuid,
  source_revision bigint,
  source_academic_year integer,
  source_year_index integer,
  school jsonb,
  players jsonb,
  team_selection jsonb,
  is_active boolean,
  published_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    snapshots.id,
    snapshots.user_id,
    snapshots.source_revision,
    snapshots.source_academic_year,
    snapshots.source_year_index,
    snapshots.snapshot -> 'school',
    snapshots.snapshot -> 'players',
    snapshots.snapshot -> 'teamSelection',
    snapshots.is_active,
    snapshots.published_at
  from public.pvp_team_snapshots as snapshots
  where snapshots.id = p_snapshot_id
  limit 1;
$$;

create or replace function public.commit_pvp_rated_match(
  p_season_id text,
  p_challenge_day_key text,
  p_operation_id text,
  p_challenger_user_id uuid,
  p_defender_user_id uuid,
  p_defender_snapshot_id uuid,
  p_challenger_source_revision bigint,
  p_match_seed text,
  p_challenger_won boolean,
  p_result jsonb
)
returns table(
  match_id uuid,
  season_id text,
  operation_id text,
  challenger_user_id uuid,
  defender_user_id uuid,
  defender_snapshot_id uuid,
  winner_user_id uuid,
  challenger_rating_before integer,
  challenger_rating_after integer,
  defender_rating_before integer,
  defender_rating_after integer,
  result jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_kind text;
  v_existing_response jsonb;
  v_existing_match_id uuid;
  v_challenger_rating integer;
  v_defender_rating integer;
  v_expected numeric;
  v_delta integer;
  v_challenger_after integer;
  v_defender_after integer;
  v_winner_user_id uuid;
  v_match_id uuid;
begin
  if p_challenger_user_id = p_defender_user_id then
    raise exception using errcode = '22023', message = 'pvp_self_match';
  end if;

  insert into public.pvp_ratings(season_id, user_id)
  values (p_season_id, p_challenger_user_id)
  on conflict (season_id, user_id) do nothing;

  insert into public.pvp_ratings(season_id, user_id)
  values (p_season_id, p_defender_user_id)
  on conflict (season_id, user_id) do nothing;

  -- Stable lock order prevents challenger/defender inversion deadlocks.
  perform 1
  from public.pvp_ratings
  where season_id = p_season_id
    and user_id in (p_challenger_user_id, p_defender_user_id)
  order by user_id
  for update;

  select operations.kind, operations.response
  into v_existing_kind, v_existing_response
  from public.pvp_operations as operations
  where operations.user_id = p_challenger_user_id
    and operations.operation_id = btrim(p_operation_id);

  if found then
    if v_existing_kind <> 'challenge' then
      raise exception using errcode = 'P0001', message = 'pvp_operation_conflict';
    end if;

    v_existing_match_id := nullif(v_existing_response ->> 'matchId', '')::uuid;

    return query
    select
      matches.id,
      matches.season_id,
      matches.operation_id,
      matches.challenger_user_id,
      matches.defender_user_id,
      matches.defender_snapshot_id,
      matches.winner_user_id,
      matches.challenger_rating_before,
      matches.challenger_rating_after,
      matches.defender_rating_before,
      matches.defender_rating_after,
      matches.result,
      matches.created_at
    from public.pvp_matches as matches
    where matches.id = v_existing_match_id;
    return;
  end if;

  if (
    select count(*) >= 3
    from public.pvp_matches as matches
    where matches.challenger_user_id = p_challenger_user_id
      and matches.defender_user_id = p_defender_user_id
      and matches.challenge_day_key = p_challenge_day_key
  ) then
    raise exception using errcode = 'P0001', message = 'pvp_daily_opponent_limit';
  end if;

  select ratings.rating
  into v_challenger_rating
  from public.pvp_ratings as ratings
  where ratings.season_id = p_season_id
    and ratings.user_id = p_challenger_user_id;

  select ratings.rating
  into v_defender_rating
  from public.pvp_ratings as ratings
  where ratings.season_id = p_season_id
    and ratings.user_id = p_defender_user_id;

  v_expected := 1.0 / (1.0 + power(10.0, (v_defender_rating - v_challenger_rating) / 400.0));
  v_delta := round(32.0 * ((case when p_challenger_won then 1.0 else 0.0 end) - v_expected))::integer;
  v_challenger_after := greatest(0, v_challenger_rating + v_delta);
  v_defender_after := greatest(0, v_defender_rating - v_delta);
  v_winner_user_id := case when p_challenger_won then p_challenger_user_id else p_defender_user_id end;

  update public.pvp_ratings
  set
    rating = v_challenger_after,
    matches = matches + 1,
    wins = wins + case when p_challenger_won then 1 else 0 end,
    losses = losses + case when p_challenger_won then 0 else 1 end,
    current_win_streak = case when p_challenger_won then current_win_streak + 1 else 0 end,
    best_win_streak = greatest(
      best_win_streak,
      case when p_challenger_won then current_win_streak + 1 else 0 end
    ),
    best_rating = greatest(best_rating, v_challenger_after),
    updated_at = now()
  where pvp_ratings.season_id = p_season_id
    and pvp_ratings.user_id = p_challenger_user_id;

  update public.pvp_ratings
  set
    rating = v_defender_after,
    matches = matches + 1,
    wins = wins + case when p_challenger_won then 0 else 1 end,
    losses = losses + case when p_challenger_won then 1 else 0 end,
    current_win_streak = case when p_challenger_won then 0 else current_win_streak + 1 end,
    best_win_streak = greatest(
      best_win_streak,
      case when p_challenger_won then 0 else current_win_streak + 1 end
    ),
    best_rating = greatest(best_rating, v_defender_after),
    updated_at = now()
  where pvp_ratings.season_id = p_season_id
    and pvp_ratings.user_id = p_defender_user_id;

  insert into public.pvp_matches (
    season_id,
    challenge_day_key,
    operation_id,
    challenger_user_id,
    defender_user_id,
    defender_snapshot_id,
    challenger_source_revision,
    match_seed,
    challenger_rating_before,
    defender_rating_before,
    challenger_rating_after,
    defender_rating_after,
    winner_user_id,
    result
  )
  values (
    p_season_id,
    p_challenge_day_key,
    btrim(p_operation_id),
    p_challenger_user_id,
    p_defender_user_id,
    p_defender_snapshot_id,
    p_challenger_source_revision,
    p_match_seed,
    v_challenger_rating,
    v_defender_rating,
    v_challenger_after,
    v_defender_after,
    v_winner_user_id,
    p_result
  )
  returning pvp_matches.id into v_match_id;

  insert into public.pvp_operations(user_id, operation_id, kind, response)
  values (
    p_challenger_user_id,
    btrim(p_operation_id),
    'challenge',
    jsonb_build_object('matchId', v_match_id)
  );

  return query
  select
    matches.id,
    matches.season_id,
    matches.operation_id,
    matches.challenger_user_id,
    matches.defender_user_id,
    matches.defender_snapshot_id,
    matches.winner_user_id,
    matches.challenger_rating_before,
    matches.challenger_rating_after,
    matches.defender_rating_before,
    matches.defender_rating_after,
    matches.result,
    matches.created_at
  from public.pvp_matches as matches
  where matches.id = v_match_id;
end;
$$;

create or replace function public.list_pvp_opponents(
  p_user_id uuid,
  p_season_id text,
  p_limit integer,
  p_cursor text default null
)
returns table(
  snapshot_id uuid,
  school_name text,
  school_short_name text,
  reputation_rank text,
  team_power integer,
  academic_year integer,
  published_at timestamptz,
  rating integer,
  wins integer,
  losses integer,
  current_win_streak integer
)
language sql
security definer
set search_path = ''
as $$
  select
    snapshots.id,
    snapshots.school_name,
    snapshots.school_short_name,
    snapshots.reputation_rank,
    snapshots.team_power,
    snapshots.source_academic_year,
    snapshots.published_at,
    coalesce(ratings.rating, 1000),
    coalesce(ratings.wins, 0),
    coalesce(ratings.losses, 0),
    coalesce(ratings.current_win_streak, 0)
  from public.pvp_team_snapshots as snapshots
  left join public.pvp_ratings as ratings
    on ratings.user_id = snapshots.user_id
   and ratings.season_id = p_season_id
  where snapshots.is_active
    and snapshots.user_id <> p_user_id
    and (p_cursor is null or snapshots.id::text > p_cursor)
  order by snapshots.id
  limit least(greatest(p_limit, 1), 30);
$$;

create or replace function public.list_pvp_ranking(
  p_season_id text,
  p_limit integer,
  p_cursor text default null
)
returns table(
  rank bigint,
  snapshot_id uuid,
  school_name text,
  school_short_name text,
  rating integer,
  matches integer,
  wins integer,
  losses integer,
  current_win_streak integer
)
language sql
security definer
set search_path = ''
as $$
  with leaderboard as (
    select
      row_number() over (
        order by coalesce(ratings.rating, 1000) desc,
          coalesce(ratings.wins, 0) desc,
          snapshots.user_id
      ) as rank,
      snapshots.id as snapshot_id,
      snapshots.school_name,
      snapshots.school_short_name,
      coalesce(ratings.rating, 1000) as rating,
      coalesce(ratings.matches, 0) as matches,
      coalesce(ratings.wins, 0) as wins,
      coalesce(ratings.losses, 0) as losses,
      coalesce(ratings.current_win_streak, 0) as current_win_streak
    from public.pvp_team_snapshots as snapshots
    left join public.pvp_ratings as ratings
      on ratings.user_id = snapshots.user_id
     and ratings.season_id = p_season_id
    where snapshots.is_active
  )
  select leaderboard.*
  from leaderboard
  where p_cursor is null or leaderboard.rank > p_cursor::bigint
  order by leaderboard.rank
  limit least(greatest(p_limit, 1), 30);
$$;

create or replace function public.list_pvp_history(
  p_user_id uuid,
  p_season_id text,
  p_limit integer,
  p_cursor text default null
)
returns table(
  match_id uuid,
  created_at timestamptz,
  opponent_snapshot_id uuid,
  opponent_school_name text,
  outcome text,
  rating_before integer,
  rating_after integer,
  result jsonb
)
language sql
security definer
set search_path = ''
as $$
  select
    matches.id,
    matches.created_at,
    matches.defender_snapshot_id,
    case
      when matches.challenger_user_id = p_user_id then defender.school_name
      else coalesce(matches.result ->> 'challengerSchoolName', '対戦相手')
    end,
    case when matches.winner_user_id = p_user_id then 'win' else 'loss' end,
    case
      when matches.challenger_user_id = p_user_id then matches.challenger_rating_before
      else matches.defender_rating_before
    end,
    case
      when matches.challenger_user_id = p_user_id then matches.challenger_rating_after
      else matches.defender_rating_after
    end,
    matches.result
  from public.pvp_matches as matches
  join public.pvp_team_snapshots as defender
    on defender.id = matches.defender_snapshot_id
  where matches.season_id = p_season_id
    and (matches.challenger_user_id = p_user_id or matches.defender_user_id = p_user_id)
    and (p_cursor is null or matches.id::text < p_cursor)
  order by matches.created_at desc, matches.id desc
  limit least(greatest(p_limit, 1), 30);
$$;

revoke execute on function public.publish_pvp_team_snapshot(
  uuid, text, bigint, integer, integer, text, text, text, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.publish_pvp_team_snapshot(
  uuid, text, bigint, integer, integer, text, text, text, integer, jsonb
) to service_role;

revoke execute on function public.find_pvp_operation(uuid, text)
  from public, anon, authenticated;
grant execute on function public.find_pvp_operation(uuid, text) to service_role;

revoke execute on function public.get_pvp_snapshot_by_id(uuid)
  from public, anon, authenticated;
grant execute on function public.get_pvp_snapshot_by_id(uuid) to service_role;

revoke execute on function public.commit_pvp_rated_match(
  text, text, text, uuid, uuid, uuid, bigint, text, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_pvp_rated_match(
  text, text, text, uuid, uuid, uuid, bigint, text, boolean, jsonb
) to service_role;

revoke execute on function public.list_pvp_opponents(uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.list_pvp_opponents(uuid, text, integer, text)
  to service_role;

revoke execute on function public.list_pvp_ranking(text, integer, text)
  from public, anon, authenticated;
grant execute on function public.list_pvp_ranking(text, integer, text)
  to service_role;

revoke execute on function public.list_pvp_history(uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.list_pvp_history(uuid, text, integer, text)
  to service_role;