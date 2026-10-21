-- Hybrid restaurant search support:
-- ① partial unique index on external_place_id (NULL rows excluded — multiple NULLs allowed)
-- ② read-only security-definer RPC to resolve a restaurant UUID from an external_place_id
--    without exposing any other restaurant fields to callers outside normal RLS

-- ── ① Partial unique index ────────────────────────────────────────────────────
CREATE UNIQUE INDEX restaurants_external_place_id_idx
  ON public.restaurants(external_place_id)
  WHERE external_place_id IS NOT NULL;

-- ── ② resolve RPC ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_restaurant_by_external_place_id(
  p_external_place_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF p_external_place_id IS NULL OR trim(p_external_place_id) = '' THEN RETURN NULL; END IF;

  SELECT id INTO _id
  FROM public.restaurants
  WHERE external_place_id = p_external_place_id
  LIMIT 1;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_restaurant_by_external_place_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_restaurant_by_external_place_id(text) TO authenticated;
