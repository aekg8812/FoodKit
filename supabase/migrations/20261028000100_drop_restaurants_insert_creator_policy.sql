-- Drop the manual-registration INSERT policy.
-- All legitimate restaurant inserts now go through server-side service-role
-- clients (createRestaurantAction, create_google_restaurant_review RPC) which
-- bypass RLS entirely. No authenticated client should INSERT directly.
DROP POLICY IF EXISTS restaurants_insert_creator ON public.restaurants;
