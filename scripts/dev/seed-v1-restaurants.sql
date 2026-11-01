-- V1 dev fixture restaurants — optional local-only script
--
-- Run manually when V1 scenarios (restaurant visibility, group reviews) need
-- test data. Not part of the default db reset flow.
--
-- Requires: local Supabase running, seed.sql already applied (dev users exist).
--
-- Usage:
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f scripts/dev/seed-v1-restaurants.sql
--
-- Idempotent: INSERT ... ON CONFLICT DO NOTHING on fixed IDs.

-- ── 店舗A / B / C（登録者: 江藤美愛）────────────────────────────────────────

insert into public.restaurants (id, name, area, genre, created_by, source)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '東京食堂',       '渋谷',   '和食',    '11111111-1111-1111-1111-111111111111', 'manual'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '麺屋 はるか',    '新宿',   'ラーメン', '11111111-1111-1111-1111-111111111111', 'manual'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'カフェ キャンバス', '表参道', 'カフェ',  '11111111-1111-1111-1111-111111111111', 'manual')
on conflict (id) do nothing;

-- ── restaurant_accesses（private + group 行）────────────────────────────────
-- group 行がないと同グループメンバーの can_view_review が機能しないため両方必須

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
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'group',   null,                                   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111')
on conflict do nothing;

-- ── レビュー（visibility='private', group_id=null）───────────────────────────
-- 江藤美愛・河野響（味重視）、河田俊太朗（接客重視）
-- タイプ別フィルタの動作確認に使えるよう意図的に分布に差をつける

insert into public.reviews (restaurant_id, user_id, group_id, rating, comment, visibility)
values
  -- 店舗A（東京食堂）
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '11111111-1111-1111-1111-111111111111', null, 4, '落ち着いた雰囲気で味も最高。また行きたい',    'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '22222222-2222-2222-2222-222222222222', null, 3, '美味しいが量が少し少なめ',                   'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', '33333333-3333-3333-3333-333333333333', null, 4, '店員さんの対応がとても丁寧で居心地よかった', 'private'),
  -- 店舗B（麺屋 はるか）
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '11111111-1111-1111-1111-111111111111', null, 3, 'スープが濃厚で好みだが、麺が少し柔らかい',   'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '22222222-2222-2222-2222-222222222222', null, 4, 'ここのラーメンは格別。スープが絶品',         'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '33333333-3333-3333-3333-333333333333', null, 2, '接客が少し雑で残念。料理は普通',             'private'),
  -- 店舗C（カフェ キャンバス）
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', '11111111-1111-1111-1111-111111111111', null, 4, '内装がおしゃれで長居できる。コーヒーも美味しい', 'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', '22222222-2222-2222-2222-222222222222', null, 3, 'コーヒーは普通だが雰囲気がいい',             'private'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', '33333333-3333-3333-3333-333333333333', null, 3, '接客は普通、静かで落ち着ける',               'private')
on conflict on constraint reviews_user_restaurant_unique do nothing;
