-- Batch D: Add p_user_lat / p_user_lng / p_max_distance_km to get_today_restaurants.
--
-- Helper: haversine_km(lat1, lng1, lat2, lng2) -> double precision
-- Returns the great-circle distance in kilometres.

create or replace function public.haversine_km(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
returns double precision
language sql
immutable
security definer
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

-- ----------------------------------------------------------------
-- Drop old 8-argument signature before recreating with 11 args.
-- ----------------------------------------------------------------
drop function if exists public.get_today_restaurants(
  text,
  integer,
  text,
  text,
  boolean,
  boolean,
  integer,
  boolean
);

-- ----------------------------------------------------------------
-- Recreate with distance parameters added at the end.
--
-- Distance filter semantics:
--   All three of p_user_lat / p_user_lng / p_max_distance_km must
--   be non-NULL for distance filtering to activate.
--   When active:
--     - restaurants with NULL lat/lng are excluded
--     - restaurants beyond p_max_distance_km are excluded
-- ----------------------------------------------------------------
create or replace function public.get_today_restaurants(
  p_party_tag          text             default null,
  p_budget_max         integer          default null,
  p_genre              text             default null,
  p_atmosphere_tag     text             default null,
  p_walk_in            boolean          default false,
  p_parking            boolean          default false,
  p_limit              integer          default 20,
  p_open_now           boolean          default false,
  p_user_lat           double precision default null,
  p_user_lng           double precision default null,
  p_max_distance_km    double precision default null
)
returns table (
  restaurant_id             uuid,
  name                      text,
  area                      text,
  genre                     text,
  address                   text,
  budget_per_person_max_yen integer,
  walk_in_available         boolean,
  parking_available         boolean,
  same_type_review_count    bigint,
  overall_review_count      bigint,
  ranking_score             double precision,
  ranking_source            text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with

  visible_restaurants as (
    select
      r.id,
      r.name,
      r.area,
      r.genre,
      r.address,
      r.budget_per_person_max_yen,
      r.walk_in_available,
      r.parking_available,
      r.party_size_tags,
      r.atmosphere_tags,
      r.lat,
      r.lng
    from public.restaurants r
    where auth.uid() is not null
      and (
        r.source = 'seed'
        or r.created_by = auth.uid()
        or exists (
          select 1
          from public.restaurant_accesses ra
          join public.group_members gm
            on gm.group_id = ra.group_id
           and gm.user_id  = auth.uid()
          where ra.restaurant_id = r.id
            and ra.visibility = 'group'
        )
        or exists (
          select 1
          from public.reviews rv
          where rv.restaurant_id = r.id
            and public.can_view_review(rv.user_id, rv.restaurant_id)
        )
      )
  ),

  filtered_restaurants as (
    select r.*
    from visible_restaurants r
    where
      not exists (
        select 1
        from public.reviews my_rv
        where my_rv.restaurant_id = r.id
          and my_rv.user_id = auth.uid()
      )
      and (
        p_party_tag is null
        or r.party_size_tags @> array[p_party_tag]::text[]
      )
      and (
        p_budget_max is null
        or (r.budget_per_person_max_yen is not null
            and r.budget_per_person_max_yen <= p_budget_max)
      )
      and (
        p_genre is null
        or r.genre ilike '%' || p_genre || '%'
      )
      and (
        p_atmosphere_tag is null
        or r.atmosphere_tags @> array[p_atmosphere_tag]::text[]
      )
      and (
        not coalesce(p_walk_in, false)
        or r.walk_in_available is true
      )
      and (
        not coalesce(p_parking, false)
        or r.parking_available is true
      )
      and (
        not coalesce(p_open_now, false)
        or public.is_restaurant_open_now(r.id)
      )
      -- distance: all three params must be set to activate the filter
      and (
        p_user_lat is null
        or p_user_lng is null
        or p_max_distance_km is null
        or (
          r.lat is not null
          and r.lng is not null
          and public.haversine_km(p_user_lat, p_user_lng, r.lat, r.lng) <= p_max_distance_km
        )
      )
  ),

  my_type as (
    select main_value_type
    from public.user_value_profiles
    where user_id = auth.uid()
  ),

  visible_reviews as (
    select rv.restaurant_id, rv.user_id, rv.rating
    from public.reviews rv
    where public.can_view_review(rv.user_id, rv.restaurant_id)
  ),

  same_type_scores as (
    select
      vr.restaurant_id,
      count(*)                                                             as same_type_count,
      (count(*) filter (where vr.rating = 4) * 2.0
       + count(*) filter (where vr.rating = 3) * 1.0)
        / count(*)                                                         as same_type_score
    from visible_reviews vr
    join public.user_value_profiles p on p.user_id = vr.user_id
    where p.main_value_type = (select main_value_type from my_type)
    group by vr.restaurant_id
  ),

  overall_scores as (
    select
      vr.restaurant_id,
      count(*)                                                             as overall_count,
      (count(*) filter (where vr.rating = 4) * 2.0
       + count(*) filter (where vr.rating = 3) * 1.0)
        / count(*)                                                         as overall_score
    from visible_reviews vr
    group by vr.restaurant_id
  )

  select
    f.id                                    as restaurant_id,
    f.name,
    f.area,
    f.genre,
    f.address,
    f.budget_per_person_max_yen,
    f.walk_in_available,
    f.parking_available,
    coalesce(st.same_type_count, 0)         as same_type_review_count,
    coalesce(ov.overall_count,   0)         as overall_review_count,
    case
      when coalesce(st.same_type_count, 0) > 0 then st.same_type_score
      when coalesce(ov.overall_count,   0) > 0 then ov.overall_score
      else 0.0
    end                                     as ranking_score,
    case
      when coalesce(st.same_type_count, 0) > 0 then 'same_type'
      when coalesce(ov.overall_count,   0) > 0 then 'overall'
      else 'none'
    end                                     as ranking_source
  from filtered_restaurants f
  left join same_type_scores st on st.restaurant_id = f.id
  left join overall_scores   ov on ov.restaurant_id = f.id
  order by
    ranking_score             desc,
    same_type_review_count    desc,
    overall_review_count      desc,
    f.name                    asc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke all on function public.get_today_restaurants(text, integer, text, text, boolean, boolean, integer, boolean, double precision, double precision, double precision) from public;
revoke all on function public.get_today_restaurants(text, integer, text, text, boolean, boolean, integer, boolean, double precision, double precision, double precision) from anon;
grant  execute on function public.get_today_restaurants(text, integer, text, text, boolean, boolean, integer, boolean, double precision, double precision, double precision) to authenticated;
