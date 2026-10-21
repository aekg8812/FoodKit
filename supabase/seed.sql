-- ============================================================
-- SEED: FoodKit ローカル開発用テストデータ
-- supabase db reset 時にマイグレーション完了後に適用される
-- ============================================================

-- ----------------------------------------------------------------
-- 1. 開発ユーザー（V1互換シナリオ用）
--    auth.users への INSERT で handle_new_user トリガーが発火し
--    public.users と user_value_profiles が自動作成される
-- ----------------------------------------------------------------
insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'miai@foodkit.dev',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"name":"江藤美愛"}'::jsonb,
    false, 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'hibiki@foodkit.dev',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"name":"河野響"}'::jsonb,
    false, 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'shuntaro@foodkit.dev',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"name":"河田俊太朗"}'::jsonb,
    false, 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'cost@foodkit.dev',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"name":"山田太郎"}'::jsonb,
    false, 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''
  );

-- onboarding 完了（name はトリガーで raw_user_meta_data から設定済み）
update public.users
  set onboarding_completed = true
  where id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444'
  );

-- ----------------------------------------------------------------
-- 1b. QA テストユーザー（LOCAL QA 専用 — production には絶対に含めないこと）
--     固定UUID により supabase db reset --local 後も同じIDでログイン可能。
--     npm run qa:reset を実行すると preference cards / reviews / group / follows
--     も追加されフル QA フィクスチャになる。
-- ----------------------------------------------------------------
insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  phone_change,
  phone_change_token,
  reauthentication_token
)
values
  (
    'cccccccc-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'test1@foodkit.local',
    crypt('FoodKitTest123!', gen_salt('bf')),
    now(), now(), now(),
    '{"name":"テストユーザー1","username":"test1"}'::jsonb,
    false, 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''
  ),
  (
    'cccccccc-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'test2@foodkit.local',
    crypt('FoodKitTest123!', gen_salt('bf')),
    now(), now(), now(),
    '{"name":"テストユーザー2","username":"test2"}'::jsonb,
    false, 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''
  ),
  (
    'cccccccc-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'test3@foodkit.local',
    crypt('FoodKitTest123!', gen_salt('bf')),
    now(), now(), now(),
    '{"name":"テストユーザー3","username":"test3"}'::jsonb,
    false, 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''
  ),
  (
    'cccccccc-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'outsider@foodkit.local',
    crypt('FoodKitTest123!', gen_salt('bf')),
    now(), now(), now(),
    '{"name":"アウトサイダー","username":"outsider"}'::jsonb,
    false, 'authenticated', 'authenticated', '', '', '', '', '', '', '', ''
  );

-- QA ユーザーのオンボーディングを完了（outsider は未完了のまま — 意図的）
update public.users
  set onboarding_completed = true
  where id in (
    'cccccccc-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000002',
    'cccccccc-0000-0000-0000-000000000003'
  );

-- バリュータイプ設定
update public.user_value_profiles
  set main_value_type = 'taste'
  where user_id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222'
  );

update public.user_value_profiles
  set main_value_type = 'hospitality'
  where user_id = '33333333-3333-3333-3333-333333333333';

update public.user_value_profiles
  set main_value_type = 'cost'
  where user_id = '44444444-4444-4444-4444-444444444444';

-- ----------------------------------------------------------------
-- 2. グループ「カップル」
-- ----------------------------------------------------------------
insert into public.groups (id, name, invite_code, created_by)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'カップル',
  'COUPLE01',
  '11111111-1111-1111-1111-111111111111'
);

-- V1は全員対等な member
insert into public.group_members (group_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member');

-- ----------------------------------------------------------------
-- 3. 店舗A / B / C（登録者: 江藤美愛）
-- ----------------------------------------------------------------
insert into public.restaurants (id, name, area, genre, created_by, source)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '東京食堂',    '渋谷',  '和食',   '11111111-1111-1111-1111-111111111111', 'manual'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '麺屋 はるか', '新宿',  'ラーメン', '11111111-1111-1111-1111-111111111111', 'manual'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'カフェ キャンバス', '表参道', 'カフェ', '11111111-1111-1111-1111-111111111111', 'manual');

