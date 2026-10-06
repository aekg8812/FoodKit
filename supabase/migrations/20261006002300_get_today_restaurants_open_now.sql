-- Batch 2E-3B: Add p_open_now filter to get_today_restaurants
--
-- Replaces the existing 7-argument function with an 8-argument version
-- that adds p_open_now boolean (default false) at the end.
-- The old signature is dropped first to prevent overload accumulation.

-- ----------------------------------------------------------------
-- Drop old 7-argument signature
-- ----------------------------------------------------------------
drop function if exists public.get_today_restaurants(
  text,
  integer,
  text,
  text,
  boolean,
  boolean,
  integer
);

-- ----------------------------------------------------------------
-- Recreate with p_open_now added at the end
-- ----------------------------------------------------------------
create or replace function public.get_today_restaurants(
  p_party_tag       text    default null,
  p_budget_max      integer default null,
  p_genre           text    default null,
  p_atmosphere_tag  text    default null,
  p_walk_in         boolean default false,
  p_parking         boolean default false,
  p_limit           integer default 20,
  p_open_now        boolean default false
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

  -- ----------------------------------------------------------------
  -- Step 1: Restaurants visible to the calling user.
  --         Mirrors the three restaurants SELECT RLS policies exactly:
  --           (a) restaurants_select_seed        → source = 'seed'
  --           (b) restaurants_select_group_visible→ created_by = me
  --                                                  OR group-shared to my group
  --           (c) restaurants_select_via_visible_review → has a review I can see
  --         auth.uid() = NULL guard is embedded here so anon callers get 0 rows.
  -- ----------------------------------------------------------------
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
      r.atmosphere_tags
    from public.restaurants r
    where auth.uid() is not null
      and (
        -- (a) seed master: visible to all authenticated users
        r.source = 'seed'
        -- (b-1) creator
        or r.created_by = auth.uid()
        -- (b-2) group-shared to a group the caller belongs to
        or exists (
          select 1
          from public.restaurant_accesses ra
          join public.group_members gm
            on gm.group_id = ra.group_id
           and gm.user_id  = auth.uid()
          where ra.restaurant_id = r.id
            and ra.visibility = 'group'
        )
        -- (c) visible via a review the caller can see
        or exists (
          select 1
          from public.reviews rv
          where rv.restaurant_id = r.id
            and public.can_view_review(rv.user_id, rv.restaurant_id)
        )
      )
  ),

  -- ----------------------------------------------------------------
  -- Step 2: Apply V2 Today conditions, exclude already-reviewed,
  --         and apply open_now filter.
  --         NULL columns are excluded when the corresponding filter
  --         is active (NULL = "unknown / not entered", not a wildcard).
  --
  --         Open-now filter:
  --           p_open_now=true  → only restaurants currently open.
  --           p_open_now=false → no restriction (default).
  --         is_restaurant_open_now is security invoker, but called
  --         from this security definer context it runs as the function
  --         owner.  This is safe because open_now is applied only to
  --         restaurants already admitted by visible_restaurants above,
  --         so no invisible restaurant can appear in the result.
  -- ----------------------------------------------------------------
  filtered_restaurants as (
    select r.*
    from visible_restaurants r
    where
      -- exclude restaurants the caller has already reviewed
      not exists (
        select 1
        from public.reviews my_rv
        where my_rv.restaurant_id = r.id
          and my_rv.user_id = auth.uid()
      )
      -- party_size: GIN @> (contained-by) match; NULL store = excluded when filter active
      and (
        p_party_tag is null
        or r.party_size_tags @> array[p_party_tag]::text[]
      )
      -- budget: must be known and within the requested ceiling
      and (
        p_budget_max is null
        or (r.budget_per_person_max_yen is not null
            and r.budget_per_person_max_yen <= p_budget_max)
      )
      -- genre: ilike substring match
      and (
        p_genre is null
        or r.genre ilike '%' || p_genre || '%'
      )
      -- atmosphere: GIN @> match; NULL store = excluded when filter active
      and (
        p_atmosphere_tag is null
        or r.atmosphere_tags @> array[p_atmosphere_tag]::text[]
      )
      -- walk_in: only apply when caller set true; NULL store = excluded
      and (
        not coalesce(p_walk_in, false)
        or r.walk_in_available is true
      )
      -- parking: only apply when caller set true; NULL store = excluded
      and (
        not coalesce(p_parking, false)
        or r.parking_available is true
      )
      -- open_now: only apply when p_open_now=true
      -- business_hours_known=false → is_restaurant_open_now returns false → excluded
      and (
        not coalesce(p_open_now, false)
        or public.is_restaurant_open_now(r.id)
      )
  ),

  -- ----------------------------------------------------------------
  -- Step 3: Current user's main value type for same-type ranking.
  -- ----------------------------------------------------------------
  my_type as (
    select main_value_type
    from public.user_value_profiles
    where user_id = auth.uid()
  ),

  -- ----------------------------------------------------------------
  -- Step 4: Reviews visible to the calling user.
  --         Reuses can_view_review so ranking visibility automatically
  --         follows future changes to that function.
  -- ----------------------------------------------------------------
  visible_reviews as (
    select rv.restaurant_id, rv.user_id, rv.rating
    from public.reviews rv
    where public.can_view_review(rv.user_id, rv.restaurant_id)
  ),

  -- ----------------------------------------------------------------
  -- Step 5a: Same-type scores — reviews by users whose main_value_type
  --          matches the caller's.
  --          Scoring: rating 4 → 2 pts, rating 3 → 1 pt, others → 0 pt.
  -- ----------------------------------------------------------------
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

  -- ----------------------------------------------------------------
  -- Step 5b: Overall scores — all visible reviews regardless of type.
  --          Same scoring formula; used as fallback when same-type = 0.
  -- ----------------------------------------------------------------
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

  -- ----------------------------------------------------------------
  -- Final SELECT: join candidates with scores, resolve ranking_source.
  -- Restaurants with 0 visible reviews remain as candidates with
  -- ranking_score = 0 and ranking_source = 'none'.
  -- ----------------------------------------------------------------
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

revoke all on function public.get_today_restaurants(text, integer, text, text, boolean, boolean, integer, boolean) from public;
revoke all on function public.get_today_restaurants(text, integer, text, text, boolean, boolean, integer, boolean) from anon;
grant  execute on function public.get_today_restaurants(text, integer, text, text, boolean, boolean, integer, boolean) to authenticated;
