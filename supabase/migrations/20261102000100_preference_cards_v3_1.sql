-- V3.1-A Step 2: Expand preference_cards from 10 to 18
--
-- 1. Update existing 10 cards: label, description, sort_order
--    (id and key are NOT changed — preserves all user_preference_cards data)
-- 2. Insert 8 new cards (is_active = true)
--
-- sort_order mapping (final, 1-18):
--   1  cost_conscious    (Cat 1)
--   2  taste_focused     (Cat 1)
--   3  good_service      (Cat 1, NEW)
--   4  easy_access       (Cat 1, NEW)
--   5  quiet_atmosphere  (Cat 2)
--   6  lively_atmosphere (Cat 2)
--   7  stylish_space     (Cat 2, NEW)
--   8  casual_vibe       (Cat 2, NEW)
--   9  hearty_meal       (Cat 3)
--  10  quick_service     (Cat 3)
--  11  long_stay_ok      (Cat 3, NEW)
--  12  photogenic_food   (Cat 3, NEW)
--  13  solo_friendly     (Cat 4)
--  14  friends_friendly  (Cat 4)
--  15  date_friendly     (Cat 4, NEW)
--  16  large_group_ok    (Cat 4, NEW)
--  17  local_discovery   (Cat 4)
--  18  good_reputation   (Cat 4)

-- ── Update existing 10 cards ──────────────────────────────────────────────────

UPDATE public.preference_cards SET
  label       = 'コスパよく食べたい',
  description = '手頃な価格で満足できる店がいい',
  sort_order  = 1
WHERE key = 'cost_conscious';

UPDATE public.preference_cards SET
  label       = '味にはこだわりたい',
  description = '多少高くても、おいしさを優先したい',
  sort_order  = 2
WHERE key = 'taste_focused';

UPDATE public.preference_cards SET
  label       = '静かな店が好き',
  description = '落ち着いた空間で食事を楽しみたい',
  sort_order  = 5
WHERE key = 'quiet_atmosphere';

UPDATE public.preference_cards SET
  label       = 'にぎやかな店が好き',
  description = '活気のある雰囲気を楽しみたい',
  sort_order  = 6
WHERE key = 'lively_atmosphere';

UPDATE public.preference_cards SET
  label       = '量もしっかりほしい',
  description = 'お腹いっぱい食べられる店が好き',
  sort_order  = 9
WHERE key = 'hearty_meal';

UPDATE public.preference_cards SET
  label       = '提供が早いとうれしい',
  description = '注文後の待ち時間は短めがいい',
  sort_order  = 10
WHERE key = 'quick_service';

UPDATE public.preference_cards SET
  label       = '1人でも入りやすい',
  description = 'ひとりでも気兼ねなく利用したい',
  sort_order  = 13
WHERE key = 'solo_friendly';

UPDATE public.preference_cards SET
  label       = '友達と行きやすい',
  description = '友達と集まって食事を楽しみたい',
  sort_order  = 14
WHERE key = 'friends_friendly';

UPDATE public.preference_cards SET
  label       = '新しいお店を開拓したい',
  description = '行ったことのない店も試したい',
  sort_order  = 17
WHERE key = 'local_discovery';

UPDATE public.preference_cards SET
  label       = '口コミを見て決めたい',
  description = '評判を確認してから選びたい',
  sort_order  = 18
WHERE key = 'good_reputation';

-- ── Insert 8 new cards ────────────────────────────────────────────────────────

INSERT INTO public.preference_cards (key, label, description, sort_order, image_path, is_active) VALUES
  ('good_service',    '接客のよさも大切にしたい', '店員さんの対応や気配りを重視',         3,  NULL, true),
  ('easy_access',     'アクセスのよさも大切',     '移動が楽で、行きやすいお店がいい',     4,  NULL, true),
  ('stylish_space',   'おしゃれな空間が好き',     '内装やインテリアにもこだわりたい',     7,  NULL, true),
  ('casual_vibe',     '気取らない店が好き',       '肩ひじ張らずに過ごせるお店',           8,  NULL, true),
  ('long_stay_ok',    'ゆっくり長居したい',       '食後も時間を気にせず過ごしたい',       11, NULL, true),
  ('photogenic_food', '写真映えする料理が好き',   '盛り付けや見た目も楽しみたい',         12, NULL, true),
  ('date_friendly',   'デートでも使いたい',       '2人で特別な時間を過ごしたい',          15, NULL, true),
  ('large_group_ok',  '大人数で集まれる店がいい', 'サークルや打ち上げに使いやすい店',     16, NULL, true);