-- ----------------------------------------------------------------
-- 4. restaurant_accesses
--    各店舗につき: private 行（江藤美愛）+ group 行（カップル）
--    group 行がないと同グループメンバーの can_view_review が機能しないため両方必須
-- ----------------------------------------------------------------
insert into public.restaurant_accesses (restaurant_id, visibility, user_id, group_id, created_by)
values
  -- 店舗A
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'private', '11111111-1111-1111-1111-111111111111', null,                                   '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'group',   null,                                   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
  -- 店舗B
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'private', '11111111-1111-1111-1111-111111111111', null,                                   '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'group',   null,                                   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
  -- 店舗C
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'private', '11111111-1111-1111-1111-111111111111', null,                                   '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'group',   null,                                   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111');

-- ----------------------------------------------------------------
-- 5. レビュー（visibility='private', group_id=null）
--    江藤美愛・河野響（味重視）、河田俊太朗（接客重視）
--    タイプ別フィルタの動作確認に使えるよう意図的に分布に差をつける
-- ----------------------------------------------------------------
insert into public.reviews (restaurant_id, user_id, group_id, rating, comment, visibility)
values
  -- 店舗A（東京食堂）
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '11111111-1111-1111-1111-111111111111', null, 4, '落ち着いた雰囲気で味も最高。また行きたい', 'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '22222222-2222-2222-2222-222222222222', null, 3, '美味しいが量が少し少なめ',               'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '33333333-3333-3333-3333-333333333333', null, 4, '店員さんの対応がとても丁寧で居心地よかった', 'private'),
  -- 店舗B（麺屋 はるか）
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '11111111-1111-1111-1111-111111111111', null, 3, 'スープが濃厚で好みだが、麺が少し柔らかい', 'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '22222222-2222-2222-2222-222222222222', null, 4, 'ここのラーメンは格別。スープが絶品',       'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '33333333-3333-3333-3333-333333333333', null, 2, '接客が少し雑で残念。料理は普通',           'private'),
  -- 店舗C（カフェ キャンバス）
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', '11111111-1111-1111-1111-111111111111', null, 4, '内装がおしゃれで長居できる。コーヒーも美味しい', 'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', '22222222-2222-2222-2222-222222222222', null, 3, 'コーヒーは普通だが雰囲気がいい',           'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', '33333333-3333-3333-3333-333333333333', null, 3, '接客は普通、静かで落ち着ける',             'private');

-- ----------------------------------------------------------------
-- 6. follows
--    江藤美愛 ↔ 山田太郎: 相互フォロー
--    河野響 → 山田太郎: 片方向フォロー
-- ----------------------------------------------------------------
insert into public.follows (follower_id, followee_id, status)
values
  ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'accepted'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'accepted'),
  ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'accepted');

-- ================================================================
-- Dev Fixture（LOCAL QA 専用 — production には絶対に含めないこと）
-- test1/test2/test3 の開発・動作確認用データ。
-- supabase db reset --local だけで即ログイン可能・各種機能が確認できる状態になる。
-- より詳細なQAフィクスチャが必要な場合は npm run qa:reset を実行。
-- ================================================================
do $$
declare
  -- QA user IDs（seed.sql section 1b の固定UUID と一致）
  v_t1       uuid := 'cccccccc-0000-0000-0000-000000000001'; -- test1
  v_t2       uuid := 'cccccccc-0000-0000-0000-000000000002'; -- test2
  v_t3       uuid := 'cccccccc-0000-0000-0000-000000000003'; -- test3

  -- Restaurant IDs（migration で gen_random_uuid() のため名前引き）
  v_sukiya   uuid;
  v_chuka    uuid;
  v_kachan   uuid;
  v_cafe     uuid;
  v_katsudon uuid;
  v_ramen    uuid;
  v_taiwan   uuid;

  -- review IDs（signals + marker 挿入のため RETURNING で取得）
  v_r1 uuid; v_r2 uuid; v_r3 uuid; v_r4 uuid; v_r5 uuid;

  -- group ID
  v_group_id uuid;
