-- ============================================================
-- SEED: FoodKit ローカル開発用テストデータ
-- supabase db reset 時にマイグレーション完了後に適用される
-- ============================================================

-- ----------------------------------------------------------------
-- 1. テストユーザー
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
  recovery_token
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'miai@foodkit.dev',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"name":"江藤美愛"}'::jsonb,
    false, 'authenticated', 'authenticated', '', ''
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'hibiki@foodkit.dev',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"name":"河野響"}'::jsonb,
    false, 'authenticated', 'authenticated', '', ''
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'shuntaro@foodkit.dev',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"name":"河田俊太朗"}'::jsonb,
    false, 'authenticated', 'authenticated', '', ''
  );

-- onboarding 完了（name はトリガーで raw_user_meta_data から設定済み）
update public.users
  set onboarding_completed = true
  where id in (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
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

-- 江藤美愛が owner、他2名が member
insert into public.group_members (group_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
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
