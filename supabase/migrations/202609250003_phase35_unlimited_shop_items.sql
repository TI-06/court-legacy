-- Phase35-1: remove practical purchase/use caps from shop items.
-- Existing integer columns are kept for backward compatibility with the deployed
-- shop RPC contract. 2,000,000,000 acts as an unreachable sentinel; UI no
-- longer presents it as a gameplay limit.
update public.shop_item_definitions
set annual_purchase_limit = 2000000000,
    annual_use_limit = 2000000000,
    updated_at = now();

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
values (
  'generational-scout-candidate',
  '天才候補生追加',
  '天才ランクの新入生スカウト候補を1名追加します。',
  0,
  2000000000,
  2000000000,
  'generational-scout-candidate',
  true,
  15
)
on conflict (item_id) do update
set display_name = excluded.display_name,
    description = excluded.description,
    annual_purchase_limit = excluded.annual_purchase_limit,
    annual_use_limit = excluded.annual_use_limit,
    effect_type = excluded.effect_type,
    enabled = excluded.enabled,
    sort_order = excluded.sort_order,
    updated_at = now();
