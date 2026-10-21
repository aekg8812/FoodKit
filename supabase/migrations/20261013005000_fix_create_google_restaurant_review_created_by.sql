-- Fix: create_google_restaurant_review — add created_by to restaurant_accesses INSERT
--
-- The initial implementation omitted created_by (NOT NULL) from the INSERT into
-- restaurant_accesses, causing a 23502 constraint violation on every new Google
-- restaurant review submission.

CREATE OR REPLACE FUNCTION public.create_google_restaurant_review(
  p_external_place_id text,
  p_user_id           uuid,
  p_rating            integer,
  p_comment           text    DEFAULT NULL,
  p_visit_date        date    DEFAULT NULL,
  p_image_path        text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _restaurant_id uuid;
  _review_id     uuid;
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

  -- Ensure private access row (created_by required NOT NULL)
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

  RETURN jsonb_build_object(
    'restaurant_id', _restaurant_id,
    'review_id',     _review_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_google_restaurant_review(text, uuid, integer, text, date, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_google_restaurant_review(text, uuid, integer, text, date, text)
  TO service_role;
