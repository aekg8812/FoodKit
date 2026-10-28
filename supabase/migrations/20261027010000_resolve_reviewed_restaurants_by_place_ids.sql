-- resolve_reviewed_restaurants_by_place_ids
-- Like resolve_restaurants_by_external_place_ids but only returns restaurants
-- that have at least one review, so the "FoodKitのお店" badge is accurate.
CREATE OR REPLACE FUNCTION public.resolve_reviewed_restaurants_by_place_ids(
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

  -- DISTINCT ON deduplicates in case the input array contains repeated place IDs.
  -- EXISTS check: any review row for this restaurant suffices (V2 RLS allows
  -- auth.uid() IS NOT NULL to read all reviews, matching the SECURITY DEFINER context).
  RETURN QUERY
  SELECT DISTINCT ON (r.external_place_id)
    r.external_place_id,
    r.id            AS restaurant_id,
    r.main_image_path
  FROM public.restaurants r
  WHERE r.external_place_id = ANY(p_external_place_ids)
    AND r.source = 'google_place'
    AND EXISTS (
      SELECT 1 FROM public.reviews rv WHERE rv.restaurant_id = r.id
    )
  ORDER BY r.external_place_id;
END;
$$;

REVOKE ALL   ON FUNCTION public.resolve_reviewed_restaurants_by_place_ids(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_reviewed_restaurants_by_place_ids(text[]) TO authenticated;
