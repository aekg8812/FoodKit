-- Google Direct Review: Zero-Input Google Place Flow
--
-- 1. Make restaurants.name nullable (google_place source stores no name)
-- 2. Add CHECK: non-google restaurants must still have a name
-- 3. Create atomic service-role-only RPC: create_google_restaurant_review
-- 4. Update recommendation RPCs to return source + external_place_id

-- ── 1. Make name nullable ──────────────────────────────────────────────────

ALTER TABLE public.restaurants ALTER COLUMN name DROP NOT NULL;

-- ── 2. Source-gated name CHECK ────────────────────────────────────────────

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_name_source_check CHECK (
    (source = 'google_place'::restaurant_source AND external_place_id IS NOT NULL)
    OR (source <> 'google_place'::restaurant_source AND name IS NOT NULL)
  );

-- ── 3. Atomic service-role-only RPC ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_google_restaurant_review(
  p_external_place_id text,
  p_user_id           uuid,
  p_rating            integer,
  p_comment           text    DEFAULT NULL,
  p_visit_date        date    DEFAULT NULL,
  p_image_path        text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _restaurant_id uuid;
  _review_id     uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized: p_user_id is required';
  END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'invalid_rating: must be 1..4';
  END IF;
  IF p_external_place_id IS NULL OR trim(p_external_place_id) = '' THEN
    RAISE EXCEPTION 'invalid_place_id';
  END IF;

  -- Resolve existing restaurant
  SELECT id INTO _restaurant_id
  FROM public.restaurants
  WHERE external_place_id = p_external_place_id
  LIMIT 1;

  -- Create if not found (handle race via unique_violation)
  IF _restaurant_id IS NULL THEN
    BEGIN
      INSERT INTO public.restaurants (name, source, external_place_id, created_by)
      VALUES (NULL, 'google_place', p_external_place_id, p_user_id)
      RETURNING id INTO _restaurant_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO _restaurant_id
      FROM public.restaurants
      WHERE external_place_id = p_external_place_id
      LIMIT 1;
    END;
  END IF;

  IF _restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant_create_failed';
  END IF;

  -- Ensure private access row
  INSERT INTO public.restaurant_accesses (restaurant_id, user_id, visibility)
  VALUES (_restaurant_id, p_user_id, 'private')
  ON CONFLICT DO NOTHING;

  -- Upsert review
  INSERT INTO public.reviews (
    restaurant_id, user_id, rating, comment, visit_date, image_path,
    group_id, visibility
  )
  VALUES (
    _restaurant_id, p_user_id, p_rating, p_comment, p_visit_date, p_image_path,
    NULL, 'private'
  )
  ON CONFLICT ON CONSTRAINT reviews_user_restaurant_unique DO UPDATE SET
    rating     = EXCLUDED.rating,
    comment    = EXCLUDED.comment,
    visit_date = EXCLUDED.visit_date,
    image_path = CASE
                   WHEN EXCLUDED.image_path IS NOT NULL THEN EXCLUDED.image_path
                   ELSE reviews.image_path
                 END
  RETURNING id INTO _review_id;

  RETURN jsonb_build_object(
    'restaurant_id', _restaurant_id,
    'review_id',     _review_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_google_restaurant_review(text, uuid, integer, text, date, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_google_restaurant_review(text, uuid, integer, text, date, text)
  TO service_role;

-- ── 4a. get_personal_recommendations_v2 — add source + external_place_id ──

DROP FUNCTION IF EXISTS public.get_personal_recommendations_v2(integer);

CREATE OR REPLACE FUNCTION public.get_personal_recommendations_v2(p_limit integer DEFAULT 20)
  RETURNS TABLE(
    restaurant_id          uuid,
    name                   text,
    area                   text,
    genre                  text,
    main_image_path        text,
    budget_per_person_max_yen integer,
    walk_in_available      boolean,
    parking_available      boolean,
    personal_score         numeric,
    evidence_count         bigint,
    followed_evidence_count bigint,
    similar_evidence_count bigint,
    rating_4_count         bigint,
    rating_3_count         bigint,
    source                 restaurant_source,
    external_place_id      text
  )
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
  with

  viewer as (
    select auth.uid() as uid
    where auth.uid() is not null
  ),

  followed_users as (
    select followee_id as user_id
    from public.follows
    where follower_id = (select uid from viewer)
      and status = 'accepted'
  ),

  viewer_cards as (
    select preference_card_id
    from public.user_preference_cards
    where user_id = (select uid from viewer)
  ),

  user_card_counts as (
    select user_id, count(*) as cnt
    from public.user_preference_cards
    group by user_id
  ),

  card_intersections as (
    select
      upc.user_id  as reviewer_id,
      count(*)     as intersection_cnt
    from public.user_preference_cards upc
    where upc.preference_card_id in (select preference_card_id from viewer_cards)
      and upc.user_id != (select uid from viewer)
    group by upc.user_id
  ),

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

  viewer_reviewed as (
    select distinct restaurant_id
    from public.reviews
    where user_id = (select uid from viewer)
  ),

  visible_restaurants as (
    select r.id, r.name, r.area, r.genre,
           r.main_image_path,
           r.budget_per_person_max_yen, r.walk_in_available, r.parking_available,
           r.source, r.external_place_id
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
    vr.main_image_path,
    vr.budget_per_person_max_yen,
    vr.walk_in_available,
    vr.parking_available,
    re.personal_score,
    re.evidence_count,
    re.followed_evidence_count,
    re.similar_evidence_count,
    re.rating_4_count,
    re.rating_3_count,
    vr.source,
    vr.external_place_id
  from restaurant_evidence re
  join visible_restaurants vr on vr.id = re.restaurant_id
  order by
    re.personal_score          desc,
    re.followed_evidence_count desc,
    re.evidence_count          desc,
    vr.name                    asc
  limit p_limit;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_personal_recommendations_v2(integer) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_personal_recommendations_v2(integer) TO authenticated;

-- ── 4b. get_group_recommendations_v2 — add source + external_place_id ──────

DROP FUNCTION IF EXISTS public.get_group_recommendations_v2(uuid, text, integer, text, text, boolean, boolean, boolean, text, double precision, double precision, double precision, integer);

CREATE OR REPLACE FUNCTION public.get_group_recommendations_v2(
  p_group_id        uuid,
  p_party_tag       text             DEFAULT NULL,
  p_budget_max      integer          DEFAULT NULL,
  p_genre           text             DEFAULT NULL,
  p_atmosphere_tag  text             DEFAULT NULL,
  p_walk_in         boolean          DEFAULT NULL,
  p_parking         boolean          DEFAULT NULL,
  p_open_now        boolean          DEFAULT NULL,
  p_meal_period     text             DEFAULT NULL,
  p_user_lat        double precision DEFAULT NULL,
  p_user_lng        double precision DEFAULT NULL,
  p_max_distance_km double precision DEFAULT NULL,
  p_limit           integer          DEFAULT 20
)
  RETURNS TABLE(
    restaurant_id          uuid,
    name                   text,
    area                   text,
    genre                  text,
    address                text,
    budget_per_person_max_yen integer,
    walk_in_available      boolean,
    parking_available      boolean,
    coverage_count         bigint,
    valid_member_count     bigint,
    coverage_ratio         numeric,
    group_score            numeric,
    review_evidence_count  bigint,
    source                 restaurant_source,
    external_place_id      text
  )
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
  with

  member_check as (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id  = auth.uid()
      and auth.uid() is not null
  ),

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

  user_card_counts as (
    select user_id, count(*) as cnt
    from public.user_preference_cards
    group by user_id
  ),

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

  -- Jaccard-similar pairs: intersection >= 3, J >= 0.40, AND reviewer has >= 5 cards
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
      and rc.cnt >= 5
  ),

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
      r.meal_period_tags,
      r.source,
      r.external_place_id
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

  reviewer_counts as (
    select restaurant_id, count(distinct reviewer_id) as evidence_count
    from evidence
    group by restaurant_id
  ),

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
    ra.review_evidence_count,
    fr.source,
    fr.external_place_id
  from restaurant_agg ra
  join filtered_restaurants fr on fr.id = ra.restaurant_id
  order by
    ra.coverage_ratio         desc,
    ra.group_score            desc,
    ra.review_evidence_count  desc,
    fr.name                   asc
  limit p_limit;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_group_recommendations_v2(uuid, text, integer, text, text, boolean, boolean, boolean, text, double precision, double precision, double precision, integer) FROM public;
GRANT  EXECUTE ON FUNCTION public.get_group_recommendations_v2(uuid, text, integer, text, text, boolean, boolean, boolean, text, double precision, double precision, double precision, integer) TO authenticated;
