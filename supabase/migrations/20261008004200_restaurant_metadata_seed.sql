-- Restaurant metadata: human-verified data entry 2026-10-08
-- Source: ChatGPT web research (Tabelog / Yahoo Maps / official sites / Chikuski)
--
-- All lookups use restaurant name (unique in the seeded set) to avoid
-- hardcoding UUIDs that change after supabase db reset --local.
--
-- Rules applied:
--   TEST_ONLY (東京食堂/麺屋 はるか/カフェ キャンバス): skipped
--   VERIFY_IDENTITY (ふくろう): all fields NULL, no update
--   VERIFY_FIRST (プチベーカリー カプリス): walk_in_available only; hours skipped
--   PARTIAL rows: non-NULL fields only, no hours where hours=NULL
--   NULL values not inferred or fabricated
--   business_hours_known set only for restaurants that receive hours rows

-- =============================================================
-- PART 1: UPDATE restaurants (scalar + array metadata)
-- =============================================================

UPDATE public.restaurants SET
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['lively','relaxed'],
  meal_period_tags          = ARRAY['lunch','dinner'],
  parking_available         = true
WHERE name = '台湾料理 聚豊園';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 2000,
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true
WHERE name = 'BLANKET DONUTS 飯塚店';

UPDATE public.restaurants SET
  party_size_tags   = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags   = ARRAY['casual','lively'],
  walk_in_available = true,
  parking_available = true,
  meal_period_tags  = ARRAY['lunch','dinner']
WHERE name = 'はま寿司 飯塚川津店';

UPDATE public.restaurants SET
  atmosphere_tags   = ARRAY['casual'],
  walk_in_available = true,
  parking_available = true
