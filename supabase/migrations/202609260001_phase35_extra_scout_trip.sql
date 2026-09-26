insert into public.shop_item_definitions (
  item_id, display_name, description, price_yen, annual_purchase_limit,
  annual_use_limit, effect_type, enabled, sort_order
)
values (
  'extra-scout-trip',
  '追加スカウト権',
  '通常3回を使い切った後、追加で1回スカウト探索できます。',
  0, 2000000000, 2000000000, 'extra-scout-trip', true, 5
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
