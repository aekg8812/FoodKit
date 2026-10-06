-- Fix: haversine_km is a pure math function with no table access.
-- SECURITY DEFINER is unnecessary; SECURITY INVOKER is correct.
-- Same signature — no overload accumulation.

create or replace function public.haversine_km(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
returns double precision
language sql
immutable
security invoker
set search_path = public, pg_temp
as $$
  select
    2.0 * 6371.0 * asin(sqrt(
      power(sin(radians((p_lat2 - p_lat1) / 2.0)), 2)
      + cos(radians(p_lat1)) * cos(radians(p_lat2))
        * power(sin(radians((p_lng2 - p_lng1) / 2.0)), 2)
    ))
$$;

revoke all on function public.haversine_km(double precision, double precision, double precision, double precision) from public;
revoke all on function public.haversine_km(double precision, double precision, double precision, double precision) from anon;
grant  execute on function public.haversine_km(double precision, double precision, double precision, double precision) to authenticated;
