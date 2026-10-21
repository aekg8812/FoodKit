-- V3 RC: Completion Marker + Denominator Fix + Column Rename
--
-- 1. review_learning_signal_state — completion marker table
-- 2. Backfill from existing review_reason_tags / review_restaurant_labels
-- 3. replace_review_learning_signals — UPSERT marker in same transaction
-- 4. create_google_restaurant_review — UPSERT marker in same transaction
-- 5. get_restaurant_profiles — new denominator + renamed columns:
--      sample_size    → eligible_review_count (reviews with marker, incl 0-label)
--      selection_rate → raw_share
--      confidence     → evidence_weight
-- 6. get_my_foodkit_matches — new denominator:
--      match_sample   → match_eligible_review_count (marker + not-self)

-- ── 1. review_learning_signal_state ────────────────────────────────────────

CREATE TABLE public.review_learning_signal_state (
  review_id      uuid     NOT NULL,
  schema_version smallint NOT NULL DEFAULT 1,
  CONSTRAINT review_learning_signal_state_pkey
    PRIMARY KEY (review_id),
  CONSTRAINT review_learning_signal_state_review_fk
    FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE
);

ALTER TABLE public.review_learning_signal_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rlss_select_authenticated"
  ON public.review_learning_signal_state
  FOR SELECT
  TO authenticated
  USING (true);

-- ── 2. Backfill ──────────────────────────────────────────────────────────────
-- Backfill markers for reviews that have any existing signal.
-- Reviews with no signals remain legacy no-marker.

INSERT INTO public.review_learning_signal_state (review_id, schema_version)
SELECT DISTINCT rv.id, 1
FROM public.reviews rv
WHERE EXISTS (
  SELECT 1 FROM public.review_reason_tags rrt WHERE rrt.review_id = rv.id
) OR EXISTS (
  SELECT 1 FROM public.review_restaurant_labels rrl WHERE rrl.review_id = rv.id
)
ON CONFLICT (review_id) DO NOTHING;

