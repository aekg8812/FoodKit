-- ============================================================
-- Phase A-4c: 訪問日の未来判定を Asia/Tokyo (JST) に統一
-- ============================================================
-- 前回修正 (20261117000100) の CURRENT_DATE + 1 は暫定対応だった。
-- FoodKit は日本国内サービスのため、判定基準を明示的に JST に統一する。
--
-- テーブル側の CHECK 制約 (restaurant_visits_no_future_date) は
-- すでに (now() AT TIME ZONE 'Asia/Tokyo')::date を使用しており変更不要。
--
-- 本マイグレーションでは upsert_visit と create_google_restaurant_review の
-- RPC 内日付チェックを同一式に揃える。
-- ============================================================

-- ----------------------------------------------------------------
-- 1. upsert_visit: CURRENT_DATE + 1 → JST 当日 に修正
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_visit(
  p_restaurant_id          uuid,
  p_rating                 integer,
  p_visit_date             date,
  p_visit_id               uuid    DEFAULT NULL,
  p_comment                text    DEFAULT NULL,
  p_image_path             text    DEFAULT NULL,
  p_reason_keys            text[]  DEFAULT '{}',
  p_label_keys             text[]  DEFAULT '{}',
  p_client_idempotency_key uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid           uuid    := auth.uid();
  _today_jst     date    := (now() AT TIME ZONE 'Asia/Tokyo')::date;
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

  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_restaurant_id';
  END IF;

  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'invalid_rating: must be 1..4';
  END IF;

  IF p_visit_date IS NULL THEN
    RAISE EXCEPTION 'visit_date_required';
  END IF;

  -- JST 当日より後は拒否（テーブル CHECK 制約と同一基準）
  IF p_visit_date > _today_jst THEN
    RAISE EXCEPTION 'visit_date_in_future';
  END IF;

  IF p_visit_id IS NULL AND p_client_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key_required_for_new_visit';
  END IF;

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

  PERFORM pg_advisory_xact_lock(
    hashtext(_uid::text),
    hashtext(p_restaurant_id::text)
  );

  IF NOT can_record_restaurant(p_restaurant_id) THEN
    RAISE EXCEPTION 'restaurant_not_accessible';
  END IF;

  IF p_visit_id IS NULL THEN

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

  SELECT * INTO _rep_visit
  FROM public.restaurant_visits
  WHERE user_id = _uid AND restaurant_id = p_restaurant_id
  ORDER BY visit_date DESC NULLS LAST, created_at DESC, id DESC
  LIMIT 1;

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


-- ----------------------------------------------------------------
-- 2. create_google_restaurant_review: CURRENT_DATE + 1 → JST 当日 に修正
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_google_restaurant_review(
  p_external_place_id      text,
  p_user_id                uuid,
  p_rating                 integer,
  p_comment                text    DEFAULT NULL,
  p_visit_date             date    DEFAULT NULL,
  p_image_path             text    DEFAULT NULL,
  p_reason_keys            text[]  DEFAULT NULL,
  p_label_keys             text[]  DEFAULT NULL,
  p_client_idempotency_key uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _today_jst       date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
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

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: p_user_id is required';
  END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'invalid_rating: must be 1..4';
  END IF;
  IF p_external_place_id IS NULL OR trim(p_external_place_id) = '' THEN
    RAISE EXCEPTION 'invalid_place_id';
  END IF;
  -- JST 当日より後は拒否（テーブル CHECK 制約と同一基準）
  IF p_visit_date IS NOT NULL AND p_visit_date > _today_jst THEN
    RAISE EXCEPTION 'visit_date_in_future';
  END IF;

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

  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext(p_external_place_id)
  );

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

  INSERT INTO public.restaurant_accesses (restaurant_id, user_id, visibility, created_by)
  VALUES (_restaurant_id, p_user_id, 'private', p_user_id)
  ON CONFLICT DO NOTHING;

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

  SELECT * INTO _rep_visit
  FROM public.restaurant_visits
  WHERE user_id = p_user_id AND restaurant_id = _restaurant_id
  ORDER BY visit_date DESC NULLS LAST, created_at DESC, id DESC
  LIMIT 1;

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

REVOKE ALL ON FUNCTION public.create_google_restaurant_review(
  text, uuid, integer, text, date, text, text[], text[], uuid
) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_google_restaurant_review(
  text, uuid, integer, text, date, text, text[], text[], uuid
) TO service_role;
