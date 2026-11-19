-- get_home_stats: home screen personal stats for the current user
-- Returns three monthly metrics displayed on the home screen stat cards.

CREATE OR REPLACE FUNCTION public.get_home_stats()
RETURNS TABLE (
  this_month_count  integer,   -- visits this month (visit_date in current JST month)
  again_count       integer,   -- visits this month with rating = 3
  new_places_count  integer    -- restaurants visited for the first time this month
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid        uuid := auth.uid();
  _this_month text := to_char((now() AT TIME ZONE 'Asia/Tokyo')::date, 'YYYY-MM');
  _this_m     integer;
  _again      integer;
  _new        integer;
BEGIN
  IF _uid IS NULL THEN
    this_month_count := 0;
    again_count      := 0;
    new_places_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Today's month visit count (visit_date NOT NULL, same month as JST today)
  SELECT COUNT(*)::integer
  INTO _this_m
  FROM public.restaurant_visits
  WHERE user_id = _uid
    AND visit_date IS NOT NULL
    AND to_char(visit_date, 'YYYY-MM') = _this_month;

  -- This month's rating=3 visits
  SELECT COUNT(*)::integer
  INTO _again
  FROM public.restaurant_visits
  WHERE user_id = _uid
    AND rating = 3
    AND visit_date IS NOT NULL
    AND to_char(visit_date, 'YYYY-MM') = _this_month;

  -- Restaurants whose very first recorded visit (non-null visit_date) is this month.
  -- Restaurants that have any visit with NULL visit_date are intentionally excluded
  -- from "first visit" logic unless a non-null visit_date exists and that date falls
  -- in the current month.
  SELECT COUNT(DISTINCT restaurant_id)::integer
  INTO _new
  FROM (
    SELECT restaurant_id, MIN(visit_date) AS first_date
    FROM public.restaurant_visits
    WHERE user_id = _uid
      AND visit_date IS NOT NULL
    GROUP BY restaurant_id
  ) sub
  WHERE to_char(first_date, 'YYYY-MM') = _this_month;

  this_month_count := _this_m;
  again_count      := _again;
  new_places_count := _new;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_home_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_home_stats() TO authenticated;
