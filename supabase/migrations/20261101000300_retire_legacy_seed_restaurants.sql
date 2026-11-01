-- FIX-011: Retire legacy seed restaurants
--
-- Deletes all 50 pre-Google-Places seed restaurants from migration
-- 20260809000701_seed_restaurants.sql. FoodKit now registers restaurants
-- exclusively via Google Places (create_google_restaurant_review RPC).
--
-- Reviews and all dependent data are intentionally cascade-deleted.
-- Google Places is now the canonical source; there is no migration path
-- for reviews attached to seed restaurants.
--
-- ON DELETE CASCADE automatically removes:
--   restaurants → reviews, restaurant_accesses, restaurant_business_hours
--   reviews     → notifications, review_reason_tags, review_restaurant_labels,
--                 review_learning_signal_state
--
-- Also drops the now-unused restaurants_select_seed RLS policy.
-- The source='seed' branches in RPCs and can_view_restaurant_image become
-- dead code; they will be pruned in a future refactor.
--
-- Safety guards (both must pass or the migration aborts):
--   1. Seed count must equal 50 — confirms DB matches audited state
--   2. All 50 names from the audit list must exist — prevents accidental
--      deletion of future restaurants that happen to have source='seed'
--      if the enum is ever reused
--
-- Storage note: ON DELETE CASCADE removes DB rows only. Any Storage objects
-- under restaurant-images/{restaurant_id}/ become orphaned after deletion.
-- Run a Storage cleanup pass separately if needed.
--
-- After applying on local:
--   seed.sql recreates the 7 QA-fixture restaurants as source='manual'.
--   Run 'npm run qa:reset' to restore QA reviews, accesses, and group data.

DO $$
DECLARE
  v_seed_count   int;
  v_found_count  int;
  v_review_count int;
  v_names text[] := ARRAY[
    'BLANKET DONUTS 飯塚店',
    'Cafe ROCCO',
    'COFFEE HOUSE BLOSSOM',
    'Nora',
    'UN GIORNO CAFE',
    'あぶりや酒場 まる太',
    'かっちゃんラーメン',
    'かつ丼 豚ジロー',
    'かやの森cafe',
    'カレーハウス CoCo壱番屋 飯塚若菜店',
    'ココス 飯塚柏の森店',
    'ジョイフル 飯塚店',
    'ジョイフル 飯塚目尾店',
    'すき家 200号飯塚嘉穂店',
    'すき家 飯塚市役所前店',
    'スシロー 飯塚柏の森店',
    'ステーキバンバン 牛舎',
    'ちるぷりん',
    'てんぷら屋 藤',
    'とんかつびより',
    'のぶりん',
    'はま寿司 飯塚川津店',
    'パン工房 Encore du Pain',
    'ピザハット 飯塚近大前店',
    'びすとろ野の花',
    'ふくろう',
    'プチベーカリー カプリス',
    'ボタ食堂',
    'ラーメン ふじ庵',
    'ラーメン 柳麺亭',
    'ロイヤルホスト飯塚店',
    '中華料理 陽山',
    '中華料理 鴻福家',
    '博多うどん うちだ屋 頴田店',
    '台湾料理 聚豊園',
    '味の時計台 飯塚頴田店',
    '和風レストラン ニューいいづか',
    '地鶏炭火焼 やまと',
    '太一商店 飯塚店',
    '居酒屋 純',
    '星空シネマ×スクリーンBBQ飯塚',
    '本場インド料理 ルパ 飯塚店',
    '松屋 飯塚片島店',
    '横浜家系ラーメン 麺一家',
    '炭火焼食堂いしかわ屋',
    '焼き立てパン TAM-TAM',
    '石田一龍 飯塚店',
    '穂波食堂',
    '華さん食堂 飯塚店',
    '麺和田や 飯塚店'
  ];
BEGIN
  -- Guard 1: total seed count must be exactly 50
  SELECT COUNT(*) INTO v_seed_count
  FROM public.restaurants
  WHERE source = 'seed';

  IF v_seed_count != 50 THEN
    RAISE EXCEPTION
      'FIX-011 abort: expected 50 seed restaurants, found %. '
      'This DB may not match the audited local state. '
      'Verify with: SELECT name FROM restaurants WHERE source = ''seed'' ORDER BY name',
      v_seed_count;
  END IF;

  -- Guard 2: all 50 audited names must be present
  -- Ensures only the specifically audited restaurants are deleted,
  -- not any future restaurants that may incidentally use source='seed'.
  SELECT COUNT(*) INTO v_found_count
  FROM public.restaurants
  WHERE source = 'seed'
    AND name = ANY(v_names);

  IF v_found_count != 50 THEN
    RAISE EXCEPTION
      'FIX-011 abort: audit name list matched % of 50 expected restaurants. '
      'DB name set differs from audited state. Manual review required before proceeding.',
      v_found_count;
  END IF;

  -- Pre-delete report (NOTICE only — does not block deletion)
  SELECT COUNT(*) INTO v_review_count
  FROM public.reviews rv
  JOIN public.restaurants r ON r.id = rv.restaurant_id
  WHERE r.source = 'seed';

  IF v_review_count > 0 THEN
    RAISE NOTICE
      'FIX-011: % review(s) on seed restaurants will be cascade-deleted. '
      'This is expected when applying to a DB with existing data.',
      v_review_count;
  END IF;

  -- Delete seed restaurants (CASCADE removes all dependent rows)
  DELETE FROM public.restaurants WHERE source = 'seed';

  RAISE NOTICE 'FIX-011: deleted 50 legacy seed restaurants and all dependent rows.';
END;
$$;

-- Drop the now-unused policy (safe even if already absent)
DROP POLICY IF EXISTS restaurants_select_seed ON public.restaurants;
