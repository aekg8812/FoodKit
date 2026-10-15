-- V3 Phase 4: FoodKit Match v1 RPC
--
-- get_my_foodkit_matches(p_restaurant_ids uuid[])
--
-- Computes FoodKit Match Score between the current user and each restaurant.
-- Algorithm version: match_v1
--
-- Match formula:
--   raw_alignment    = Σ(u_d × r_d) / Σ(|u_d|)
--   user_reliability = Σ(ER_d × |u_d|) / Σ(|u_d|)
--   match_confidence = user_reliability × RR            [RR = match_sample/(match_sample+5)]
--   match_score      = ROUND(GREATEST(0, LEAST(100, 50 + 50 × raw_alignment × match_confidence)))
--
-- Key design decisions:
--
--   Leave-current-user-out: Restaurant match profile excludes the viewer's own
--   reviews from both vote_count and match_sample to prevent self-reinforcement
--   (user votes calm → User Profile calm↑ AND Restaurant Profile calm↑ → both
--   sides of Match score inflated). Do NOT reuse get_restaurant_profiles() here.
--
--   Neutral exclusion: Scoring dimensions require ABS(preference_score) > 0.
--   A true-neutral dimension (score=0) contributes nothing to alignment yet
--   inflates Σ|u_d|, pushing scores toward 50 without information. Excluded.
--
--   Effective reliability (ER_d):
--     source='prior'    → 0.15  (prior counts for 15% of max confidence)
--     source='behavior' or 'blended' → n/(n+3)  (same as user confidence)
--
--   Data states:
--     insufficient  — scoring_dims=0 (no user prefs or restaurant has no other-user reviews)
--     prior_only    — all contributing dims are source='prior'
--     behavior      — at least one dim source IN ('behavior','blended')
--
-- Security: INVOKER — all table RLS applies naturally under the caller's role.

