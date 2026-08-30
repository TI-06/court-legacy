-- Normalize PvP history for both challenger and defender viewers.
-- The canonical match result stays challenger-centric; the browser receives
-- a perspective flag so it can render the score from the authenticated user's side.

drop function if exists public.list_pvp_history(uuid, text, integer, text);

create function public.list_pvp_history(
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
  perspective text,
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
    case
      when matches.challenger_user_id = p_user_id then matches.defender_snapshot_id
      else null::uuid
    end,
    case
      when matches.challenger_user_id = p_user_id then defender.school_name
      else coalesce(matches.result ->> 'challengerSchoolName', '対戦相手')
    end,
    case
      when matches.challenger_user_id = p_user_id then 'challenger'
      else 'defender'
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
    and (
      p_cursor is null
      or (matches.created_at, matches.id::text) < (
        split_part(p_cursor, '|', 1)::timestamptz,
        split_part(p_cursor, '|', 2)
      )
    )
  order by matches.created_at desc, matches.id desc
  limit least(greatest(p_limit, 1), 30);
$$;

revoke execute on function public.list_pvp_history(uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.list_pvp_history(uuid, text, integer, text)
  to service_role;
