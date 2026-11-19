-- get_logbook_stats: returns total/monthly visit counts and per-restaurant counts
-- Used by logbook list tab for accurate aggregation over all visits (no client-side limit)

CREATE OR REPLACE FUNCTION public.get_logbook_stats()
RETURNS TABLE (
  total_count      integer,
  this_month_count integer,
  prev_month_count integer,
  restaurant_counts jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid           uuid := auth.uid();
  _today_jst     date := (now() AT TIME ZONE 'Asia/Tokyo')::date;
  _this_month    text := to_char(_today_jst, 'YYYY-MM');
  _prev_month    text := to_char(_today_jst - INTERVAL '1 month', 'YYYY-MM');
  _total         integer;
  _this_m        integer;
  _prev_m        integer;
  _rest_counts   jsonb;
BEGIN
  IF _uid IS NULL THEN
    total_count      := 0;
    this_month_count := 0;
    prev_month_count := 0;
    restaurant_counts := '{}'::jsonb;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE to_char(visit_date, 'YYYY-MM') = _this_month)::integer,
    COUNT(*) FILTER (WHERE to_char(visit_date, 'YYYY-MM') = _prev_month)::integer
  INTO _total, _this_m, _prev_m
  FROM public.restaurant_visits
  WHERE user_id = _uid;

  SELECT COALESCE(jsonb_object_agg(restaurant_id::text, cnt), '{}'::jsonb)
  INTO _rest_counts
  FROM (
    SELECT restaurant_id, COUNT(*)::integer AS cnt
    FROM public.restaurant_visits
    WHERE user_id = _uid
    GROUP BY restaurant_id
  ) sub;

  total_count      := _total;
  this_month_count := _this_m;
  prev_month_count := _prev_m;
  restaurant_counts := _rest_counts;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_logbook_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_logbook_stats() TO authenticated;