WHERE name = 'パン工房 Encore du Pain';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 3000,
  party_size_tags           = ARRAY['pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['relaxed'],
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '和風レストラン ニューいいづか';

UPDATE public.restaurants SET
  party_size_tags  = ARRAY['pair','small_group'],
  atmosphere_tags  = ARRAY['relaxed'],
  meal_period_tags = ARRAY['dinner']
WHERE name = '地鶏炭火焼 やまと';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['pair','small_group'],
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '本場インド料理 ルパ 飯塚店';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 2000,
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '横浜家系ラーメン 麺一家';

UPDATE public.restaurants SET
  walk_in_available = true,
  parking_available = true
WHERE name = '焼き立てパン TAM-TAM';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['solo','pair','small_group'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '華さん食堂 飯塚店';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['solo','pair','small_group'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '麺和田や 飯塚店';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['casual','relaxed'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'Cafe ROCCO';

UPDATE public.restaurants SET
  party_size_tags   = ARRAY['solo','pair','small_group'],
  atmosphere_tags   = ARRAY['relaxed'],
  walk_in_available = true,
  parking_available = true,
  meal_period_tags  = ARRAY['lunch']
WHERE name = 'COFFEE HOUSE BLOSSOM';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['lively','casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'ジョイフル 飯塚目尾店';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['solo','pair','small_group'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'ラーメン 柳麺亭';

UPDATE public.restaurants SET
  lat                       = 33.6647448,
  lng                       = 130.6858959,
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['casual','relaxed'],
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '中華料理 鴻福家';

UPDATE public.restaurants SET
  lat                       = 33.6664319,
  lng                       = 130.6886547,
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['solo','pair','small_group'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '太一商店 飯塚店';

UPDATE public.restaurants SET
  lat                       = 33.6457408,
  lng                       = 130.7164642,
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'ジョイフル 飯塚店';

UPDATE public.restaurants SET
  lat                       = 33.6457555,
  lng                       = 130.7167868,
  budget_per_person_max_yen = 2000,
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'ピザハット 飯塚近大前店';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 3000,
  party_size_tags           = ARRAY['pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['lively','casual'],
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '星空シネマ×スクリーンBBQ飯塚';

UPDATE public.restaurants SET
  party_size_tags   = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags   = ARRAY['relaxed'],
  walk_in_available = true,
  meal_period_tags  = ARRAY['lunch','dinner']
WHERE name = '炭火焼食堂いしかわ屋';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['solo','pair','small_group'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '石田一龍 飯塚店';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['pair','small_group'],
  atmosphere_tags           = ARRAY['relaxed'],
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'UN GIORNO CAFE';

UPDATE public.restaurants SET
  party_size_tags   = ARRAY['solo','pair','small_group'],
  atmosphere_tags   = ARRAY['relaxed'],
  walk_in_available = true,
  parking_available = true,
  meal_period_tags  = ARRAY['lunch','dinner']
WHERE name = 'かやの森cafe';

UPDATE public.restaurants SET
  lat                       = 33.6435457,
  lng                       = 130.7066681,
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['lively','casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'ココス 飯塚柏の森店';

UPDATE public.restaurants SET
  lat                       = 33.6448589,
  lng                       = 130.6902752,
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['solo','pair','small_group'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'すき家 飯塚市役所前店';

UPDATE public.restaurants SET
  lat                       = 33.644268857022,
  lng                       = 130.70820573759,
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['lively','casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'スシロー 飯塚柏の森店';

UPDATE public.restaurants SET
  lat                       = 33.64476006,
  lng                       = 130.6924296,
  budget_per_person_max_yen = 4000,
  party_size_tags           = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['casual'],
  parking_available         = false,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'のぶりん';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 5500,
  party_size_tags           = ARRAY['pair','small_group'],
  atmosphere_tags           = ARRAY['relaxed'],
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'びすとろ野の花';

UPDATE public.restaurants SET
  lat                       = 33.6276669,
  lng                       = 130.6709013,
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['solo','pair','small_group'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'カレーハウス CoCo壱番屋 飯塚若菜店';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['solo','pair','small_group'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'すき家 200号飯塚嘉穂店';

-- ふくろう (VERIFY_IDENTITY): skipped — all fields NULL

UPDATE public.restaurants SET
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['pair','small_group','large_group'],
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch']
WHERE name = 'ボタ食堂';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 5000,
  party_size_tags           = ARRAY['solo','pair','small_group','large_group'],
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '穂波食堂';

-- あぶりや酒場 まる太 (PARTIAL)
UPDATE public.restaurants SET
  meal_period_tags = ARRAY['dinner']
WHERE name = 'あぶりや酒場 まる太';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['solo','pair'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'かっちゃんラーメン';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['solo','pair'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch']
WHERE name = 'かつ丼 豚ジロー';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 3000,
  party_size_tags           = ARRAY['pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['relaxed'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'ステーキバンバン 牛舎';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['solo','pair'],
  atmosphere_tags           = ARRAY['relaxed'],
  walk_in_available         = true,
  parking_available         = true
WHERE name = 'ちるぷりん';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['solo','pair','small_group'],
  atmosphere_tags           = ARRAY['relaxed'],
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'てんぷら屋 藤';

UPDATE public.restaurants SET
  meal_period_tags = ARRAY['lunch','dinner']
WHERE name = 'ラーメン ふじ庵';

UPDATE public.restaurants SET
  parking_available = true,
  meal_period_tags  = ARRAY['lunch','dinner']
WHERE name = '博多うどん うちだ屋 頴田店';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '味の時計台 飯塚頴田店';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 3000,
  party_size_tags           = ARRAY['pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['lively','casual'],
  parking_available         = true,
  meal_period_tags          = ARRAY['dinner']
WHERE name = '居酒屋 純';

-- Nora (PARTIAL — hours矛盾のためhours=NULL)
UPDATE public.restaurants SET
  budget_per_person_max_yen = 2400,
  party_size_tags           = ARRAY['pair','small_group'],
  atmosphere_tags           = ARRAY['relaxed'],
  parking_available         = false,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'Nora';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 2500,
  party_size_tags           = ARRAY['solo','pair','small_group'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'とんかつびより';

-- プチベーカリー カプリス (VERIFY_FIRST — walk_in_availableのみ、hours矛盾のため未投入)
UPDATE public.restaurants SET
  walk_in_available = true
WHERE name = 'プチベーカリー カプリス';

UPDATE public.restaurants SET
  lat                       = 33.6425307,
  lng                       = 130.6768065,
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['casual','relaxed'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = 'ロイヤルホスト飯塚店';

-- 中華料理 陽山 (不規則休のためhours=NULL)
UPDATE public.restaurants SET
  budget_per_person_max_yen = 2000,
  party_size_tags           = ARRAY['solo','pair','small_group','large_group'],
  atmosphere_tags           = ARRAY['relaxed'],
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '中華料理 陽山';

UPDATE public.restaurants SET
  budget_per_person_max_yen = 1000,
  party_size_tags           = ARRAY['solo','pair','small_group'],
  atmosphere_tags           = ARRAY['casual'],
  walk_in_available         = true,
  parking_available         = true,
  meal_period_tags          = ARRAY['lunch','dinner']
WHERE name = '松屋 飯塚片島店';

-- =============================================================
-- PART 2: INSERT restaurant_business_hours
-- day_of_week: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
-- closes_next_day=true when (+1): closes_at < opens_at in clock terms
-- 24H represented as 00:00-23:59 daily
-- =============================================================

-- 台湾料理 聚豊園: Mon=CLOSED; Tue-Sun: 11:00-15:00, 17:00-23:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, v.c::time, v.n
FROM public.restaurants r
CROSS JOIN (VALUES
  (0,'11:00','15:00',false),(0,'17:00','23:00',false),
  (2,'11:00','15:00',false),(2,'17:00','23:00',false),
  (3,'11:00','15:00',false),(3,'17:00','23:00',false),
  (4,'11:00','15:00',false),(4,'17:00','23:00',false),
  (5,'11:00','15:00',false),(5,'17:00','23:00',false),
  (6,'11:00','15:00',false),(6,'17:00','23:00',false)
) AS v(dow,o,c,n)
WHERE r.name = '台湾料理 聚豊園';

-- BLANKET DONUTS: Tue=CLOSED; Mon,Wed-Sun: 11:00-18:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, v.c::time, v.n
FROM public.restaurants r
CROSS JOIN (VALUES
  (0,'11:00','18:00',false),(1,'11:00','18:00',false),
  (3,'11:00','18:00',false),(4,'11:00','18:00',false),
  (5,'11:00','18:00',false),(6,'11:00','18:00',false)
) AS v(dow,o,c,n)
WHERE r.name = 'BLANKET DONUTS 飯塚店';

-- はま寿司: Daily 10:00-00:00(+1)
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '10:00'::time, '00:00'::time, true
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'はま寿司 飯塚川津店';

-- パン工房 Encore du Pain: Mon=CLOSED; Tue-Sun: 08:00-18:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '08:00'::time, '18:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'パン工房 Encore du Pain';

-- 和風レストラン ニューいいづか: Daily 11:00-22:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '11:00'::time, '22:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = '和風レストラン ニューいいづか';

-- 本場インド料理 ルパ: Tue=CLOSED; Mon,Wed-Sun: 11:00-15:00, 17:00-22:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, v.c::time, v.n
FROM public.restaurants r
CROSS JOIN (VALUES
  (0,'11:00','15:00',false),(0,'17:00','22:00',false),
  (1,'11:00','15:00',false),(1,'17:00','22:00',false),
  (3,'11:00','15:00',false),(3,'17:00','22:00',false),
  (4,'11:00','15:00',false),(4,'17:00','22:00',false),
  (5,'11:00','15:00',false),(5,'17:00','22:00',false),
  (6,'11:00','15:00',false),(6,'17:00','22:00',false)
) AS v(dow,o,c,n)
WHERE r.name = '本場インド料理 ルパ 飯塚店';

-- 横浜家系ラーメン 麺一家: Daily 11:00-00:00(+1)
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '11:00'::time, '00:00'::time, true
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = '横浜家系ラーメン 麺一家';

-- 焼き立てパン TAM-TAM: Mon-Tue=CLOSED; Wed-Sat: 07:30-18:00; Sun: 08:30-18:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, '18:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0,'08:30'),(3,'07:30'),(4,'07:30'),(5,'07:30'),(6,'07:30')) AS v(dow,o)
WHERE r.name = '焼き立てパン TAM-TAM';

-- 華さん食堂: Daily 09:00-22:30
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '09:00'::time, '22:30'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = '華さん食堂 飯塚店';

-- 麺和田や: Mon-Fri: 11:30-15:00, 17:30-21:00; Sat-Sun: 11:00-21:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, v.c::time, v.n
FROM public.restaurants r
CROSS JOIN (VALUES
  (0,'11:00','21:00',false),
  (1,'11:30','15:00',false),(1,'17:30','21:00',false),
  (2,'11:30','15:00',false),(2,'17:30','21:00',false),
  (3,'11:30','15:00',false),(3,'17:30','21:00',false),
  (4,'11:30','15:00',false),(4,'17:30','21:00',false),
  (5,'11:30','15:00',false),(5,'17:30','21:00',false),
  (6,'11:00','21:00',false)
) AS v(dow,o,c,n)
WHERE r.name = '麺和田や 飯塚店';

-- Cafe ROCCO: Mon=CLOSED; Tue-Sun: 11:00-21:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '11:00'::time, '21:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'Cafe ROCCO';

-- COFFEE HOUSE BLOSSOM: Daily 09:00-18:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '09:00'::time, '18:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'COFFEE HOUSE BLOSSOM';

-- ジョイフル 飯塚目尾店: Daily 08:00-01:00(+1)
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '08:00'::time, '01:00'::time, true
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'ジョイフル 飯塚目尾店';

-- 中華料理 鴻福家: Mon=CLOSED; Tue-Sun: 11:00-22:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '11:00'::time, '22:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = '中華料理 鴻福家';

-- 太一商店 飯塚店: Wed=CLOSED; Mon-Tue,Thu-Sun: 10:00-22:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '10:00'::time, '22:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(4),(5),(6)) AS v(dow)
WHERE r.name = '太一商店 飯塚店';

-- ジョイフル 飯塚店: Daily 08:00-02:00(+1)
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '08:00'::time, '02:00'::time, true
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'ジョイフル 飯塚店';

-- ピザハット: Daily 10:45-22:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '10:45'::time, '22:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'ピザハット 飯塚近大前店';

-- 炭火焼食堂いしかわ屋: Tue=CLOSED; Mon,Wed-Sun: 11:00-21:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '11:00'::time, '21:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = '炭火焼食堂いしかわ屋';

-- 石田一龍: Thu=CLOSED; Mon-Wed,Fri-Sun: 11:00-15:00, 18:00-21:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, v.c::time, v.n
FROM public.restaurants r
CROSS JOIN (VALUES
  (0,'11:00','15:00',false),(0,'18:00','21:00',false),
  (1,'11:00','15:00',false),(1,'18:00','21:00',false),
  (2,'11:00','15:00',false),(2,'18:00','21:00',false),
  (3,'11:00','15:00',false),(3,'18:00','21:00',false),
  (5,'11:00','15:00',false),(5,'18:00','21:00',false),
  (6,'11:00','15:00',false),(6,'18:00','21:00',false)
) AS v(dow,o,c,n)
WHERE r.name = '石田一龍 飯塚店';

-- UN GIORNO CAFE: Mon-Thu: 11:30-14:00,18:00-00:00(+1); Fri-Sat: 11:30-14:00,18:00-01:00(+1); Sun: 11:30-14:00,18:00-23:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, v.c::time, v.n
FROM public.restaurants r
CROSS JOIN (VALUES
  (0,'11:30','14:00',false),(0,'18:00','23:00',false),
  (1,'11:30','14:00',false),(1,'18:00','00:00',true),
  (2,'11:30','14:00',false),(2,'18:00','00:00',true),
  (3,'11:30','14:00',false),(3,'18:00','00:00',true),
  (4,'11:30','14:00',false),(4,'18:00','00:00',true),
  (5,'11:30','14:00',false),(5,'18:00','01:00',true),
  (6,'11:30','14:00',false),(6,'18:00','01:00',true)
) AS v(dow,o,c,n)
WHERE r.name = 'UN GIORNO CAFE';

-- かやの森cafe: Tue=CLOSED; Mon,Wed-Sun: 09:00-21:30
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '09:00'::time, '21:30'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'かやの森cafe';

-- ココス 飯塚柏の森店: Daily 10:00-02:00(+1)
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '10:00'::time, '02:00'::time, true
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'ココス 飯塚柏の森店';

-- すき家 飯塚市役所前店: Daily 04:00-03:00(+1)
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '04:00'::time, '03:00'::time, true
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'すき家 飯塚市役所前店';

-- スシロー: Mon-Fri: 11:00-23:00; Sat-Sun: 10:30-23:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, '23:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0,'10:30'),(1,'11:00'),(2,'11:00'),(3,'11:00'),(4,'11:00'),(5,'11:00'),(6,'10:30')) AS v(dow,o)
WHERE r.name = 'スシロー 飯塚柏の森店';

-- びすとろ野の花: Sun=CLOSED; Mon-Sat: 11:30-14:30, 17:30-21:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, v.c::time, v.n
FROM public.restaurants r
CROSS JOIN (VALUES
  (1,'11:30','14:30',false),(1,'17:30','21:00',false),
  (2,'11:30','14:30',false),(2,'17:30','21:00',false),
  (3,'11:30','14:30',false),(3,'17:30','21:00',false),
  (4,'11:30','14:30',false),(4,'17:30','21:00',false),
  (5,'11:30','14:30',false),(5,'17:30','21:00',false),
  (6,'11:30','14:30',false),(6,'17:30','21:00',false)
) AS v(dow,o,c,n)
WHERE r.name = 'びすとろ野の花';

-- カレーハウス CoCo壱番屋 飯塚若菜店: Daily 11:00-23:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '11:00'::time, '23:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'カレーハウス CoCo壱番屋 飯塚若菜店';

-- すき家 200号飯塚嘉穂店: Daily 04:00-03:00(+1)
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '04:00'::time, '03:00'::time, true
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'すき家 200号飯塚嘉穂店';

-- ボタ食堂: Tue=CLOSED; Mon,Wed-Sun: 11:00-14:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '11:00'::time, '14:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'ボタ食堂';

-- 穂波食堂: Tue=CLOSED; Mon,Wed-Sun: 11:00-14:00, 18:00-22:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, v.c::time, v.n
FROM public.restaurants r
CROSS JOIN (VALUES
  (0,'11:00','14:00',false),(0,'18:00','22:00',false),
  (1,'11:00','14:00',false),(1,'18:00','22:00',false),
  (3,'11:00','14:00',false),(3,'18:00','22:00',false),
  (4,'11:00','14:00',false),(4,'18:00','22:00',false),
  (5,'11:00','14:00',false),(5,'18:00','22:00',false),
  (6,'11:00','14:00',false),(6,'18:00','22:00',false)
) AS v(dow,o,c,n)
WHERE r.name = '穂波食堂';

-- かっちゃんラーメン: Mon=CLOSED; Tue-Fri: 10:00-18:30; Sat-Sun: 09:00-18:30
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, '18:30'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0,'09:00'),(2,'10:00'),(3,'10:00'),(4,'10:00'),(5,'10:00'),(6,'09:00')) AS v(dow,o)
WHERE r.name = 'かっちゃんラーメン';

-- かつ丼 豚ジロー: Sun=CLOSED; Mon-Sat: 11:00-16:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '11:00'::time, '16:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'かつ丼 豚ジロー';

-- ステーキバンバン 牛舎: Tue=CLOSED; Mon,Wed-Sun: 11:00-14:00, 17:00-21:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, v.c::time, v.n
FROM public.restaurants r
CROSS JOIN (VALUES
  (0,'11:00','14:00',false),(0,'17:00','21:00',false),
  (1,'11:00','14:00',false),(1,'17:00','21:00',false),
  (3,'11:00','14:00',false),(3,'17:00','21:00',false),
  (4,'11:00','14:00',false),(4,'17:00','21:00',false),
  (5,'11:00','14:00',false),(5,'17:00','21:00',false),
  (6,'11:00','14:00',false),(6,'17:00','21:00',false)
) AS v(dow,o,c,n)
WHERE r.name = 'ステーキバンバン 牛舎';

-- ちるぷりん: Mon=CLOSED; Tue-Sun: 10:00-18:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '10:00'::time, '18:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'ちるぷりん';

-- てんぷら屋 藤: Daily 11:00-14:30, 16:30-20:30
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, v.c::time, v.n
FROM public.restaurants r
CROSS JOIN (VALUES
  (0,'11:00','14:30',false),(0,'16:30','20:30',false),
  (1,'11:00','14:30',false),(1,'16:30','20:30',false),
  (2,'11:00','14:30',false),(2,'16:30','20:30',false),
  (3,'11:00','14:30',false),(3,'16:30','20:30',false),
  (4,'11:00','14:30',false),(4,'16:30','20:30',false),
  (5,'11:00','14:30',false),(5,'16:30','20:30',false),
  (6,'11:00','14:30',false),(6,'16:30','20:30',false)
) AS v(dow,o,c,n)
WHERE r.name = 'てんぷら屋 藤';

-- ラーメン ふじ庵: Wed=CLOSED; Mon-Tue,Thu-Sun: 10:30-21:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '10:30'::time, '21:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(4),(5),(6)) AS v(dow)
WHERE r.name = 'ラーメン ふじ庵';

-- 博多うどん うちだ屋 頴田店: Daily 11:00-21:30
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '11:00'::time, '21:30'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = '博多うどん うちだ屋 頴田店';

-- 味の時計台 飯塚頴田店: Wed=CLOSED; Mon-Tue,Thu-Sun: 11:00-21:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '11:00'::time, '21:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(4),(5),(6)) AS v(dow)
WHERE r.name = '味の時計台 飯塚頴田店';

-- 居酒屋 純: Wed,Sun=CLOSED; Mon-Tue,Thu-Sat: 18:00-23:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '18:00'::time, '23:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (1),(2),(4),(5),(6)) AS v(dow)
WHERE r.name = '居酒屋 純';

-- とんかつびより: Thu,Sun=CLOSED; Mon-Wed,Fri-Sat: 11:00-15:00, 17:00-20:30
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, v.o::time, v.c::time, v.n
FROM public.restaurants r
CROSS JOIN (VALUES
  (1,'11:00','15:00',false),(1,'17:00','20:30',false),
  (2,'11:00','15:00',false),(2,'17:00','20:30',false),
  (3,'11:00','15:00',false),(3,'17:00','20:30',false),
  (5,'11:00','15:00',false),(5,'17:00','20:30',false),
  (6,'11:00','15:00',false),(6,'17:00','20:30',false)
) AS v(dow,o,c,n)
WHERE r.name = 'とんかつびより';

-- ロイヤルホスト飯塚店: Daily 08:00-22:00
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '08:00'::time, '22:00'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = 'ロイヤルホスト飯塚店';

-- 松屋 飯塚片島店: 24H → 00:00-23:59 daily
INSERT INTO public.restaurant_business_hours (restaurant_id, day_of_week, opens_at, closes_at, closes_next_day)
SELECT r.id, v.dow, '00:00'::time, '23:59'::time, false
FROM public.restaurants r
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS v(dow)
WHERE r.name = '松屋 飯塚片島店';

-- =============================================================
-- PART 3: SET business_hours_known = true for restaurants
--         that received restaurant_business_hours rows above.
-- =============================================================

UPDATE public.restaurants SET business_hours_known = true
WHERE name IN (
  '台湾料理 聚豊園',
  'BLANKET DONUTS 飯塚店',
  'はま寿司 飯塚川津店',
  'パン工房 Encore du Pain',
  '和風レストラン ニューいいづか',
  '本場インド料理 ルパ 飯塚店',
  '横浜家系ラーメン 麺一家',
  '焼き立てパン TAM-TAM',
  '華さん食堂 飯塚店',
  '麺和田や 飯塚店',
  'Cafe ROCCO',
  'COFFEE HOUSE BLOSSOM',
  'ジョイフル 飯塚目尾店',
  '中華料理 鴻福家',
  '太一商店 飯塚店',
  'ジョイフル 飯塚店',
  'ピザハット 飯塚近大前店',
  '炭火焼食堂いしかわ屋',
  '石田一龍 飯塚店',
  'UN GIORNO CAFE',
  'かやの森cafe',
  'ココス 飯塚柏の森店',
  'すき家 飯塚市役所前店',
  'スシロー 飯塚柏の森店',
  'びすとろ野の花',
  'カレーハウス CoCo壱番屋 飯塚若菜店',
  'すき家 200号飯塚嘉穂店',
  'ボタ食堂',
  '穂波食堂',
  'かっちゃんラーメン',
  'かつ丼 豚ジロー',
  'ステーキバンバン 牛舎',
  'ちるぷりん',
  'てんぷら屋 藤',
  'ラーメン ふじ庵',
  '博多うどん うちだ屋 頴田店',
  '味の時計台 飯塚頴田店',
  '居酒屋 純',
  'とんかつびより',
  'ロイヤルホスト飯塚店',
  '松屋 飯塚片島店'
);