begin
  -- レストランID解決
  select id into v_sukiya   from public.restaurants where name = 'すき家 飯塚市役所前店';
  select id into v_chuka    from public.restaurants where name = '中華料理 鴻福家';
  select id into v_kachan   from public.restaurants where name = 'かっちゃんラーメン';
  select id into v_cafe     from public.restaurants where name = 'Cafe ROCCO';
  select id into v_katsudon from public.restaurants where name = 'かつ丼 豚ジロー';
  select id into v_ramen    from public.restaurants where name = 'ラーメン 柳麺亭';
  select id into v_taiwan   from public.restaurants where name = '台湾料理 聚豊園';

  -- ── 好みカード ──────────────────────────────────────────────────────
  -- test1: フレンド向き・コスパ重視（Jaccard similarity test2/test3と ≥0.40）
  insert into public.user_preference_cards (user_id, preference_card_id)
  select v_t1, id from public.preference_cards
  where key in ('cost_conscious','local_discovery','hearty_meal','good_reputation','lively_atmosphere','friends_friendly')
  on conflict do nothing;

  -- test2: ソロ向き（test1と intersection=5/7≈0.71）
  insert into public.user_preference_cards (user_id, preference_card_id)
  select v_t2, id from public.preference_cards
  where key in ('cost_conscious','local_discovery','hearty_meal','good_reputation','lively_atmosphere','solo_friendly')
  on conflict do nothing;

  -- test3: 静かな雰囲気重視（test1と intersection=4/8=0.50）
  insert into public.user_preference_cards (user_id, preference_card_id)
  select v_t3, id from public.preference_cards
  where key in ('cost_conscious','local_discovery','hearty_meal','lively_atmosphere','quiet_atmosphere','taste_focused')
  on conflict do nothing;

  -- ── Restaurant accesses（test1: 5店舗 private）──────────────────────
  insert into public.restaurant_accesses (restaurant_id, visibility, user_id, created_by)
  values
    (v_sukiya,   'private', v_t1, v_t1),
    (v_chuka,    'private', v_t1, v_t1),
    (v_kachan,   'private', v_t1, v_t1),
    (v_cafe,     'private', v_t1, v_t1),
    (v_katsudon, 'private', v_t1, v_t1);

  -- ── test1 のレビュー（V3 signals 付き）────────────────────────────────

  -- Review 1: すき家 rating 4 — 「特に良かったポイントは？」表示テスト用
  insert into public.reviews (restaurant_id, user_id, group_id, rating, comment, visibility, visit_date)
  values (v_sukiya, v_t1, null, 4, 'コスパ最高！また来たい。ランチにぴったり', 'private', '2026-10-01')
  returning id into v_r1;
  insert into public.review_reason_tags (review_id, reason_key)
    values (v_r1, 'taste'), (v_r1, 'value');
  insert into public.review_restaurant_labels (review_id, label_key)
    values (v_r1, 'friends'), (v_r1, 'lively');

  -- Review 2: 中華料理 鴻福家 rating 2 — 「合わなかったポイントは？」表示テスト用
  insert into public.reviews (restaurant_id, user_id, group_id, rating, comment, visibility, visit_date)
  values (v_chuka, v_t1, null, 2, '雰囲気は良いが少し割高。量も少なめ', 'private', '2026-09-20')
  returning id into v_r2;
  insert into public.review_reason_tags (review_id, reason_key)
    values (v_r2, 'value'), (v_r2, 'access');
  insert into public.review_restaurant_labels (review_id, label_key)
    values (v_r2, 'solo'), (v_r2, 'quick');

  -- Review 3: かっちゃんラーメン rating 3 — 中間評価テスト用
  insert into public.reviews (restaurant_id, user_id, group_id, rating, comment, visibility, visit_date)
  values (v_kachan, v_t1, null, 3, 'スープが濃厚で好み。次も行きたい', 'private', '2026-09-15')
  returning id into v_r3;
  insert into public.review_reason_tags (review_id, reason_key)
    values (v_r3, 'taste');
  insert into public.review_restaurant_labels (review_id, label_key)
    values (v_r3, 'casual'), (v_r3, 'hearty');

  -- Review 4: Cafe ROCCO rating 4 — 雰囲気系 signals テスト用
  insert into public.reviews (restaurant_id, user_id, group_id, rating, comment, visibility, visit_date)
  values (v_cafe, v_t1, null, 4, '雰囲気が素晴らしく、接客も丁寧', 'private', '2026-09-05')
  returning id into v_r4;
  insert into public.review_reason_tags (review_id, reason_key)
    values (v_r4, 'atmosphere'), (v_r4, 'service');
  insert into public.review_restaurant_labels (review_id, label_key)
    values (v_r4, 'date'), (v_r4, 'calm');

  -- Completion markers for reviews 1-4 (eligible+labels fixtures)
  insert into public.review_learning_signal_state (review_id, schema_version)
  values (v_r1, 1), (v_r2, 1), (v_r3, 1), (v_r4, 1);

  -- Review 5: かつ丼 豚ジロー rating 3 — eligible+0-labels fixture
  --   Has completion marker but no labels/reason_tags.
  --   Verifies 0-label reviews count in eligible_review_count denominator.
  insert into public.reviews (restaurant_id, user_id, group_id, rating, comment, visibility, visit_date)
  values (v_katsudon, v_t1, null, 3, 'コスパ良し。ボリューム満点', 'private', '2026-08-30')
  returning id into v_r5;
  insert into public.review_learning_signal_state (review_id, schema_version)
  values (v_r5, 1);

  -- ── test2 / test3 のレビュー（similarity 表示確認用）──────────────────

  insert into public.restaurant_accesses (restaurant_id, visibility, user_id, created_by)
  values
    (v_sukiya,   'private', v_t2, v_t2),
    (v_katsudon, 'private', v_t2, v_t2),
    (v_kachan,   'private', v_t3, v_t3),
    (v_ramen,    'private', v_t3, v_t3);

  insert into public.reviews (restaurant_id, user_id, group_id, rating, comment, visibility, visit_date)
  values
    (v_sukiya,   v_t2, null, 4, 'QA: test2 review A', 'private', '2026-10-01'),
    (v_katsudon, v_t2, null, 3, 'QA: test2 review B', 'private', '2026-09-28'),
    (v_kachan,   v_t3, null, 4, 'QA: test3 review A', 'private', '2026-10-01'),
    (v_ramen,    v_t3, null, 3, 'QA: test3 review B', 'private', '2026-09-25');

  -- ── Follows ──────────────────────────────────────────────────────────
  -- test1→test2, test1→test3（フォロー中表示）
  -- test2→test1（test1にフォロワーが1人いる状態）
  insert into public.follows (follower_id, followee_id, status)
  values
    (v_t1, v_t2, 'accepted'),
    (v_t1, v_t3, 'accepted'),
    (v_t2, v_t1, 'accepted')
  on conflict on constraint follows_unique do nothing;

  -- ── QA Group A（グループ機能確認用）──────────────────────────────────
  insert into public.groups (name, invite_code, created_by)
  values ('QA Group A', 'QA-INVITE-2026', v_t1)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_t1, 'owner'), (v_group_id, v_t2, 'member');

  -- グループ用レストランアクセス（台湾料理 聚豊園）
  insert into public.restaurant_accesses (restaurant_id, group_id, visibility, created_by)
  values (v_taiwan, v_group_id, 'group', v_t1);

end $$;
