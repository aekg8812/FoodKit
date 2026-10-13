-- Restaurant identity hardening
--
-- 1. Tighten INSERT RLS: authenticated users may only insert restaurants with
--    external_place_id IS NULL (manual registrations).  Google Place restaurants
--    must be created through the server-side service role path.
--
-- 2. Immutability trigger: after creation, external_place_id / source /
--    created_by may not be modified by any role.

-- ── 1. INSERT RLS tightening ──────────────────────────────────────────────────

DROP POLICY IF EXISTS restaurants_insert_creator ON public.restaurants;

CREATE POLICY restaurants_insert_creator ON public.restaurants
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND external_place_id IS NULL
  );

-- ── 2. Identity field immutability trigger ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_restaurant_identity_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.external_place_id IS DISTINCT FROM OLD.external_place_id THEN
    RAISE EXCEPTION 'restaurants.external_place_id cannot be modified after creation';
  END IF;
  IF NEW.source IS DISTINCT FROM OLD.source THEN
    RAISE EXCEPTION 'restaurants.source cannot be modified after creation';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'restaurants.created_by cannot be modified after creation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restaurants_identity_immutable ON public.restaurants;

CREATE TRIGGER restaurants_identity_immutable
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW
  WHEN (
    NEW.external_place_id IS DISTINCT FROM OLD.external_place_id
    OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  )
  EXECUTE FUNCTION public.prevent_restaurant_identity_change();
