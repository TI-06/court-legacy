-- Read-only administrative analytics. The browser has no direct access to these RPCs.
-- Counts of recent activity represent saved activity, not actual logins.
create table if not exists public.admin_login_attempts (
  bucket_key text primary key,
  window_started timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public.admin_login_attempts enable row level security;
revoke all on public.admin_login_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.admin_login_attempts to service_role;

create or replace function public.admin_claim_login_attempt(p_key text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_attempts integer;
begin
  if p_key is null or char_length(p_key) <> 64 then
    raise exception using errcode = '22023', message = 'invalid_admin_bucket';
  end if;
  insert into public.admin_login_attempts(bucket_key, window_started, attempts)
  values (p_key, now(), 1)
  on conflict (bucket_key) do update
  set attempts = case
      when admin_login_attempts.window_started < now() - interval '15 minutes'
      then 1 else admin_login_attempts.attempts + 1 end,
      window_started = case
      when admin_login_attempts.window_started < now() - interval '15 minutes'
      then now() else admin_login_attempts.window_started end
  returning attempts into v_attempts;
  return v_attempts <= 5;
end;
$$;
revoke all on function public.admin_claim_login_attempt(text) from public, anon, authenticated;
grant execute on function public.admin_claim_login_attempt(text) to service_role;

create or replace function public.admin_dashboard_summary()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_accounts jsonb;
  v_games jsonb;
  v_activity jsonb;
  v_pvp jsonb;
  v_shop jsonb;
  v_regions jsonb;
  v_daily jsonb;
  v_top_items jsonb;
begin
  select jsonb_build_object(
    'total', count(*),
    'today', count(*) filter (where created_at >= now() - interval '1 day'),
    'new7d', count(*) filter (where created_at >= now() - interval '7 days'),
    'new30d', count(*) filter (where created_at >= now() - interval '30 days')
  ) into v_accounts from auth.users;

  select jsonb_build_object(
    'onboarded', count(*),
    'saveUpdated7d', count(*) filter (where updated_at >= now() - interval '7 days'),
    'saveUpdated30d', count(*) filter (where updated_at >= now() - interval '30 days'),
    'averageRevision', coalesce(round(avg(revision), 1), 0),
    'highestRevision', coalesce(max(revision), 0),
    'averageYear', coalesce(round(avg(
      case when state->>'yearIndex' ~ '^[0-9]{1,6}$'
        then (state->>'yearIndex')::numeric else null end
    ), 1), 0),
    'highestYear', coalesce(max(
      case when state->>'yearIndex' ~ '^[0-9]{1,6}$'
        then (state->>'yearIndex')::integer else null end
    ), 0),
    'recordedMatches', coalesce(sum(
      case when jsonb_typeof(state->'history'->'matches') = 'array'
        then jsonb_array_length(state->'history'->'matches') else 0 end
    ), 0),
    'currentPlayers', coalesce(sum(
      case when jsonb_typeof(state->'players') = 'object'
        then jsonb_object_length(state->'players') else 0 end
    ), 0)
  ) into v_games from public.game_saves;

  select jsonb_build_object(
    'retainedOperations', count(*),
    'operations7d', count(*) filter (where created_at >= now() - interval '7 days'),
    'operations30d', count(*) filter (where created_at >= now() - interval '30 days')
  ) into v_activity from public.game_operations;

  select jsonb_build_object(
    'matches', (select count(*) from public.pvp_matches),
    'activePublishedTeams', (select count(*) from public.pvp_team_snapshots where is_active),
    'ratedPlayers', (select count(distinct user_id) from public.pvp_ratings)
  ) into v_pvp;

  select jsonb_build_object(
    'purchases', (select count(*) from public.shop_transactions),
    'uses', (select count(*) from public.shop_item_uses),
    'uses30d', (select count(*) from public.shop_item_uses where created_at >= now() - interval '30 days')
  ) into v_shop;

  select coalesce(jsonb_agg(jsonb_build_object('name', region_id, 'count', n)
    order by n desc, region_id), '[]'::jsonb) into v_regions
  from (select region_id, count(*) n from public.schools
    group by region_id order by n desc, region_id limit 12) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', d::date,
    'registrations', (select count(*) from auth.users u
      where u.created_at >= d and u.created_at < d + interval '1 day'),
    'operations', (select count(*) from public.game_operations o
      where o.created_at >= d and o.created_at < d + interval '1 day')
  ) order by d), '[]'::jsonb) into v_daily
  from generate_series(
    date_trunc('day', now()) - interval '29 days',
    date_trunc('day', now()), interval '1 day'
  ) as d;

  select coalesce(jsonb_agg(jsonb_build_object(
    'name', coalesce(def.display_name, used.item_id),
    'count', used.n
  ) order by used.n desc, used.item_id), '[]'::jsonb) into v_top_items
  from (select item_id, count(*) n from public.shop_item_uses
    group by item_id order by n desc, item_id limit 10) used
  left join public.shop_item_definitions def on def.item_id = used.item_id;

  return jsonb_build_object(
    'generatedAt', now(),
    'accounts', v_accounts, 'games', v_games,
    'activity', v_activity, 'pvp', v_pvp, 'shop', v_shop,
    'regions', v_regions, 'daily', v_daily, 'topItems', v_top_items
  );
end;
$$;
revoke all on function public.admin_dashboard_summary() from public, anon, authenticated;
grant execute on function public.admin_dashboard_summary() to service_role;

create or replace function public.admin_dashboard_accounts(
  p_search text default '',
  p_offset integer default 0,
  p_limit integer default 25
) returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if p_offset < 0 or p_offset > 10000 or p_limit < 1 or p_limit > 50
     or char_length(coalesce(p_search, '')) > 100 then
    raise exception using errcode = '22023', message = 'invalid_admin_query';
  end if;

  with filtered as (
    select u.id, u.email, u.created_at, u.last_sign_in_at,
      a.login_id, a.coach_name, a.school_name as account_school,
      s.school_name, s.region_id,
      g.revision, g.updated_at as save_updated_at,
      case when g.state->>'yearIndex' ~ '^[0-9]{1,6}$'
        then (g.state->>'yearIndex')::integer else null end as year_index,
      case when jsonb_typeof(g.state->'history'->'matches') = 'array'
        then jsonb_array_length(g.state->'history'->'matches') else 0 end as matches
    from auth.users u
    left join public.account_profiles a on a.user_id = u.id
    left join public.schools s on s.user_id = u.id
    left join public.game_saves g on g.user_id = u.id
    where coalesce(p_search, '') = ''
      or coalesce(a.login_id, '') ilike '%' || p_search || '%'
      or coalesce(u.email, '') ilike '%' || p_search || '%'
      or coalesce(s.school_name, a.school_name, '') ilike '%' || p_search || '%'
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', page.id, 'email', page.email, 'loginId', page.login_id,
        'coachName', page.coach_name,
        'schoolName', coalesce(page.school_name, page.account_school),
        'regionId', page.region_id, 'createdAt', page.created_at,
        'lastSignInAt', page.last_sign_in_at,
        'saveUpdatedAt', page.save_updated_at, 'revision', page.revision,
        'yearIndex', page.year_index, 'matches', page.matches
      ) order by page.created_at desc, page.id)
      from (
        select * from filtered order by created_at desc, id
        limit p_limit offset p_offset
      ) page
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.admin_dashboard_accounts(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.admin_dashboard_accounts(text, integer, integer)
  to service_role;
