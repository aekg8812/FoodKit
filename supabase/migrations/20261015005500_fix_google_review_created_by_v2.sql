-- Fix: restore created_by in restaurant_accesses INSERT inside
-- create_google_restaurant_review (8-param version).
--
-- Migration 20261014005400 recreated this function for V3 signal support but
-- accidentally omitted the created_by column that 20261013005000 had added.
-- restaurant_accesses.created_by is NOT NULL, so every Google review save
-- failed with error code 23502.

CREATE OR REPLACE FUNCTION public.create_google_restaurant_review(
  p_external_place_id text,
  p_user_id           uuid,
  p_rating            integer,
  p_comment           text    DEFAULT NULL,
  p_visit_date        date    DEFAULT NULL,
  p_image_path        text    DEFAULT NULL,
  p_reason_keys       text[]  DEFAULT NULL,
  p_label_keys        text[]  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _restaurant_id     uuid;
  _review_id         uuid;
  _valid_reasons     text[] := ARRAY['taste','value','atmosphere','service','volume','access'];
  _rk                text;
  _lk                text;
  _deduped_reasons   text[];
  _deduped_labels    text[];
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

  -- Validate signal keys early (before any writes) so we fail fast
  IF p_reason_keys IS NOT NULL AND array_length(p_reason_keys, 1) > 0 THEN
    SELECT array_agg(DISTINCT rk ORDER BY rk)
    INTO _deduped_reasons
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
    SELECT array_agg(DISTINCT lk ORDER BY lk)
    INTO _deduped_labels
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

  -- Resolve existing restaurant
  SELECT id INTO _restaurant_id
  FROM public.restaurants
  WHERE external_place_id = p_external_place_id
  LIMIT 1;

  -- Create if not found (handle race via unique_violation)
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

  -- Ensure private access row (created_by required: NOT NULL constraint)
  INSERT INTO public.restaurant_accesses (restaurant_id, user_id, visibility, created_by)
  VALUES (_restaurant_id, p_user_id, 'private', p_user_id)
  ON CONFLICT DO NOTHING;

  -- Upsert review
  INSERT INTO public.reviews (
    restaurant_id, user_id, rating, comment, visit_date, image_path,
    group_id, visibility
  )
  VALUES (
    _restaurant_id, p_user_id, p_rating, p_comment, p_visit_date, p_image_path,
    NULL, 'private'
  )
  ON CONFLICT ON CONSTRAINT reviews_user_restaurant_unique DO UPDATE SET
    rating     = EXCLUDED.rating,
    comment    = EXCLUDED.comment,
    visit_date = EXCLUDED.visit_date,
    image_path = CASE
                   WHEN EXCLUDED.image_path IS NOT NULL THEN EXCLUDED.image_path
                   ELSE reviews.image_path
                 END
  RETURNING id INTO _review_id;

  -- Atomic signal replacement (runs in same transaction as review upsert)
  -- Note: uses p_user_id directly (service_role context; auth.uid() not available)
  DELETE FROM public.review_reason_tags WHERE review_id = _review_id;
  IF array_length(_deduped_reasons, 1) > 0 THEN
    INSERT INTO public.review_reason_tags (review_id, reason_key)
    SELECT _review_id, rk FROM unnest(_deduped_reasons) AS rk;
  END IF;

  DELETE FROM public.review_restaurant_labels WHERE review_id = _review_id;
  IF array_length(_deduped_labels, 1) > 0 THEN
    INSERT INTO public.review_restaurant_labels (review_id, label_key)
    SELECT _review_id, lk FROM unnest(_deduped_labels) AS lk;
  END IF;

  RETURN jsonb_build_object(
    'restaurant_id', _restaurant_id,
    'review_id',     _review_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_google_restaurant_review(text, uuid, integer, text, date, text, text[], text[])
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_google_restaurant_review(text, uuid, integer, text, date, text, text[], text[])
  TO service_role;
