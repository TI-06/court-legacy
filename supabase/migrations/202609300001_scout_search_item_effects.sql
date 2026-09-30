-- Align candidate-adding shop items with the search-based scouting flow.
update public.shop_item_definitions
set description = '次回のスカウト検索結果に新入生候補を1名追加します。',
    updated_at = now()
where item_id = 'extra-scout-candidate';

update public.shop_item_definitions
set description = '次回のスカウト検索結果に天才ランクの候補を1名確定で追加します。',
    updated_at = now()
where item_id = 'generational-scout-candidate';
