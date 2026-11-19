-- ============================================================
-- Phase A-3: upsert_visit / delete_visit / create_google_restaurant_review 拡張
-- ============================================================
-- 新規来店の保存・編集・削除を reviews と完全に同期する。
-- reviews は 1ユーザー1店舗の代表評価として維持される。
-- 学習・推薦・Match は引き続き reviews を参照する。
--
-- 代表来店の決定順序: visit_date DESC NULLS LAST, created_at DESC, id DESC
-- ============================================================

-- ----------------------------------------------------------------
-- 共通: タグ正規化・バリデーション用ヘルパー関数
-- ----------------------------------------------------------------
-- upsert_visit と create_google_restaurant_review で同じロジックを使う。
-- PL/pgSQL では関数内で DECLARE したローカル関数は使えないため、
-- 重複コードは各関数に直接記述する。

-- ================================================================
-- 1. upsert_visit  (authenticated 向け)
-- ================================================================

CREATE OR REPLACE FUNCTION public.upsert_visit(
  p_restaurant_id          uuid,            -- 必須
  p_rating                 integer,         -- 必須 (1–4)
  p_visit_date             date,            -- 必須（新規・編集ともに日付を明示する）
  p_visit_id               uuid    DEFAULT NULL,   -- NULL = 新規, 非NULL = 編集
  p_comment                text    DEFAULT NULL,
  p_image_path             text    DEFAULT NULL,
  p_reason_keys            text[]  DEFAULT '{}',
  p_label_keys             text[]  DEFAULT '{}',
  p_client_idempotency_key uuid    DEFAULT NULL    -- 新規来店では必須
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid           uuid    := auth.uid();
  _visit_id      uuid;
  _rep_visit     record;
  _review_id     uuid;
  _valid_reasons CONSTANT text[] :=
    ARRAY['taste','value','atmosphere','service','volume','access'];
  _valid_labels  text[];
  _rk            text;
  _lk            text;
  _deduped_rk    text[];
  _deduped_lk    text[];
BEGIN

  -- ── 認証確認 ──────────────────────────────────────────────
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- ── 入力バリデーション ───────────────────────────────────
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_restaurant_id';
  END IF;

  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'invalid_rating: must be 1..4';
  END IF;

  IF p_visit_date IS NULL THEN
    RAISE EXCEPTION 'visit_date_required';
  END IF;

  IF p_visit_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'visit_date_in_future';
  END IF;

  -- 新規来店では冪等性キーが必須
  IF p_visit_id IS NULL AND p_client_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key_required_for_new_visit';
  END IF;

  -- ── reason_keys 正規化・バリデーション ──────────────────
  IF p_reason_keys IS NOT NULL AND cardinality(p_reason_keys) > 0 THEN
    SELECT array_agg(DISTINCT rk ORDER BY rk) INTO _deduped_rk
    FROM unnest(p_reason_keys) AS rk;
    FOREACH _rk IN ARRAY _deduped_rk LOOP
      IF NOT (_rk = ANY(_valid_reasons)) THEN
        RAISE EXCEPTION 'invalid_reason_key: %', _rk;
      END IF;
    END LOOP;
  ELSE
    _deduped_rk := ARRAY[]::text[];
  END IF;

  -- ── label_keys 正規化・バリデーション ───────────────────
  IF p_label_keys IS NOT NULL AND cardinality(p_label_keys) > 0 THEN
    SELECT array_agg(DISTINCT lk ORDER BY lk) INTO _deduped_lk
    FROM unnest(p_label_keys) AS lk;
    IF cardinality(_deduped_lk) > 3 THEN
      RAISE EXCEPTION 'too_many_labels: maximum 3 allowed';
    END IF;
    SELECT array_agg(key) INTO _valid_labels FROM public.restaurant_labels;
    FOREACH _lk IN ARRAY _deduped_lk LOOP
      IF NOT (_lk = ANY(_valid_labels)) THEN
        RAISE EXCEPTION 'invalid_label_key: %', _lk;
      END IF;
    END LOOP;
  ELSE
    _deduped_lk := ARRAY[]::text[];
  END IF;

  -- ── 同一 (user, restaurant) の同時実行を直列化 ───────────
  -- pg_advisory_xact_lock: トランザクション終了時に自動解放
  -- hashtext() は int4 を返す。衝突しても不必要な待機のみで、データ不整合は発生しない。
  PERFORM pg_advisory_xact_lock(
    hashtext(_uid::text),
    hashtext(p_restaurant_id::text)
  );

  -- ── 店舗アクセス確認 ─────────────────────────────────────
  -- SECURITY DEFINER 内で can_record_restaurant を呼ぶと auth.uid() はセッション変数から
  -- 正しく取得される（JWT claims はトランザクション内で保持される）
  IF NOT can_record_restaurant(p_restaurant_id) THEN
    RAISE EXCEPTION 'restaurant_not_accessible';
  END IF;

  -- ── 新規 or 編集 ──────────────────────────────────────────
  IF p_visit_id IS NULL THEN

    -- 冪等性チェック: 同じキー (user_id, restaurant_id, key) が既にあれば即返す
    SELECT id INTO _visit_id
    FROM public.restaurant_visits
    WHERE client_idempotency_key = p_client_idempotency_key
      AND user_id                = _uid
      AND restaurant_id          = p_restaurant_id;

    IF _visit_id IS NOT NULL THEN
      SELECT id INTO _review_id
      FROM public.reviews
      WHERE user_id = _uid AND restaurant_id = p_restaurant_id;

      RETURN jsonb_build_object(
        'visit_id',          _visit_id,
        'review_id',         _review_id,
        'is_representative', (
          SELECT _visit_id = id
          FROM public.restaurant_visits
          WHERE user_id = _uid AND restaurant_id = p_restaurant_id
          ORDER BY visit_date DESC NULLS LAST, created_at DESC, id DESC
          LIMIT 1
        ),
        'idempotent_replay', true
      );
    END IF;

    -- 新規来店 INSERT
    INSERT INTO public.restaurant_visits (
      user_id, restaurant_id, visit_date, rating, comment, image_path,
      reason_keys, label_keys, client_idempotency_key
    )
    VALUES (
      _uid, p_restaurant_id, p_visit_date, p_rating,
      p_comment, p_image_path, _deduped_rk, _deduped_lk,
      p_client_idempotency_key
    )
    RETURNING id INTO _visit_id;

  ELSE

    -- 編集: user_id と restaurant_id の一致も確認
    UPDATE public.restaurant_visits
    SET
      visit_date  = p_visit_date,
      rating      = p_rating,
      comment     = p_comment,
      image_path  = p_image_path,
      reason_keys = _deduped_rk,
      label_keys  = _deduped_lk
    WHERE id            = p_visit_id
      AND user_id       = _uid
      AND restaurant_id = p_restaurant_id
    RETURNING id INTO _visit_id;

    IF _visit_id IS NULL THEN
      RAISE EXCEPTION 'visit_not_found_or_forbidden';
    END IF;

  END IF;

  -- ── 代表来店の決定（INSERT/UPDATE 後に再評価）─────────────
  SELECT * INTO _rep_visit
  FROM public.restaurant_visits
  WHERE user_id = _uid AND restaurant_id = p_restaurant_id
  ORDER BY visit_date DESC NULLS LAST, created_at DESC, id DESC
  LIMIT 1;

  -- ── reviews へ代表評価を同期 ─────────────────────────────
  INSERT INTO public.reviews (
    restaurant_id, user_id, rating, comment, visit_date, image_path,
    group_id, visibility
  )
  VALUES (
    p_restaurant_id, _uid,
    _rep_visit.rating, _rep_visit.comment, _rep_visit.visit_date, _rep_visit.image_path,
    NULL, 'private'
  )
  ON CONFLICT ON CONSTRAINT reviews_user_restaurant_unique DO UPDATE SET
    rating     = EXCLUDED.rating,
    comment    = EXCLUDED.comment,
    visit_date = EXCLUDED.visit_date,
    image_path = EXCLUDED.image_path
  RETURNING id INTO _review_id;

  -- ── 学習シグナルを代表来店で同期 ─────────────────────────
  DELETE FROM public.review_reason_tags WHERE review_id = _review_id;
  IF cardinality(_rep_visit.reason_keys) > 0 THEN
    INSERT INTO public.review_reason_tags (review_id, reason_key)
    SELECT _review_id, rk FROM unnest(_rep_visit.reason_keys) AS rk;
  END IF;

  DELETE FROM public.review_restaurant_labels WHERE review_id = _review_id;
  IF cardinality(_rep_visit.label_keys) > 0 THEN
    INSERT INTO public.review_restaurant_labels (review_id, label_key)
    SELECT _review_id, lk FROM unnest(_rep_visit.label_keys) AS lk;
  END IF;

  INSERT INTO public.review_learning_signal_state (review_id, schema_version)
  VALUES (_review_id, 1)
  ON CONFLICT (review_id) DO UPDATE SET schema_version = EXCLUDED.schema_version;

  RETURN jsonb_build_object(
    'visit_id',          _visit_id,
    'review_id',         _review_id,
    'is_representative', (_visit_id = _rep_visit.id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_visit(uuid, integer, date, uuid, text, text, text[], text[], uuid)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.upsert_visit(uuid, integer, date, uuid, text, text, text[], text[], uuid)
  TO authenticated;


-- ================================================================
-- 2. delete_visit  (authenticated 向け)
-- ================================================================

CREATE OR REPLACE FUNCTION public.delete_visit(p_visit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid              uuid := auth.uid();
  _visit            record;
  _current_rep_id   uuid;
  _was_representative boolean;
  _new_rep_visit    record;
  _review_id        uuid;
BEGIN

  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_visit_id IS NULL THEN RAISE EXCEPTION 'invalid_visit_id'; END IF;

  -- 対象来店を取得して所有者を確認
  SELECT * INTO _visit
  FROM public.restaurant_visits
  WHERE id = p_visit_id AND user_id = _uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'visit_not_found_or_forbidden';
  END IF;

  -- 同一 (user, restaurant) の操作を直列化
  PERFORM pg_advisory_xact_lock(
    hashtext(_uid::text),
    hashtext(_visit.restaurant_id::text)
  );

  -- 削除前の代表来店を ID で確認（rating/image_path の一致は使わない）
  SELECT id INTO _current_rep_id
  FROM public.restaurant_visits
  WHERE user_id = _uid AND restaurant_id = _visit.restaurant_id
  ORDER BY visit_date DESC NULLS LAST, created_at DESC, id DESC
  LIMIT 1;

  _was_representative := (_current_rep_id = p_visit_id);

  -- 来店を削除
  DELETE FROM public.restaurant_visits WHERE id = p_visit_id;

  -- 削除後の代表来店を再計算
  SELECT * INTO _new_rep_visit
  FROM public.restaurant_visits
  WHERE user_id = _uid AND restaurant_id = _visit.restaurant_id
  ORDER BY visit_date DESC NULLS LAST, created_at DESC, id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- 最後の来店を削除 → reviews を DELETE
    -- notifications・review_reason_tags・review_restaurant_labels・
    -- review_learning_signal_state は ON DELETE CASCADE で連鎖削除される
    DELETE FROM public.reviews
    WHERE user_id = _uid AND restaurant_id = _visit.restaurant_id;

    RETURN jsonb_build_object(
      'deleted',            true,
      'review_deleted',     true,
      'was_representative', _was_representative,
      'deleted_image_path', _visit.image_path
    );
  END IF;

  -- 来店が残っている場合
  SELECT id INTO _review_id
  FROM public.reviews
  WHERE user_id = _uid AND restaurant_id = _visit.restaurant_id;

  -- 代表来店だった場合のみ reviews と学習シグナルを再同期
  IF _was_representative THEN
    UPDATE public.reviews SET
      rating     = _new_rep_visit.rating,
      comment    = _new_rep_visit.comment,
      visit_date = _new_rep_visit.visit_date,
      image_path = _new_rep_visit.image_path
    WHERE id = _review_id;

    DELETE FROM public.review_reason_tags WHERE review_id = _review_id;
    IF cardinality(_new_rep_visit.reason_keys) > 0 THEN
      INSERT INTO public.review_reason_tags (review_id, reason_key)
      SELECT _review_id, rk FROM unnest(_new_rep_visit.reason_keys) AS rk;
    END IF;

    DELETE FROM public.review_restaurant_labels WHERE review_id = _review_id;
    IF cardinality(_new_rep_visit.label_keys) > 0 THEN
      INSERT INTO public.review_restaurant_labels (review_id, label_key)
      SELECT _review_id, lk FROM unnest(_new_rep_visit.label_keys) AS lk;
    END IF;

    INSERT INTO public.review_learning_signal_state (review_id, schema_version)
    VALUES (_review_id, 1)
    ON CONFLICT (review_id) DO UPDATE SET schema_version = EXCLUDED.schema_version;
  END IF;

  RETURN jsonb_build_object(
    'deleted',            true,
    'review_deleted',     false,
    'was_representative', _was_representative,
    'new_rep_visit_id',   _new_rep_visit.id,
    'deleted_image_path', _visit.image_path
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_visit(uuid)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_visit(uuid)
  TO authenticated;


-- ================================================================
-- 3. create_google_restaurant_review 拡張（service_role 専用）
-- ================================================================
-- 旧シグネチャ（8引数）を DROP して新シグネチャ（9引数）で再作成する。
-- これにより旧定義が残る PostgreSQL のオーバーロード問題を防ぐ。
-- 追加: p_client_idempotency_key uuid DEFAULT NULL
-- 追加: restaurant_visits への INSERT と代表来店による reviews 同期

DROP FUNCTION IF EXISTS public.create_google_restaurant_review(
  text, uuid, integer, text, date, text, text[], text[]
);

CREATE OR REPLACE FUNCTION public.create_google_restaurant_review(
  p_external_place_id      text,
  p_user_id                uuid,
  p_rating                 integer,
  p_comment                text    DEFAULT NULL,
  p_visit_date             date    DEFAULT NULL,
  p_image_path             text    DEFAULT NULL,
  p_reason_keys            text[]  DEFAULT NULL,
  p_label_keys             text[]  DEFAULT NULL,
  p_client_idempotency_key uuid    DEFAULT NULL   -- 追加: 二重送信防止
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _restaurant_id   uuid;
  _review_id       uuid;
  _visit_id        uuid;
  _rep_visit       record;
  _valid_reasons   text[] := ARRAY['taste','value','atmosphere','service','volume','access'];
  _rk              text;
  _lk              text;
  _deduped_reasons text[];
  _deduped_labels  text[];
BEGIN

  -- ── 認証確認（service_role 経由のため p_user_id で本人を明示する）
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: p_user_id is required';
  END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'invalid_rating: must be 1..4';
  END IF;
  IF p_external_place_id IS NULL OR trim(p_external_place_id) = '' THEN
    RAISE EXCEPTION 'invalid_place_id';
  END IF;
  IF p_visit_date IS NOT NULL AND p_visit_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'visit_date_in_future';
  END IF;

  -- ── reason_keys 正規化・バリデーション（既存ロジックと同一）
  IF p_reason_keys IS NOT NULL AND array_length(p_reason_keys, 1) > 0 THEN
    SELECT array_agg(DISTINCT rk ORDER BY rk) INTO _deduped_reasons
    FROM unnest(p_reason_keys) AS rk;
    FOREACH _rk IN ARRAY _deduped_reasons LOOP
      IF NOT (_rk = ANY(_valid_reasons)) THEN
        RAISE EXCEPTION 'invalid_reason_key: %', _rk;
      END IF;
    END LOOP;
  ELSE
    _deduped_reasons := ARRAY[]::text[];
  END IF;

  -- ── label_keys 正規化・バリデーション（既存ロジックと同一）
  IF p_label_keys IS NOT NULL AND array_length(p_label_keys, 1) > 0 THEN
    SELECT array_agg(DISTINCT lk ORDER BY lk) INTO _deduped_labels
    FROM unnest(p_label_keys) AS lk;
    IF array_length(_deduped_labels, 1) > 3 THEN
      RAISE EXCEPTION 'too_many_labels: maximum 3 allowed';
    END IF;
    FOREACH _lk IN ARRAY _deduped_labels LOOP
      IF NOT EXISTS (SELECT 1 FROM public.restaurant_labels WHERE key = _lk) THEN
        RAISE EXCEPTION 'invalid_label_key: %', _lk;
      END IF;
    END LOOP;
  ELSE
    _deduped_labels := ARRAY[]::text[];
  END IF;

  -- ── 同一 (user, place_id) の同時実行を直列化
  -- Google Places は restaurant_id が未確定のため place_id を鍵として使う
  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext(p_external_place_id)
  );

  -- ── 冪等性チェック（キーが指定されている場合）
  IF p_client_idempotency_key IS NOT NULL THEN
    SELECT rv.id, rv.restaurant_id INTO _visit_id, _restaurant_id
    FROM public.restaurant_visits rv
    JOIN public.restaurants r ON r.id = rv.restaurant_id
    WHERE rv.user_id                = p_user_id
      AND r.external_place_id       = p_external_place_id
      AND rv.client_idempotency_key = p_client_idempotency_key;

    IF _visit_id IS NOT NULL THEN
      SELECT id INTO _review_id
      FROM public.reviews
      WHERE user_id = p_user_id AND restaurant_id = _restaurant_id;

      RETURN jsonb_build_object(
        'restaurant_id',    _restaurant_id,
        'review_id',        _review_id,
        'visit_id',         _visit_id,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  -- ── 店舗 UUID を解決（既存ロジックと同一）
  SELECT id INTO _restaurant_id
  FROM public.restaurants
  WHERE external_place_id = p_external_place_id
  LIMIT 1;

  IF _restaurant_id IS NULL THEN
    BEGIN
      INSERT INTO public.restaurants (name, source, external_place_id, created_by)
      VALUES (NULL, 'google_place', p_external_place_id, p_user_id)
      RETURNING id INTO _restaurant_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO _restaurant_id
      FROM public.restaurants
      WHERE external_place_id = p_external_place_id
      LIMIT 1;
    END;
  END IF;

  IF _restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant_create_failed';
  END IF;

  -- ── プライベートアクセスを確保（既存ロジックと同一）
  INSERT INTO public.restaurant_accesses (restaurant_id, user_id, visibility, created_by)
  VALUES (_restaurant_id, p_user_id, 'private', p_user_id)
  ON CONFLICT DO NOTHING;

  -- ── 新規来店を restaurant_visits に記録
  INSERT INTO public.restaurant_visits (
    user_id, restaurant_id, visit_date, rating, comment, image_path,
    reason_keys, label_keys, client_idempotency_key
  )
  VALUES (
    p_user_id, _restaurant_id, p_visit_date, p_rating,
    p_comment, p_image_path,
    _deduped_reasons, _deduped_labels,
    p_client_idempotency_key
  )
  RETURNING id INTO _visit_id;

  -- ── 代表来店を決定（同店舗の全来店から再計算）
  SELECT * INTO _rep_visit
  FROM public.restaurant_visits
  WHERE user_id = p_user_id AND restaurant_id = _restaurant_id
  ORDER BY visit_date DESC NULLS LAST, created_at DESC, id DESC
  LIMIT 1;

  -- ── reviews へ代表評価を同期
  INSERT INTO public.reviews (
    restaurant_id, user_id, rating, comment, visit_date, image_path,
    group_id, visibility
  )
  VALUES (
    _restaurant_id, p_user_id,
    _rep_visit.rating, _rep_visit.comment, _rep_visit.visit_date, _rep_visit.image_path,
    NULL, 'private'
  )
  ON CONFLICT ON CONSTRAINT reviews_user_restaurant_unique DO UPDATE SET
    rating     = EXCLUDED.rating,
    comment    = EXCLUDED.comment,
    visit_date = EXCLUDED.visit_date,
    image_path = EXCLUDED.image_path
  RETURNING id INTO _review_id;

  -- ── 学習シグナルを代表来店で同期
  DELETE FROM public.review_reason_tags WHERE review_id = _review_id;
  IF array_length(_rep_visit.reason_keys, 1) > 0 THEN
    INSERT INTO public.review_reason_tags (review_id, reason_key)
    SELECT _review_id, rk FROM unnest(_rep_visit.reason_keys) AS rk;
  END IF;

  DELETE FROM public.review_restaurant_labels WHERE review_id = _review_id;
  IF array_length(_rep_visit.label_keys, 1) > 0 THEN
    INSERT INTO public.review_restaurant_labels (review_id, label_key)
    SELECT _review_id, lk FROM unnest(_rep_visit.label_keys) AS lk;
  END IF;

  INSERT INTO public.review_learning_signal_state (review_id, schema_version)
  VALUES (_review_id, 1)
  ON CONFLICT (review_id) DO UPDATE SET schema_version = EXCLUDED.schema_version;

  RETURN jsonb_build_object(
    'restaurant_id', _restaurant_id,
    'review_id',     _review_id,
    'visit_id',      _visit_id
  );
END;
$$;

-- service_role 専用（server action からのみ呼び出す）
REVOKE ALL ON FUNCTION public.create_google_restaurant_review(
  text, uuid, integer, text, date, text, text[], text[], uuid
) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_google_restaurant_review(
  text, uuid, integer, text, date, text, text[], text[], uuid
) TO service_role;