CREATE OR REPLACE FUNCTION public.get_my_foodkit_matches(
  p_restaurant_ids uuid[]
)
RETURNS TABLE (
  restaurant_id             uuid,
  match_score               integer,
  data_state                text,
  match_confidence          numeric,
  raw_alignment             numeric,
  user_reliability          numeric,
  restaurant_reliability    numeric,
  scored_dimension_count    integer,
  positive_contributor_keys text[],
  negative_contributor_keys text[],
  algorithm_version         text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    restaurant_id,
    match_score,
    data_state,
    match_confidence,
    raw_alignment,
    user_reliability,
    restaurant_reliability,
    scored_dimension_count,
    positive_contributor_keys,
    negative_contributor_keys,
    'match_v1'::text AS algorithm_version
  FROM (
    WITH
      -- ── 1. User experience preference profile ──────────────────────────────
      -- Reuse get_my_user_profile() to avoid duplicating aggregation logic.
      -- Filter to scoring dimensions only: experience + ABS(preference_score) > 0.
      user_exp AS (
        SELECT
          signal_key,
          preference_score,
          source,
          confidence,
          -- effective_reliability:
          --   prior → 0.15 (weak signal; prevents score collapsing to 50 for prior-only)
          --   behavior/blended → n/(n+3)  (same as user profile confidence)
          CASE WHEN source = 'prior'
               THEN 0.15::numeric
               ELSE confidence
          END AS effective_reliability
        FROM public.get_my_user_profile()
        WHERE profile_type = 'experience'
          AND preference_score IS NOT NULL
          AND ABS(preference_score) > 0
      ),

      -- ── 2. Restaurant leave-self-out sample size ───────────────────────────
      -- COUNT DISTINCT reviews that have ≥1 label, EXCLUDING the current user.
      -- This is the denominator for selection_rate (RR numerator).
      rest_sample AS (
        SELECT
          rv.restaurant_id,
          COUNT(DISTINCT rv.id)::bigint AS match_sample
        FROM public.reviews rv
        WHERE rv.restaurant_id = ANY(p_restaurant_ids)
          AND rv.user_id != auth.uid()
          AND auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.review_restaurant_labels rrl
            WHERE rrl.review_id = rv.id
          )
        GROUP BY rv.restaurant_id
      ),

      -- ── 3. Restaurant leave-self-out vote counts ───────────────────────────
      -- COUNT DISTINCT reviews per (restaurant, label_key), excluding current user.
      rest_votes AS (
        SELECT
          rv.restaurant_id,
          rrl.label_key,
          COUNT(DISTINCT rv.id)::bigint AS vote_count
        FROM public.reviews rv
        JOIN public.review_restaurant_labels rrl ON rrl.review_id = rv.id
        WHERE rv.restaurant_id = ANY(p_restaurant_ids)
          AND rv.user_id != auth.uid()
          AND auth.uid() IS NOT NULL
        GROUP BY rv.restaurant_id, rrl.label_key
      ),

      -- ── 4. Restaurant match profile (full 12-label matrix, leave-self-out) ─
      -- Scoped to restaurants VISIBLE to the caller via RLS on public.restaurants.
      -- Invisible restaurant IDs produce 0 rows (not an insufficient row).
      -- selection_rate = NULL when match_sample = 0 (no other-user reviews).
      -- RR = match_sample / (match_sample + 5).
      visible_restaurants AS (
        SELECT r.id
        FROM public.restaurants r
        WHERE r.id = ANY(p_restaurant_ids)
      ),

      rest_match_profile AS (
        SELECT
          rr.id                                 AS restaurant_id,
          rl.key                                AS label_key,
          COALESCE(rv.vote_count, 0)            AS vote_count,
          COALESCE(rs.match_sample, 0)          AS match_sample,
          CASE
            WHEN COALESCE(rs.match_sample, 0) = 0 THEN NULL::numeric
            ELSE COALESCE(rv.vote_count, 0)::numeric
                 / rs.match_sample::numeric
          END                                   AS selection_rate,
          COALESCE(rs.match_sample, 0)::numeric
            / (COALESCE(rs.match_sample, 0) + 5)::numeric AS restaurant_reliability
        FROM visible_restaurants rr
        CROSS JOIN public.restaurant_labels rl
        LEFT JOIN rest_sample rs ON rs.restaurant_id = rr.id
        LEFT JOIN rest_votes rv  ON rv.restaurant_id = rr.id
                                 AND rv.label_key = rl.key
      ),

      -- ── 5. Scoring dimensions ──────────────────────────────────────────────
      -- Intersection of user_exp × rest_match_profile.
      -- Requires selection_rate IS NOT NULL (restaurant has other-user reviews).
      -- user_exp already guarantees ABS(preference_score) > 0.
      scoring_dims AS (
        SELECT
          rmp.restaurant_id,
          ue.signal_key,
          ue.preference_score                   AS u_d,
          rmp.selection_rate                    AS r_d,
          rmp.match_sample,
          rmp.restaurant_reliability,
          ue.effective_reliability              AS er_d,
          ue.source
        FROM rest_match_profile rmp
        JOIN user_exp ue ON ue.signal_key = rmp.label_key
        WHERE rmp.selection_rate IS NOT NULL
      ),

      -- ── 6. Per-restaurant aggregation ─────────────────────────────────────
      match_agg AS (
        SELECT
          restaurant_id,
          COUNT(*)::integer                                         AS scored_dimension_count,
          SUM(u_d * r_d)                                           AS numerator,
          SUM(ABS(u_d))                                            AS denominator,
          SUM(er_d * ABS(u_d))                                     AS ur_numerator,
          MAX(restaurant_reliability)                               AS restaurant_reliability,
          BOOL_AND(source = 'prior')                               AS all_prior,
          -- positive contributors: u_d × r_d > 0, ordered by product DESC, top 3
          (ARRAY_AGG(signal_key ORDER BY u_d * r_d DESC)
             FILTER (WHERE u_d * r_d > 0))[1:3]                   AS positive_contributor_keys,
          -- negative contributors: u_d × r_d < 0, ordered by product ASC (most negative first), top 2
          (ARRAY_AGG(signal_key ORDER BY u_d * r_d ASC)
             FILTER (WHERE u_d * r_d < 0))[1:2]                   AS negative_contributor_keys
        FROM scoring_dims
        GROUP BY restaurant_id
      ),

      -- ── 7. Final output: all input restaurants, NULL for missing ───────────
      final AS (
        SELECT
          rr.id AS restaurant_id,

          -- data_state
          CASE
            WHEN ma.restaurant_id IS NULL OR ma.scored_dimension_count = 0
              THEN 'insufficient'::text
            WHEN ma.all_prior
              THEN 'prior_only'::text
            ELSE 'behavior'::text
          END AS data_state,

          -- match_score (NULL when insufficient)
          CASE
            WHEN ma.restaurant_id IS NULL OR ma.scored_dimension_count = 0
              THEN NULL::integer
            ELSE ROUND(
              GREATEST(0::numeric, LEAST(100::numeric,
                50 + 50
                  * (ma.numerator / NULLIF(ma.denominator, 0))
                  * (ma.ur_numerator / NULLIF(ma.denominator, 0))
                  * ma.restaurant_reliability
              ))
            )::integer
          END AS match_score,

          -- raw_alignment
          CASE
            WHEN ma.denominator IS NULL OR ma.denominator = 0 THEN NULL::numeric
            ELSE ROUND(ma.numerator / ma.denominator, 4)
          END AS raw_alignment,

          -- user_reliability
          CASE
            WHEN ma.denominator IS NULL OR ma.denominator = 0 THEN NULL::numeric
            ELSE ROUND(ma.ur_numerator / ma.denominator, 4)
          END AS user_reliability,

          -- match_confidence = user_reliability × RR
          CASE
            WHEN ma.denominator IS NULL OR ma.denominator = 0 THEN NULL::numeric
            ELSE ROUND(
              (ma.ur_numerator / ma.denominator)
                * ma.restaurant_reliability,
              4
            )
          END AS match_confidence,

          COALESCE(ma.restaurant_reliability, 0::numeric)  AS restaurant_reliability,
          COALESCE(ma.scored_dimension_count, 0)           AS scored_dimension_count,
          ma.positive_contributor_keys,
          ma.negative_contributor_keys
        FROM visible_restaurants rr
        LEFT JOIN match_agg ma ON ma.restaurant_id = rr.id
      )

    SELECT
      restaurant_id,
      match_score,
      data_state,
      match_confidence,
      raw_alignment,
      user_reliability,
      restaurant_reliability,
      scored_dimension_count,
      positive_contributor_keys,
      negative_contributor_keys
    FROM final
  ) results
$$;

REVOKE ALL ON FUNCTION public.get_my_foodkit_matches(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_foodkit_matches(uuid[]) TO authenticated;
