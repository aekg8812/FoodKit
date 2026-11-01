-- FIX-002: get_similar_user_rating_summary
--
-- Returns 4 aggregate counts for a given restaurant:
--   similar_reviewer_count         — similar users who reviewed this restaurant
--   high_rating_reviewer_count     — similar users who gave rating ≥3 ("また行きたい" or better)
--   all_reviewer_count             — all other users who reviewed (viewer excluded)
--   all_high_rating_reviewer_count — all other users who gave rating ≥3
--
-- "Similar" uses similarity_v1 (Jaccard ≥0.40, intersection ≥3, both ≥5 cards).
-- "All" includes similar users; the viewer is excluded from both counts.
-- Only reviews passing can_view_review() are counted in both groups.
-- Unauthenticated viewer → viewer CTE empty → all counts return 0.
--
-- Security:
--   • SECURITY DEFINER — required because user_preference_cards has self-only RLS.
--   • auth.uid() IS NULL → viewer CTE is empty → all_reviews excludes all rows
--     (rv.user_id != NULL is always NULL/false in WHERE) → (0, 0, 0, 0).
--   • can_view_review() applied to both similar_reviews and all_reviews.
--   • Only aggregate bigint counts returned — no user IDs, card keys, or review content.
--
-- Ver3.1 note: Replace the CTEs between "similarity_v1 begin" and "similarity_v1 end" only.
--
-- DROP required because RETURNS TABLE signature changed (added all_* columns).
DROP FUNCTION IF EXISTS public.get_similar_user_rating_summary(uuid);

CREATE FUNCTION public.get_similar_user_rating_summary(
  p_restaurant_id uuid
)
RETURNS TABLE(
  similar_reviewer_count          bigint,
  high_rating_reviewer_count      bigint,
  all_reviewer_count              bigint,
  all_high_rating_reviewer_count  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH

  viewer AS (
    SELECT auth.uid() AS uid
    WHERE auth.uid() IS NOT NULL
  ),

  -- ── similarity_v1 begin ──────────────────────────────────────────────────
  viewer_cards AS (
    SELECT preference_card_id
    FROM public.user_preference_cards
    WHERE user_id = (SELECT uid FROM viewer)
  ),

  viewer_card_count AS (
    SELECT COUNT(*) AS cnt FROM viewer_cards
  ),

  -- Intersection count between viewer and each other user
  card_intersections AS (
    SELECT
      upc.user_id AS candidate_id,
      COUNT(*)    AS intersection_cnt
    FROM public.user_preference_cards upc
    WHERE upc.preference_card_id IN (SELECT preference_card_id FROM viewer_cards)
      AND upc.user_id != (SELECT uid FROM viewer)
    GROUP BY upc.user_id
  ),

  -- Card count per candidate (only those who appeared in intersections)
  candidate_card_counts AS (
    SELECT user_id, COUNT(*) AS cnt
    FROM public.user_preference_cards
    WHERE user_id IN (SELECT candidate_id FROM card_intersections)
    GROUP BY user_id
  ),

  -- Users who satisfy the Jaccard similarity threshold
  similar_users AS (
    SELECT ci.candidate_id AS user_id
    FROM card_intersections ci
    JOIN candidate_card_counts cc ON cc.user_id = ci.candidate_id
    WHERE (SELECT cnt FROM viewer_card_count) >= 5
      AND cc.cnt >= 5
      AND ci.intersection_cnt >= 3
      AND ci.intersection_cnt::numeric
          / ((SELECT cnt FROM viewer_card_count) + cc.cnt - ci.intersection_cnt) >= 0.40
  ),
  -- ── similarity_v1 end ────────────────────────────────────────────────────

  -- All reviews for this restaurant by others (viewer excluded, visibility-filtered).
  -- When viewer is unauthenticated, (SELECT uid FROM viewer) returns NULL and
  -- "rv.user_id != NULL" evaluates to NULL (false), so all_reviews is empty.
  all_reviews AS (
    SELECT rv.user_id, rv.rating
    FROM public.reviews rv
    WHERE rv.restaurant_id = p_restaurant_id
      AND rv.user_id != (SELECT uid FROM viewer)
      AND public.can_view_review(rv.user_id, rv.restaurant_id)
  ),

  -- Similar users' reviews — a subset of all_reviews
  similar_reviews AS (
    SELECT ar.user_id, ar.rating
    FROM all_reviews ar
    WHERE ar.user_id IN (SELECT user_id FROM similar_users)
  )

  SELECT
    (SELECT COUNT(*)                            FROM similar_reviews) AS similar_reviewer_count,
    (SELECT COUNT(*) FILTER (WHERE rating >= 3) FROM similar_reviews) AS high_rating_reviewer_count,
    (SELECT COUNT(*)                            FROM all_reviews)     AS all_reviewer_count,
    (SELECT COUNT(*) FILTER (WHERE rating >= 3) FROM all_reviews)     AS all_high_rating_reviewer_count
$$;

REVOKE ALL    ON FUNCTION public.get_similar_user_rating_summary(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_similar_user_rating_summary(uuid) TO authenticated;
