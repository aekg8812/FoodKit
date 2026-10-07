-- Security hardening: fix missing ACL and search_path on legacy SECURITY DEFINER functions.
--
-- get_recommendations_filtered (V1 only, not called from V2):
--   Was missing explicit ACL → public (including anon) could EXECUTE.
--   REVOKE from public, GRANT to authenticated only.
--
-- handle_new_user (trigger function):
--   Was missing explicit ACL. Trigger functions cannot be called directly,
--   but REVOKE from public adds defense in depth.
--
-- is_restaurant_creator:
--   search_path was 'public' only, missing pg_temp which allows
--   temp-table search_path injection. Recreate with correct path.

-- get_recommendations_filtered
REVOKE EXECUTE ON FUNCTION public.get_recommendations_filtered(text, text, text, integer) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_recommendations_filtered(text, text, text, integer) TO authenticated;

-- handle_new_user (trigger — postgres superuser retains access via ownership)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;

-- is_restaurant_creator: add pg_temp to search_path
CREATE OR REPLACE FUNCTION public.is_restaurant_creator(target_restaurant_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants
    WHERE id = target_restaurant_id
      AND created_by = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_restaurant_creator(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.is_restaurant_creator(uuid) TO authenticated;
