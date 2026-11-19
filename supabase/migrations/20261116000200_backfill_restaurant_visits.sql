-- ============================================================
-- Phase A-2: 既存 reviews → restaurant_visits バックフィル
-- ============================================================
-- 目的: reviews の全行を restaurant_visits に 1:1 で移行する。
--       reviews テーブル自体は変更しない。
--
-- 冪等性: legacy_review_id UNIQUE 制約 + WHERE NOT EXISTS により
--         再実行しても重複登録されない。
--
-- 原子性: BEGIN/COMMIT で囲み、検証失敗時はトランザクション全体をロールバックする。
-- ============================================================

BEGIN;

-- ----------------------------------------------------------------
-- Step 1: バックフィル INSERT
-- ----------------------------------------------------------------
-- 移行項目: user_id, restaurant_id, visit_date, rating, comment,
--           image_path, reason_keys, label_keys, legacy_review_id,
--           created_at, updated_at
--
-- visit_date NULL は許容（過去に visit_date を記録しなかったレビューが存在する場合）。
-- reason_keys / label_keys: 対応するタグがなければ空配列。
-- created_at / updated_at: reviews の元タイムスタンプを引き継ぐ。

INSERT INTO public.restaurant_visits (
  user_id,
  restaurant_id,
  visit_date,
  rating,
  comment,
  image_path,
  reason_keys,
  label_keys,
  legacy_review_id,
  created_at,
  updated_at
)
SELECT
  r.user_id,
  r.restaurant_id,
  r.visit_date,
  r.rating,
  r.comment,
  r.image_path,
  COALESCE(
    (SELECT array_agg(t.reason_key ORDER BY t.reason_key)
     FROM public.review_reason_tags t
     WHERE t.review_id = r.id),
    ARRAY[]::text[]
  ) AS reason_keys,
  COALESCE(
    (SELECT array_agg(l.label_key ORDER BY l.label_key)
     FROM public.review_restaurant_labels l
     WHERE l.review_id = r.id),
    ARRAY[]::text[]
  ) AS label_keys,
  r.id  AS legacy_review_id,
  r.created_at,
  r.updated_at
FROM public.reviews r
WHERE NOT EXISTS (
  SELECT 1
  FROM public.restaurant_visits rv
  WHERE rv.legacy_review_id = r.id
);

-- ----------------------------------------------------------------
-- Step 2: 件数検証
-- ----------------------------------------------------------------

DO $$
DECLARE
  v_review_count  bigint;
  v_visit_count   bigint;
BEGIN
  SELECT COUNT(*) INTO v_review_count FROM public.reviews;
  SELECT COUNT(*) INTO v_visit_count
  FROM public.restaurant_visits
  WHERE legacy_review_id IS NOT NULL;

  IF v_review_count <> v_visit_count THEN
    RAISE EXCEPTION
      'Backfill count mismatch: reviews=%, migrated_visits=%',
      v_review_count, v_visit_count;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- Step 3: 内容検証（rating / comment / visit_date / image_path）
-- ----------------------------------------------------------------

DO $$
DECLARE
  v_mismatch bigint;
BEGIN
  SELECT COUNT(*) INTO v_mismatch
  FROM public.reviews r
  JOIN public.restaurant_visits rv ON rv.legacy_review_id = r.id
  WHERE r.rating     IS DISTINCT FROM rv.rating
     OR r.comment    IS DISTINCT FROM rv.comment
     OR r.visit_date IS DISTINCT FROM rv.visit_date
     OR r.image_path IS DISTINCT FROM rv.image_path
     OR r.user_id    IS DISTINCT FROM rv.user_id
     OR r.restaurant_id IS DISTINCT FROM rv.restaurant_id;

  IF v_mismatch > 0 THEN
    RAISE EXCEPTION
      'Backfill content mismatch in % row(s): check rating/comment/visit_date/image_path/user_id/restaurant_id',
      v_mismatch;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- Step 4: タグ検証（reason_keys / label_keys）
-- ----------------------------------------------------------------

DO $$
DECLARE
  v_reason_mismatch bigint;
  v_label_mismatch  bigint;
BEGIN
  -- reason_keys: DB のタグと移行済み配列を比較
  SELECT COUNT(*) INTO v_reason_mismatch
  FROM public.reviews r
  JOIN public.restaurant_visits rv ON rv.legacy_review_id = r.id
  WHERE rv.reason_keys IS DISTINCT FROM COALESCE(
    (SELECT array_agg(t.reason_key ORDER BY t.reason_key)
     FROM public.review_reason_tags t WHERE t.review_id = r.id),
    ARRAY[]::text[]
  );

  IF v_reason_mismatch > 0 THEN
    RAISE EXCEPTION
      'reason_keys mismatch in % row(s)', v_reason_mismatch;
  END IF;

  -- label_keys: DB のタグと移行済み配列を比較
  SELECT COUNT(*) INTO v_label_mismatch
  FROM public.reviews r
  JOIN public.restaurant_visits rv ON rv.legacy_review_id = r.id
  WHERE rv.label_keys IS DISTINCT FROM COALESCE(
    (SELECT array_agg(l.label_key ORDER BY l.label_key)
     FROM public.review_restaurant_labels l WHERE l.review_id = r.id),
    ARRAY[]::text[]
  );

  IF v_label_mismatch > 0 THEN
    RAISE EXCEPTION
      'label_keys mismatch in % row(s)', v_label_mismatch;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- Step 5: reviews テーブルが変更されていないことを確認
-- ----------------------------------------------------------------

DO $$
DECLARE
  v_modified bigint;
BEGIN
  -- updated_at が移行時点以降に変更されたレビューがないことを確認
  -- （バックフィルは reviews を更新しないため、マイグレーション開始前から変化なし）
  SELECT COUNT(*) INTO v_modified
  FROM public.reviews r
  JOIN public.restaurant_visits rv ON rv.legacy_review_id = r.id
  WHERE r.updated_at IS DISTINCT FROM rv.updated_at;

  IF v_modified > 0 THEN
    RAISE EXCEPTION
      'reviews.updated_at was modified unexpectedly in % row(s)', v_modified;
  END IF;
END $$;

COMMIT;
