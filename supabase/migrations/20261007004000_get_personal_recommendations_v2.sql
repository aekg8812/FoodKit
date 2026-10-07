-- M6: get_personal_recommendations_v2
-- Evidence = reviewed by (followed users) UNION (Jaccard-similar users).
-- One review per reviewer per restaurant (enforced by reviews unique constraint).
-- Excludes restaurants viewer already reviewed.
-- Viewer with <5 cards still gets followed-user evidence; similar branch is empty.

create or replace function public.get_personal_recommendations_v2(
  p_limit integer default 20
)
returns table(
  restaurant_id             uuid,
  name                      text,
  area                      text,
  genre                     text,
  budget_per_person_max_yen integer,
  walk_in_available         boolean,
  parking_available         boolean,
  personal_score            numeric,
  evidence_count            bigint,
  followed_evidence_count   bigint,
  similar_evidence_count    bigint,
  rating_4_count            bigint,
  rating_3_count            bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with

  viewer as (
    select auth.uid() as uid
    where auth.uid() is not null
  ),

  -- One-way accepted follows (viewer → followee)
  followed_users as (
    select followee_id as user_id
    from public.follows
    where follower_id = (select uid from viewer)
      and status = 'accepted'
  ),

  -- Viewer's preference cards (for Jaccard)
  viewer_cards as (
    select preference_card_id
    from public.user_preference_cards
    where user_id = (select uid from viewer)
  ),

  -- Card counts per user
  user_card_counts as (
    select user_id, count(*) as cnt
    from public.user_preference_cards
    group by user_id
  ),

  -- Jaccard intersection between viewer and each potential reviewer
  card_intersections as (
    select
      upc.user_id  as reviewer_id,
      count(*)     as intersection_cnt
    from public.user_preference_cards upc
    where upc.preference_card_id in (select preference_card_id from viewer_cards)
      and upc.user_id != (select uid from viewer)
    group by upc.user_id
  ),

  -- Similar users: BOTH ≥5 cards, intersection ≥3, Jaccard ≥0.40
  similar_users as (
    select ci.reviewer_id as user_id
    from card_intersections ci
    join user_card_counts vc on vc.user_id = (select uid from viewer)
    join user_card_counts rc on rc.user_id = ci.reviewer_id
    where vc.cnt >= 5
      and rc.cnt >= 5
      and ci.intersection_cnt >= 3
      and ci.intersection_cnt::numeric
          / (vc.cnt + rc.cnt - ci.intersection_cnt) >= 0.40
  ),

  -- Merge followed + similar; preserve both flags for a user who qualifies both
  evidence_users_raw as (
    select user_id, true  as is_followed, false as is_similar from followed_users
    union all
    select user_id, false as is_followed, true  as is_similar from similar_users
  ),
  evidence_sources as (
    select
      user_id,
      bool_or(is_followed) as is_followed,
      bool_or(is_similar)  as is_similar
    from evidence_users_raw
    group by user_id
  ),

  -- Restaurants viewer already reviewed → exclude from candidates
  viewer_reviewed as (
    select distinct restaurant_id
    from public.reviews
    where user_id = (select uid from viewer)
  ),

  -- Visible restaurants (mirrors M5 visible_restaurants logic)
  visible_restaurants as (
    select r.id, r.name, r.area, r.genre,
           r.budget_per_person_max_yen, r.walk_in_available, r.parking_available
    from public.restaurants r
    where (select uid from viewer) is not null
      and r.id not in (select restaurant_id from viewer_reviewed)
      and (
        r.source = 'seed'
        or r.created_by = (select uid from viewer)
        or exists (
          select 1
          from public.restaurant_accesses ra
          join public.group_members gm
            on  gm.group_id = ra.group_id
            and gm.user_id  = (select uid from viewer)
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

  -- Reviews by evidence_sources users on visible restaurants
  evidence as (
    select
      es.is_followed,
      es.is_similar,
      rv.restaurant_id,
      rv.rating
    from evidence_sources es
    join public.reviews rv
      on rv.user_id = es.user_id
    join visible_restaurants vr
      on vr.id = rv.restaurant_id
    where public.can_view_review(rv.user_id, rv.restaurant_id)
  ),

  -- Aggregate per restaurant
  restaurant_evidence as (
    select
      restaurant_id,
      count(*)                                 as evidence_count,
      count(*) filter (where is_followed)      as followed_evidence_count,
      count(*) filter (where is_similar)       as similar_evidence_count,
      count(*) filter (where rating = 4)       as rating_4_count,
      count(*) filter (where rating = 3)       as rating_3_count,
      (
        count(*) filter (where rating = 4) * 2.0
        + count(*) filter (where rating = 3)
      ) / count(*)                             as personal_score
    from evidence
    group by restaurant_id
  )

  select
    vr.id   as restaurant_id,
    vr.name,
    vr.area,
    vr.genre,
    vr.budget_per_person_max_yen,
    vr.walk_in_available,
    vr.parking_available,
    re.personal_score,
    re.evidence_count,
    re.followed_evidence_count,
    re.similar_evidence_count,
    re.rating_4_count,
    re.rating_3_count
  from restaurant_evidence re
  join visible_restaurants vr on vr.id = re.restaurant_id
  order by
    re.personal_score          desc,
    re.followed_evidence_count desc,
    re.evidence_count          desc,
    vr.name                    asc
  limit p_limit;
$$;

revoke all  on function public.get_personal_recommendations_v2(integer) from public;
grant execute on function public.get_personal_recommendations_v2(integer) to authenticated;
