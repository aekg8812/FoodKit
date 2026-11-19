-- Returns day-by-day visit counts and monthly summary for calendar display.
-- Covers any arbitrary past month; validates input to prevent extreme queries.
CREATE OR REPLACE FUNCTION public.get_logbook_calendar_month(
  p_year  integer,
  p_month integer
)
RETURNS TABLE (
  month_count      integer,
  prev_month_count integer,
  day_counts       jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid           uuid := auth.uid();
  _month_start   date;
  _next_month    date;
  _prev_start    date;
  _m_count       integer;
  _pm_count      integer;
  _day_counts    jsonb;
BEGIN
  IF _uid IS NULL THEN
    RETURN QUERY SELECT 0::integer, 0::integer, '{}'::jsonb;
    RETURN;
  END IF;

  IF p_year < 2000 OR p_year > 2100 OR p_month < 1 OR p_month > 12 THEN
    RETURN QUERY SELECT 0::integer, 0::integer, '{}'::jsonb;
    RETURN;
  END IF;

  _month_start := make_date(p_year, p_month, 1);
  _next_month  := _month_start + INTERVAL '1 month';
  _prev_start  := _month_start - INTERVAL '1 month';

  SELECT COUNT(*)::integer INTO _m_count
  FROM public.restaurant_visits
  WHERE user_id = _uid
    AND visit_date >= _month_start
    AND visit_date <  _next_month;

  SELECT COUNT(*)::integer INTO _pm_count
  FROM public.restaurant_visits
  WHERE user_id = _uid
    AND visit_date >= _prev_start
    AND visit_date <  _month_start;

  SELECT COALESCE(
    jsonb_object_agg(visit_date::text, cnt),
    '{}'::jsonb
  )
  INTO _day_counts
  FROM (
    SELECT visit_date, COUNT(*)::integer AS cnt
    FROM public.restaurant_visits
    WHERE user_id = _uid
      AND visit_date >= _month_start
      AND visit_date <  _next_month
    GROUP BY visit_date
  ) sub;

  RETURN QUERY SELECT _m_count, _pm_count, _day_counts;
END;
$$;

REVOKE ALL ON FUNCTION public.get_logbook_calendar_month(integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_logbook_calendar_month(integer, integer) TO authenticated;
