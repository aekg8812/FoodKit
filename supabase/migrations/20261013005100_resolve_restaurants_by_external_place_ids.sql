-- Batch resolve Google Place IDs to FoodKit restaurant rows.
-- Used by the hybrid search client to classify Google candidates as
-- FoodKit-existing vs. Google-only without N+1 round trips.
--
-- Returns only external_place_id, restaurant_id, and main_image_path —
-- no other metadata that could reveal sensitive restaurant information
-- to users who have not yet viewed the restaurant.

CREATE OR REPLACE FUNCTION public.resolve_restaurants_by_external_place_ids(
  p_external_place_ids text[]
)
RETURNS TABLE (
  external_place_id text,
  restaurant_id     uuid,
  main_image_path   text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.external_place_id,
    r.id            AS restaurant_id,
    r.main_image_path
  FROM public.restaurants r
  WHERE r.external_place_id = ANY(p_external_place_ids)
    AND r.source = 'google_place';
END;
$$;

REVOKE ALL   ON FUNCTION public.resolve_restaurants_by_external_place_ids(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_restaurants_by_external_place_ids(text[]) TO authenticated;
