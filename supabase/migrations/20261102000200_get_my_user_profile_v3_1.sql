-- V3.1-A Step 2: Update get_my_user_profile() with new preference card mappings
--
-- Adds 8 new card → learning dimension mappings.
-- Existing 7 mappings (solo_friendly, friends_friendly, lively_atmosphere,
-- quiet_atmosphere, hearty_meal, taste_focused, cost_conscious) are unchanged.
--
-- New EXP mappings (6):
--   stylish_space   → stylish
--   casual_vibe     → casual
--   long_stay_ok    → long_stay
--   photogenic_food → photogenic
--   date_friendly   → date
--   large_group_ok  → large_group
--
-- New DF mappings (2):
--   good_service → service
--   easy_access  → access
--
-- Cards with no direct learning dimension (quick_service, local_discovery,
-- good_reputation) remain unmapped — their semantics don't align to any of
-- the 18 learning dimensions and must not be force-mapped.
--
-- Review learning, confidence calculation, and Jaccard similarity are unchanged.

CREATE OR REPLACE FUNCTION public.get_my_user_profile()
RETURNS TABLE (
  profile_type         text,
  signal_key           text,
  signal_name          text,
  category             text,
  sort_order           integer,
  preference_score     numeric,
  importance_score     numeric,
  direction_score      numeric,
  evidence_count       bigint,
  sample_size          bigint,
  confidence           numeric,
  direction_confidence numeric,
  positive_evidence    bigint,
  negative_evidence    bigint,
  source               text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
SELECT
  profile_type,
  signal_key,
  signal_name,
  category,
  sort_order,
  preference_score,
  importance_score,
  direction_score,
  evidence_count,
  sample_size,
  confidence,
  direction_confidence,
  positive_evidence,
  negative_evidence,
  source
FROM (
  WITH
    user_reviews AS (
      SELECT
        rv.id       AS review_id,
        rv.rating,
        CASE rv.rating
          WHEN 1 THEN -1.0
          WHEN 2 THEN -0.5
          WHEN 3 THEN  0.5
          WHEN 4 THEN  1.0
        END::numeric AS signal
      FROM public.reviews rv
      WHERE rv.user_id = auth.uid()
    ),

    user_card_keys AS (
      SELECT pc.key
      FROM public.user_preference_cards upc
      JOIN public.preference_cards pc ON pc.id = upc.preference_card_id
      WHERE upc.user_id = auth.uid()
    ),

    -- Experience Preference Card → label_key + prior_value.
    -- quick_service excluded: 「提供が早い」≠ quick「サクッと利用」(different semantics).
    -- local_discovery, good_reputation: no direct EXP dimension match.
    exp_card_map (card_key, label_key, prior_value) AS (
      VALUES
        ('solo_friendly',    'solo',       1.0::numeric),
        ('friends_friendly', 'friends',    1.0::numeric),
        ('lively_atmosphere','lively',     1.0::numeric),
        ('quiet_atmosphere', 'calm',       1.0::numeric),
        ('hearty_meal',      'hearty',     1.0::numeric),
        ('stylish_space',    'stylish',    1.0::numeric),
        ('casual_vibe',      'casual',     1.0::numeric),
        ('long_stay_ok',     'long_stay',  1.0::numeric),
        ('photogenic_food',  'photogenic', 1.0::numeric),
        ('date_friendly',    'date',       1.0::numeric),
        ('large_group_ok',   'large_group',1.0::numeric)
    ),

    -- Decision Factor Preference Card → reason_key + importance prior.
    -- Direction is NEVER inferred from cards.
    df_card_map (card_key, reason_key, prior_value) AS (
      VALUES
        ('taste_focused',  'taste',   1.0::numeric),
        ('cost_conscious', 'value',   1.0::numeric),
        ('good_service',   'service', 1.0::numeric),
        ('easy_access',    'access',  1.0::numeric)
    ),

    user_exp_priors AS (
      SELECT ecm.label_key, ecm.prior_value
      FROM exp_card_map ecm
      WHERE ecm.card_key IN (SELECT key FROM user_card_keys)
    ),

    user_df_priors AS (
      SELECT dfcm.reason_key, dfcm.prior_value
      FROM df_card_map dfcm
      WHERE dfcm.card_key IN (SELECT key FROM user_card_keys)
    ),

    exp_behavior AS (
      SELECT
        rrl.label_key,
        COUNT(*)::bigint                                         AS evidence_count,
        AVG(ur.signal)                                           AS behavior_score,
        COUNT(*) FILTER (WHERE ur.rating >= 3)::bigint           AS positive_evidence,
        COUNT(*) FILTER (WHERE ur.rating <= 2)::bigint           AS negative_evidence
      FROM public.review_restaurant_labels rrl
      JOIN user_reviews ur ON ur.review_id = rrl.review_id
      GROUP BY rrl.label_key
    ),

    reason_sample_size AS (
      SELECT COUNT(DISTINCT rrt.review_id)::bigint AS m
      FROM public.review_reason_tags rrt
      JOIN user_reviews ur ON ur.review_id = rrt.review_id
    ),

    df_behavior AS (
      SELECT
        rrt.reason_key,
        COUNT(*)::bigint                                         AS factor_count,
        AVG(ur.signal)                                          AS direction_avg,
        COUNT(*) FILTER (WHERE ur.rating >= 3)::bigint           AS positive_evidence,
        COUNT(*) FILTER (WHERE ur.rating <= 2)::bigint           AS negative_evidence
      FROM public.review_reason_tags rrt
      JOIN user_reviews ur ON ur.review_id = rrt.review_id
      GROUP BY rrt.reason_key
    )

  -- ============================================================
  -- EXPERIENCE ROWS (12)
  -- ============================================================
  SELECT
    'experience'::text                                           AS profile_type,
    rl.key                                                       AS signal_key,
    rl.name                                                      AS signal_name,
    rl.category::text                                            AS category,
    rl.sort_order,

    CASE
      WHEN uep.label_key IS NULL AND COALESCE(eb.evidence_count, 0) = 0
        THEN NULL::numeric
      WHEN uep.label_key IS NOT NULL AND COALESCE(eb.evidence_count, 0) = 0
        THEN ROUND(uep.prior_value, 4)
      WHEN uep.label_key IS NULL
        THEN ROUND(eb.behavior_score, 4)
      ELSE
        ROUND(
          (1.0 - COALESCE(eb.evidence_count, 0)::numeric
              / (COALESCE(eb.evidence_count, 0) + 3))
            * uep.prior_value
          + (COALESCE(eb.evidence_count, 0)::numeric
              / (COALESCE(eb.evidence_count, 0) + 3))
            * eb.behavior_score,
          4
        )
    END                                                          AS preference_score,

    NULL::numeric                                                AS importance_score,
    NULL::numeric                                                AS direction_score,

    COALESCE(eb.evidence_count, 0)                              AS evidence_count,
    COALESCE(eb.evidence_count, 0)                              AS sample_size,

    ROUND(COALESCE(eb.evidence_count, 0)::numeric
      / (COALESCE(eb.evidence_count, 0) + 3), 4)               AS confidence,

    NULL::numeric                                                AS direction_confidence,

    COALESCE(eb.positive_evidence, 0)                           AS positive_evidence,
    COALESCE(eb.negative_evidence, 0)                           AS negative_evidence,

    CASE
      WHEN uep.label_key IS NULL AND COALESCE(eb.evidence_count, 0) = 0 THEN 'unknown'::text
      WHEN uep.label_key IS NOT NULL AND COALESCE(eb.evidence_count, 0) = 0 THEN 'prior'::text
      WHEN uep.label_key IS NULL                                           THEN 'behavior'::text
      ELSE 'blended'::text
    END                                                          AS source,

    1                                                            AS _profile_order,
    CASE rl.category
      WHEN 'occasion'   THEN 1
      WHEN 'atmosphere' THEN 2
      WHEN 'experience' THEN 3
      ELSE 4
    END                                                          AS _cat_order

  FROM public.restaurant_labels rl
  LEFT JOIN exp_behavior eb ON eb.label_key = rl.key
  LEFT JOIN user_exp_priors uep ON uep.label_key = rl.key

  UNION ALL

  -- ============================================================
  -- DECISION FACTOR ROWS (6)
  -- ============================================================
  SELECT
    'decision_factor'::text                                      AS profile_type,
    rm.reason_key                                                AS signal_key,
    rm.reason_name                                               AS signal_name,
    NULL::text                                                   AS category,
    rm.reason_sort_order                                         AS sort_order,

    NULL::numeric                                                AS preference_score,

    CASE
      WHEN udp.reason_key IS NULL AND rss.m = 0
        THEN NULL::numeric
      WHEN udp.reason_key IS NOT NULL AND rss.m = 0
        THEN ROUND(udp.prior_value, 4)
      WHEN udp.reason_key IS NULL
        THEN ROUND(COALESCE(dfb.factor_count, 0)::numeric / rss.m, 4)
      ELSE
        ROUND(
          (1.0 - rss.m::numeric / (rss.m + 3))
            * udp.prior_value
          + (rss.m::numeric / (rss.m + 3))
            * (COALESCE(dfb.factor_count, 0)::numeric / rss.m),
          4
        )
    END                                                          AS importance_score,

    CASE
      WHEN COALESCE(dfb.factor_count, 0) = 0 THEN NULL::numeric
      ELSE ROUND(dfb.direction_avg, 4)
    END                                                          AS direction_score,

    COALESCE(dfb.factor_count, 0)                               AS evidence_count,
    rss.m                                                        AS sample_size,

    ROUND(rss.m::numeric / (rss.m + 3), 4)                     AS confidence,

    ROUND(COALESCE(dfb.factor_count, 0)::numeric
      / (COALESCE(dfb.factor_count, 0) + 3), 4)                AS direction_confidence,

    COALESCE(dfb.positive_evidence, 0)                          AS positive_evidence,
    COALESCE(dfb.negative_evidence, 0)                          AS negative_evidence,

    CASE
      WHEN udp.reason_key IS NULL AND rss.m = 0 THEN 'unknown'::text
      WHEN udp.reason_key IS NOT NULL AND rss.m = 0 THEN 'prior'::text
      WHEN udp.reason_key IS NULL                   THEN 'behavior'::text
      ELSE 'blended'::text
    END                                                          AS source,

    2                                                            AS _profile_order,
    4                                                            AS _cat_order

  FROM (
    VALUES
      ('taste',      '味・料理',      1),
      ('value',      'コスパ',        2),
      ('atmosphere', '雰囲気',        3),
      ('service',    'サービス',      4),
      ('volume',     '量・ボリューム', 5),
      ('access',     'アクセス',      6)
  ) AS rm (reason_key, reason_name, reason_sort_order)
  LEFT JOIN df_behavior dfb ON dfb.reason_key = rm.reason_key
  LEFT JOIN user_df_priors udp ON udp.reason_key = rm.reason_key
  CROSS JOIN reason_sample_size rss

) combined
ORDER BY _profile_order, _cat_order, sort_order
$$;

REVOKE ALL ON FUNCTION public.get_my_user_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_user_profile() TO authenticated;
