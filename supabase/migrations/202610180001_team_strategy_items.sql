-- Phase76: three team support items. Existing free-item purchase RPC is unchanged.
-- Test period: unlimited purchase/use frequency, same as every existing item.
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
  ('team-recovery-kit', 'チームケアセット', '全部員の疲労を15軽減・状態を10回復。', 0, 2000000000, 2000000000, 'team-recovery-kit', true, 72),
  ('team-bonding-meeting', 'チームミーティング', '全部員の士気を8・監督への信頼を4上昇。', 0, 2000000000, 2000000000, 'team-bonding-meeting', true, 74),
  ('video-analysis-session', '試合映像研究会', '全部員の判断力を1上げる代わりに疲労+3。', 0, 2000000000, 2000000000, 'video-analysis-session', true, 76)
on conflict (item_id) do update
set display_name = excluded.display_name,
    description = excluded.description,
    annual_purchase_limit = excluded.annual_purchase_limit,
    annual_use_limit = excluded.annual_use_limit,
    effect_type = excluded.effect_type,
    enabled = excluded.enabled,
    sort_order = excluded.sort_order,
    updated_at = now();
