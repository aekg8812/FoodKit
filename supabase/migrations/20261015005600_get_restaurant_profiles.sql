-- V3 Phase 2: Restaurant Profile aggregation RPC
--
-- get_restaurant_profiles(p_restaurant_ids uuid[])
--
-- Returns 12 label-dimension rows per restaurant for all visible restaurants
-- in the input array. Restaurants not visible to the viewer or that don't
-- exist produce 0 rows (not empty 12-row profiles).
--
-- Security: INVOKER — reviews, review_restaurant_labels, restaurant_labels,
-- and restaurants RLS all apply naturally under the caller's role.
-- No DEFINER needed; can_view_review() is delegated via existing RLS policies.

CREATE OR REPLACE FUNCTION public.get_restaurant_profiles(
  p_restaurant_ids uuid[]
)
RETURNS TABLE (
  restaurant_id  uuid,
  label_key      text,
  label_name     text,
  category       text,
  sort_order     integer,
  vote_count     bigint,
  sample_size    bigint,
  selection_rate numeric,
  confidence     numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH
    -- Filter input: NULL exclusion + DISTINCT + restaurants RLS via JOIN.
    -- Only restaurants visible to the caller (seed / created_by / group /
    -- via_visible_review) pass through here.
    visible_restaurants AS (
      SELECT r.id AS restaurant_id
      FROM public.restaurants r
      WHERE r.id = ANY (
        SELECT DISTINCT rid
        FROM unnest(p_restaurant_ids) AS rid
        WHERE rid IS NOT NULL
      )
    ),

    -- Reviews belonging to visible restaurants.
    -- reviews RLS (can_view_review) applies automatically.
    target_reviews AS (
      SELECT rv.id AS review_id, rv.restaurant_id
      FROM public.reviews rv
      WHERE rv.restaurant_id IN (SELECT restaurant_id FROM visible_restaurants)
    ),

    -- Reviews that have at least one label entry.
    -- review_restaurant_labels RLS (can_view_review delegation) applies.
    labeled_reviews AS (
      SELECT DISTINCT rrl.review_id, tr.restaurant_id
      FROM public.review_restaurant_labels rrl
      JOIN target_reviews tr ON tr.review_id = rrl.review_id
    ),

    -- sample_size per restaurant:
    -- count of reviews with ≥1 label (label-absent reviews excluded).
    sample AS (
      SELECT restaurant_id,
             COUNT(*) AS sample_size
      FROM labeled_reviews
      GROUP BY restaurant_id
    ),

    -- vote_count per (restaurant, label):
    -- DISTINCT review_id guards against any future duplicate rows.
    votes AS (
      SELECT tr.restaurant_id,
             rrl.label_key,
             COUNT(DISTINCT rrl.review_id) AS vote_count
      FROM public.review_restaurant_labels rrl
      JOIN target_reviews tr ON tr.review_id = rrl.review_id
      GROUP BY tr.restaurant_id, rrl.label_key
    )

  SELECT
    vr.restaurant_id,
    rl.key                                                            AS label_key,
    rl.name                                                           AS label_name,
    rl.category,
    rl.sort_order,
    COALESCE(v.vote_count, 0)                                         AS vote_count,
    COALESCE(s.sample_size, 0)                                        AS sample_size,
    CASE
      WHEN COALESCE(s.sample_size, 0) = 0 THEN NULL
      ELSE ROUND(
        COALESCE(v.vote_count, 0)::numeric / s.sample_size,
        4
      )
    END                                                               AS selection_rate,
    ROUND(
      COALESCE(s.sample_size, 0)::numeric
        / (COALESCE(s.sample_size, 0) + 5),
      4
    )                                                                 AS confidence

  FROM visible_restaurants vr
  CROSS JOIN public.restaurant_labels rl
  LEFT JOIN votes v
    ON v.restaurant_id = vr.restaurant_id
   AND v.label_key     = rl.key
  LEFT JOIN sample s
    ON s.restaurant_id = vr.restaurant_id

  ORDER BY
    vr.restaurant_id,
    CASE rl.category
      WHEN 'occasion'    THEN 1
      WHEN 'atmosphere'  THEN 2
      WHEN 'experience'  THEN 3
    END,
    rl.sort_order
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_profiles(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_restaurant_profiles(uuid[]) TO authenticated;
