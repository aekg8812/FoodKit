-- get_group_recommendations_v2(p_group_id, filters..., p_limit)
-- Group recommendation engine using Jaccard similarity on V2 preference cards.
--
-- Algorithm:
--   1. Valid members = group members with >= 5 V2 cards.
--   2. Similar reviewers per member = reviewers whose cards satisfy
--      intersection >= 3 AND intersection / union >= 0.40.
--   3. Evidence = visible reviews by similar reviewers on filtered restaurants.
--   4. member_score = (count_rating4 * 2 + count_rating3 * 1) / total_reviews
--      (ratings 1/2 dilute but don't contribute to numerator).
--   5. coverage_count = # valid members with >= 1 piece of evidence for the restaurant.
--   6. group_score = avg(member_score) across covered members.
--   7. Ranked: coverage_ratio DESC, group_score DESC, review_evidence_count DESC, name ASC.
--
-- Auth: caller must be a member of p_group_id.

create or replace function public.get_group_recommendations_v2(
  p_group_id        uuid,
  p_party_tag       text             default null,
  p_budget_max      integer          default null,
  p_genre           text             default null,
  p_atmosphere_tag  text             default null,
  p_walk_in         boolean          default null,
  p_parking         boolean          default null,
  p_open_now        boolean          default null,
  p_meal_period     text             default null,
  p_user_lat        double precision default null,
  p_user_lng        double precision default null,
  p_max_distance_km double precision default null,
  p_limit           integer          default 20
)
returns table(
  restaurant_id             uuid,
  name                      text,
  area                      text,
  genre                     text,
  address                   text,
  budget_per_person_max_yen integer,
  walk_in_available         boolean,
  parking_available         boolean,
  coverage_count            bigint,
  valid_member_count        bigint,
  coverage_ratio            numeric,
  group_score               numeric,
  review_evidence_count     bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with

  -- Auth + membership guard
  member_check as (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id  = auth.uid()
      and auth.uid() is not null
  ),

  -- Valid group members: >= 5 V2 preference cards
  valid_members as (
    select gm.user_id
    from public.group_members gm
    where gm.group_id = p_group_id
      and exists (select 1 from member_check)
      and (
        select count(*)
        from public.user_preference_cards upc
        where upc.user_id = gm.user_id
      ) >= 5
  ),

  vm_count as (
    select count(*) as cnt from valid_members
  ),

  -- Card counts for all users (needed for Jaccard union denominator)
  user_card_counts as (
    select user_id, count(*) as cnt
    from public.user_preference_cards
    group by user_id
  ),

  -- Intersection counts between each valid member and every card holder
  card_intersections as (
    select
      a.user_id as member_id,
      b.user_id as reviewer_id,
      count(*)  as intersection_cnt
    from public.user_preference_cards a
    join public.user_preference_cards b
      on b.preference_card_id = a.preference_card_id
    where a.user_id in (select user_id from valid_members)
    group by a.user_id, b.user_id
  ),

  -- Jaccard-similar pairs: intersection >= 3 AND intersection/union >= 0.40
  similar_pairs as (
    select
      ci.member_id,
      ci.reviewer_id
    from card_intersections ci
    join user_card_counts mc on mc.user_id = ci.member_id
    join user_card_counts rc on rc.user_id = ci.reviewer_id
    where ci.intersection_cnt >= 3
      and ci.intersection_cnt::numeric
          / (mc.cnt + rc.cnt - ci.intersection_cnt) >= 0.40
  ),

  -- Visible restaurants (same logic as get_today_restaurants)
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
      r.lng,
      r.meal_period_tags
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
            and ra.visibility    = 'group'
        )
        or exists (
          select 1 from public.reviews rv
          where rv.restaurant_id = r.id
            and public.can_view_review(rv.user_id, rv.restaurant_id)
        )
      )
  ),

  -- Apply caller-supplied filters
  filtered_restaurants as (
    select r.*
    from visible_restaurants r
    where
      (p_party_tag is null or r.party_size_tags @> array[p_party_tag]::text[])
      and (
        p_budget_max is null
        or (r.budget_per_person_max_yen is not null
            and r.budget_per_person_max_yen <= p_budget_max)
      )
      and (p_genre is null or r.genre ilike '%' || p_genre || '%')
      and (
        p_atmosphere_tag is null
        or r.atmosphere_tags @> array[p_atmosphere_tag]::text[]
      )
      and (not coalesce(p_walk_in,  false) or r.walk_in_available is true)
      and (not coalesce(p_parking,  false) or r.parking_available is true)
      and (
        not coalesce(p_open_now, false)
        or public.is_restaurant_open_now(r.id)
      )
      and (
        p_meal_period is null
        or (r.meal_period_tags is not null
            and r.meal_period_tags @> array[p_meal_period]::text[])
      )
      and (
        p_user_lat        is null
        or p_user_lng     is null
        or p_max_distance_km is null
        or (
          r.lat is not null
          and r.lng is not null
          and public.haversine_km(p_user_lat, p_user_lng, r.lat, r.lng) <= p_max_distance_km
        )
      )
  ),

  -- Evidence: visible reviews by similar reviewers on filtered restaurants
  evidence as (
    select
      sp.member_id,
      rv.restaurant_id,
      rv.user_id as reviewer_id,
      rv.rating
    from similar_pairs sp
    join public.reviews rv on rv.user_id = sp.reviewer_id
    join filtered_restaurants fr on fr.id = rv.restaurant_id
    where public.can_view_review(rv.user_id, rv.restaurant_id)
  ),

  -- Per-member score per restaurant
  member_scores as (
    select
      member_id,
      restaurant_id,
      (
        count(*) filter (where rating = 4) * 2.0
        + count(*) filter (where rating = 3) * 1.0
      ) / count(*) as member_score
    from evidence
    group by member_id, restaurant_id
  ),

  -- Distinct reviewer count per restaurant (for tie-breaking)
  reviewer_counts as (
    select restaurant_id, count(distinct reviewer_id) as evidence_count
    from evidence
    group by restaurant_id
  ),

  -- Aggregate scores per restaurant
  restaurant_agg as (
    select
      ms.restaurant_id,
      count(*)                                                          as coverage_count,
      (select cnt from vm_count)                                        as valid_member_count,
      count(*)::numeric / nullif((select cnt from vm_count), 0)         as coverage_ratio,
      avg(ms.member_score)                                              as group_score,
      rc.evidence_count                                                 as review_evidence_count
    from member_scores ms
    join reviewer_counts rc on rc.restaurant_id = ms.restaurant_id
    group by ms.restaurant_id, rc.evidence_count
  )

  select
    fr.id                       as restaurant_id,
    fr.name,
    fr.area,
    fr.genre,
    fr.address,
    fr.budget_per_person_max_yen,
    fr.walk_in_available,
    fr.parking_available,
    ra.coverage_count,
    ra.valid_member_count,
    ra.coverage_ratio,
    ra.group_score,
    ra.review_evidence_count
  from restaurant_agg ra
  join filtered_restaurants fr on fr.id = ra.restaurant_id
  order by
    ra.coverage_ratio         desc,
    ra.group_score            desc,
    ra.review_evidence_count  desc,
    fr.name                   asc
  limit p_limit;
$$;

revoke all on function public.get_group_recommendations_v2(
  uuid, text, integer, text, text, boolean, boolean, boolean, text,
  double precision, double precision, double precision, integer
) from public;
grant execute on function public.get_group_recommendations_v2(
  uuid, text, integer, text, text, boolean, boolean, boolean, text,
  double precision, double precision, double precision, integer
) to authenticated;