-- ── 3. replace_review_learning_signals ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.replace_review_learning_signals(
  p_review_id   uuid,
  p_reason_keys text[],
  p_label_keys  text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _owner_id        uuid;
  _valid_reasons   text[] := ARRAY['taste','value','atmosphere','service','volume','access'];
  _rk              text;
  _lk              text;
  _deduped_reasons text[];
  _deduped_labels  text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT user_id INTO _owner_id
  FROM public.reviews
  WHERE id = p_review_id;

  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'review_not_found';
  END IF;

  IF _owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_reason_keys IS NOT NULL AND array_length(p_reason_keys, 1) > 0 THEN
    SELECT array_agg(DISTINCT rk ORDER BY rk)
    INTO _deduped_reasons
    FROM unnest(p_reason_keys) AS rk;

    FOREACH _rk IN ARRAY _deduped_reasons LOOP
      IF NOT (_rk = ANY(_valid_reasons)) THEN
        RAISE EXCEPTION 'invalid_reason_key: %', _rk;
      END IF;
    END LOOP;
  ELSE
    _deduped_reasons := ARRAY[]::text[];
  END IF;

  IF p_label_keys IS NOT NULL AND array_length(p_label_keys, 1) > 0 THEN
    SELECT array_agg(DISTINCT lk ORDER BY lk)
    INTO _deduped_labels
    FROM unnest(p_label_keys) AS lk;

    IF array_length(_deduped_labels, 1) > 3 THEN
      RAISE EXCEPTION 'too_many_labels: maximum 3 allowed';
    END IF;

    FOREACH _lk IN ARRAY _deduped_labels LOOP
      IF NOT EXISTS (SELECT 1 FROM public.restaurant_labels WHERE key = _lk) THEN
        RAISE EXCEPTION 'invalid_label_key: %', _lk;
      END IF;
    END LOOP;
  ELSE
    _deduped_labels := ARRAY[]::text[];
  END IF;

  DELETE FROM public.review_reason_tags WHERE review_id = p_review_id;

  IF array_length(_deduped_reasons, 1) > 0 THEN
    INSERT INTO public.review_reason_tags (review_id, reason_key)
    SELECT p_review_id, rk
    FROM unnest(_deduped_reasons) AS rk;
  END IF;

  DELETE FROM public.review_restaurant_labels WHERE review_id = p_review_id;

  IF array_length(_deduped_labels, 1) > 0 THEN
    INSERT INTO public.review_restaurant_labels (review_id, label_key)
    SELECT p_review_id, lk
    FROM unnest(_deduped_labels) AS lk;
  END IF;

  -- Upsert completion marker (always, even for empty signal submission)
  INSERT INTO public.review_learning_signal_state (review_id, schema_version)
  VALUES (p_review_id, 1)
  ON CONFLICT (review_id) DO UPDATE SET schema_version = EXCLUDED.schema_version;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_review_learning_signals(uuid, text[], text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.replace_review_learning_signals(uuid, text[], text[])
  TO authenticated;

-- ── 4. create_google_restaurant_review ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_google_restaurant_review(
  p_external_place_id text,
  p_user_id           uuid,
  p_rating            integer,
  p_comment           text    DEFAULT NULL,
  p_visit_date        date    DEFAULT NULL,
  p_image_path        text    DEFAULT NULL,
  p_reason_keys       text[]  DEFAULT NULL,
  p_label_keys        text[]  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _restaurant_id   uuid;
  _review_id       uuid;
  _valid_reasons   text[] := ARRAY['taste','value','atmosphere','service','volume','access'];
  _rk              text;
  _lk              text;
  _deduped_reasons text[];
  _deduped_labels  text[];
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

  IF p_reason_keys IS NOT NULL AND array_length(p_reason_keys, 1) > 0 THEN
    SELECT array_agg(DISTINCT rk ORDER BY rk)
    INTO _deduped_reasons
    FROM unnest(p_reason_keys) AS rk;

    FOREACH _rk IN ARRAY _deduped_reasons LOOP
      IF NOT (_rk = ANY(_valid_reasons)) THEN
        RAISE EXCEPTION 'invalid_reason_key: %', _rk;
      END IF;
    END LOOP;
  ELSE
    _deduped_reasons := ARRAY[]::text[];
  END IF;

  IF p_label_keys IS NOT NULL AND array_length(p_label_keys, 1) > 0 THEN
    SELECT array_agg(DISTINCT lk ORDER BY lk)
    INTO _deduped_labels
    FROM unnest(p_label_keys) AS lk;

    IF array_length(_deduped_labels, 1) > 3 THEN
      RAISE EXCEPTION 'too_many_labels: maximum 3 allowed';
    END IF;

    FOREACH _lk IN ARRAY _deduped_labels LOOP
      IF NOT EXISTS (SELECT 1 FROM public.restaurant_labels WHERE key = _lk) THEN
        RAISE EXCEPTION 'invalid_label_key: %', _lk;
      END IF;
    END LOOP;
  ELSE
    _deduped_labels := ARRAY[]::text[];
  END IF;

  SELECT id INTO _restaurant_id
  FROM public.restaurants
  WHERE external_place_id = p_external_place_id
  LIMIT 1;

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

  INSERT INTO public.restaurant_accesses (restaurant_id, user_id, visibility, created_by)
  VALUES (_restaurant_id, p_user_id, 'private', p_user_id)
  ON CONFLICT DO NOTHING;

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

  DELETE FROM public.review_reason_tags WHERE review_id = _review_id;
  IF array_length(_deduped_reasons, 1) > 0 THEN
    INSERT INTO public.review_reason_tags (review_id, reason_key)
    SELECT _review_id, rk FROM unnest(_deduped_reasons) AS rk;
  END IF;

  DELETE FROM public.review_restaurant_labels WHERE review_id = _review_id;
  IF array_length(_deduped_labels, 1) > 0 THEN
    INSERT INTO public.review_restaurant_labels (review_id, label_key)
    SELECT _review_id, lk FROM unnest(_deduped_labels) AS lk;
  END IF;

  -- Upsert completion marker (always, even for empty signal submission)
  INSERT INTO public.review_learning_signal_state (review_id, schema_version)
  VALUES (_review_id, 1)
  ON CONFLICT (review_id) DO UPDATE SET schema_version = EXCLUDED.schema_version;

  RETURN jsonb_build_object(
    'restaurant_id', _restaurant_id,
    'review_id',     _review_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_google_restaurant_review(text, uuid, integer, text, date, text, text[], text[])
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_google_restaurant_review(text, uuid, integer, text, date, text, text[], text[])
  TO service_role;

-- ── 5. get_restaurant_profiles ──────────────────────────────────────────────
-- Return type columns change: DROP required before recreate.

DROP FUNCTION IF EXISTS public.get_restaurant_profiles(uuid[]);

CREATE FUNCTION public.get_restaurant_profiles(
  p_restaurant_ids uuid[]
)
RETURNS TABLE (
  restaurant_id         uuid,
  label_key             text,
  label_name            text,
  category              text,
  sort_order            integer,
  vote_count            bigint,
  eligible_review_count bigint,
  raw_share             numeric,
  evidence_weight       numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH
    visible_restaurants AS (
      SELECT r.id AS restaurant_id
      FROM public.restaurants r
      WHERE r.id = ANY (
        SELECT DISTINCT rid
        FROM unnest(p_restaurant_ids) AS rid
        WHERE rid IS NOT NULL
      )
    ),

    target_reviews AS (
      SELECT rv.id AS review_id, rv.restaurant_id
      FROM public.reviews rv
      WHERE rv.restaurant_id IN (SELECT restaurant_id FROM visible_restaurants)
    ),

    -- Eligible reviews: completion marker present AND viewer-visible.
    -- Includes 0-label reviews in the denominator.
    eligible_reviews AS (
      SELECT tr.review_id, tr.restaurant_id
      FROM target_reviews tr
      JOIN public.review_learning_signal_state rlss ON rlss.review_id = tr.review_id
    ),

    eligible AS (
      SELECT restaurant_id,
             COUNT(*) AS eligible_review_count
      FROM eligible_reviews
      GROUP BY restaurant_id
    ),

    -- vote_count per (restaurant, label): only from eligible reviews.
    votes AS (
      SELECT er.restaurant_id,
             rrl.label_key,
             COUNT(DISTINCT rrl.review_id) AS vote_count
      FROM public.review_restaurant_labels rrl
      JOIN eligible_reviews er ON er.review_id = rrl.review_id
      GROUP BY er.restaurant_id, rrl.label_key
    )

  SELECT
    vr.restaurant_id,
    rl.key                                                            AS label_key,
    rl.name                                                           AS label_name,
    rl.category,
    rl.sort_order,
    COALESCE(v.vote_count, 0)                                         AS vote_count,
    COALESCE(e.eligible_review_count, 0)                              AS eligible_review_count,
    CASE
      WHEN COALESCE(e.eligible_review_count, 0) = 0 THEN NULL
      ELSE ROUND(
        COALESCE(v.vote_count, 0)::numeric / e.eligible_review_count,
        4
      )
    END                                                               AS raw_share,
    ROUND(
      COALESCE(e.eligible_review_count, 0)::numeric
        / (COALESCE(e.eligible_review_count, 0) + 5),
      4
    )                                                                 AS evidence_weight

  FROM visible_restaurants vr
  CROSS JOIN public.restaurant_labels rl
  LEFT JOIN votes v
    ON v.restaurant_id = vr.restaurant_id
   AND v.label_key     = rl.key
  LEFT JOIN eligible e
    ON e.restaurant_id = vr.restaurant_id

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

-- ── 6. get_my_foodkit_matches ────────────────────────────────────────────────
-- Denominator: reviews with completion marker, excluding current user.

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
      user_exp AS (
        SELECT
          signal_key,
          preference_score,
          source,
          CASE WHEN source = 'prior'
               THEN 0.15::numeric
               ELSE confidence
          END AS effective_reliability
        FROM public.get_my_user_profile()
        WHERE profile_type = 'experience'
          AND preference_score IS NOT NULL
          AND ABS(preference_score) > 0
      ),

      -- Eligible other-user reviews: have completion marker, exclude current user.
      rest_sample AS (
        SELECT
          rv.restaurant_id,
          COUNT(DISTINCT rv.id)::bigint AS match_eligible_review_count
        FROM public.reviews rv
        JOIN public.review_learning_signal_state rlss ON rlss.review_id = rv.id
        WHERE rv.restaurant_id = ANY(p_restaurant_ids)
          AND rv.user_id != auth.uid()
          AND auth.uid() IS NOT NULL
        GROUP BY rv.restaurant_id
      ),

      -- Vote counts from eligible other-user reviews only.
      rest_votes AS (
        SELECT
          rv.restaurant_id,
          rrl.label_key,
          COUNT(DISTINCT rv.id)::bigint AS vote_count
        FROM public.reviews rv
        JOIN public.review_learning_signal_state rlss ON rlss.review_id = rv.id
        JOIN public.review_restaurant_labels rrl ON rrl.review_id = rv.id
        WHERE rv.restaurant_id = ANY(p_restaurant_ids)
          AND rv.user_id != auth.uid()
          AND auth.uid() IS NOT NULL
        GROUP BY rv.restaurant_id, rrl.label_key
      ),

      visible_restaurants AS (
        SELECT r.id
        FROM public.restaurants r
        WHERE r.id = ANY(p_restaurant_ids)
      ),

      rest_match_profile AS (
        SELECT
          rr.id                                                         AS restaurant_id,
          rl.key                                                        AS label_key,
          COALESCE(rv.vote_count, 0)                                    AS vote_count,
          COALESCE(rs.match_eligible_review_count, 0)                   AS match_eligible_review_count,
          CASE
            WHEN COALESCE(rs.match_eligible_review_count, 0) = 0 THEN NULL::numeric
            ELSE COALESCE(rv.vote_count, 0)::numeric
                 / rs.match_eligible_review_count::numeric
          END                                                           AS selection_rate,
          COALESCE(rs.match_eligible_review_count, 0)::numeric
            / (COALESCE(rs.match_eligible_review_count, 0) + 5)::numeric AS restaurant_reliability
        FROM visible_restaurants rr
        CROSS JOIN public.restaurant_labels rl
        LEFT JOIN rest_sample rs ON rs.restaurant_id = rr.id
        LEFT JOIN rest_votes rv  ON rv.restaurant_id = rr.id
                                 AND rv.label_key = rl.key
      ),

      scoring_dims AS (
        SELECT
          rmp.restaurant_id,
          ue.signal_key,
          ue.preference_score                   AS u_d,
          rmp.selection_rate                    AS r_d,
          rmp.match_eligible_review_count,
          rmp.restaurant_reliability,
          ue.effective_reliability              AS er_d,
          ue.source
        FROM rest_match_profile rmp
        JOIN user_exp ue ON ue.signal_key = rmp.label_key
        WHERE rmp.selection_rate IS NOT NULL
      ),

      match_agg AS (
        SELECT
          restaurant_id,
          COUNT(*)::integer                                         AS scored_dimension_count,
          SUM(u_d * r_d)                                           AS numerator,
          SUM(ABS(u_d))                                            AS denominator,
          SUM(er_d * ABS(u_d))                                     AS ur_numerator,
          MAX(restaurant_reliability)                               AS restaurant_reliability,
          BOOL_AND(source = 'prior')                               AS all_prior,
          (ARRAY_AGG(signal_key ORDER BY u_d * r_d DESC)
             FILTER (WHERE u_d * r_d > 0))[1:3]                   AS positive_contributor_keys,
          (ARRAY_AGG(signal_key ORDER BY u_d * r_d ASC)
             FILTER (WHERE u_d * r_d < 0))[1:2]                   AS negative_contributor_keys
        FROM scoring_dims
        GROUP BY restaurant_id
      ),

      final AS (
        SELECT
          rr.id AS restaurant_id,

          CASE
            WHEN ma.restaurant_id IS NULL OR ma.scored_dimension_count = 0
              THEN 'insufficient'::text
            WHEN ma.all_prior
              THEN 'prior_only'::text
            ELSE 'behavior'::text
          END AS data_state,

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

          CASE
            WHEN ma.denominator IS NULL OR ma.denominator = 0 THEN NULL::numeric
            ELSE ROUND(ma.numerator / ma.denominator, 4)
          END AS raw_alignment,

          CASE
            WHEN ma.denominator IS NULL OR ma.denominator = 0 THEN NULL::numeric
            ELSE ROUND(ma.ur_numerator / ma.denominator, 4)
          END AS user_reliability,

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
