-- Fix PostgreSQL 42702 in commit_shop_item_use without duplicating the full RPC body.
-- The function already exists from the shop foundation migration; replace only the
-- ambiguous ON CONFLICT column target with its named primary-key constraint.

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'commit_shop_item_use'
    and pg_get_function_identity_arguments(p.oid) =
      'p_user_id uuid, p_operation_id text, p_request_fingerprint text, p_expected_revision bigint, p_item_id text, p_state jsonb, p_team_selection jsonb, p_target_type text, p_target_id text, p_safe_request jsonb, p_public_result jsonb, p_scouting_cycle_key text, p_scouting_candidates jsonb, p_scouting_insight jsonb';

  if v_definition is null then
    raise exception using errcode = 'P0002', message = 'commit_shop_item_use_missing';
  end if;

  if position(
    'on conflict (user_id, item_id, academic_year_index) do nothing'
    in lower(v_definition)
  ) = 0 then
    raise exception using errcode = 'P0001', message = 'shop_use_conflict_target_not_found';
  end if;

  v_definition := regexp_replace(
    v_definition,
    'on conflict \(user_id, item_id, academic_year_index\) do nothing',
    'on conflict on constraint shop_yearly_counters_pkey do nothing',
    'i'
  );

  execute v_definition;
end
$$;
