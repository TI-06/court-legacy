drop function if exists public.list_pvp_opponents(uuid, text, integer, text);

create function public.list_pvp_opponents(
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
  current_win_streak integer,
  tactics jsonb
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
    coalesce(ratings.current_win_streak, 0),
    snapshots.snapshot #> '{school,phase15PublicTactics}'
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

revoke execute on function public.list_pvp_opponents(uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.list_pvp_opponents(uuid, text, integer, text)
  to service_role;
