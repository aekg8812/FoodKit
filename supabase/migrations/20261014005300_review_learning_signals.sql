-- V3 Phase 1: Review Learning Signals
--
-- 1. restaurant_labels   — master table (12 seed rows)
-- 2. review_reason_tags  — per-review evaluation reason votes
-- 3. review_restaurant_labels — per-review restaurant characteristic votes
-- 4. replace_review_learning_signals — atomic replace RPC (authenticated)
-- 5. get_review_learning_signals     — load existing signals for edit UI (authenticated)

-- ── 1. restaurant_labels ────────────────────────────────────────────────────

CREATE TABLE public.restaurant_labels (
  key        text    NOT NULL,
  name       text    NOT NULL,
  category   text    NOT NULL,
  sort_order integer NOT NULL,
  CONSTRAINT restaurant_labels_pkey PRIMARY KEY (key),
  CONSTRAINT restaurant_labels_category_check
    CHECK (category IN ('occasion', 'atmosphere', 'experience'))
);

-- Client cannot write to this master table
ALTER TABLE public.restaurant_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_labels_select_authenticated"
  ON public.restaurant_labels
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed 12 labels
INSERT INTO public.restaurant_labels (key, name, category, sort_order) VALUES
  ('solo',       'ひとり向き',   'occasion',    1),
  ('friends',    '友達向き',     'occasion',    2),
  ('date',       'デート向き',   'occasion',    3),
  ('large_group','大人数向き',   'occasion',    4),
  ('calm',       '落ち着く',     'atmosphere',  1),
  ('lively',     'にぎやか',     'atmosphere',  2),
  ('stylish',    'おしゃれ',     'atmosphere',  3),
  ('casual',     'カジュアル',   'atmosphere',  4),
  ('quick',      'サクッと利用', 'experience',  1),
  ('long_stay',  '長居しやすい', 'experience',  2),
  ('hearty',     'がっつり',     'experience',  3),
  ('photogenic', '写真映え',     'experience',  4);

-- ── 2. review_reason_tags ────────────────────────────────────────────────────

CREATE TABLE public.review_reason_tags (
  review_id  uuid                     NOT NULL,
  reason_key text                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT review_reason_tags_pkey PRIMARY KEY (review_id, reason_key),
  CONSTRAINT review_reason_tags_review_fk
    FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE,
  CONSTRAINT review_reason_tags_key_check
    CHECK (reason_key IN ('taste','value','atmosphere','service','volume','access'))
);

CREATE INDEX review_reason_tags_review_idx ON public.review_reason_tags (review_id);

ALTER TABLE public.review_reason_tags ENABLE ROW LEVEL SECURITY;

-- All signed-in users can read (matches can_view_review semantics: auth.uid() IS NOT NULL)
CREATE POLICY "review_reason_tags_select_authenticated"
  ON public.review_reason_tags
  FOR SELECT
  TO authenticated
  USING (true);

-- No direct client INSERT/DELETE — all writes go through replace_review_learning_signals

-- ── 3. review_restaurant_labels ─────────────────────────────────────────────

CREATE TABLE public.review_restaurant_labels (
  review_id  uuid                     NOT NULL,
  label_key  text                     NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT review_restaurant_labels_pkey PRIMARY KEY (review_id, label_key),
  CONSTRAINT review_restaurant_labels_review_fk
    FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE,
  CONSTRAINT review_restaurant_labels_label_fk
    FOREIGN KEY (label_key) REFERENCES public.restaurant_labels(key)
);

CREATE INDEX review_restaurant_labels_review_idx ON public.review_restaurant_labels (review_id);

ALTER TABLE public.review_restaurant_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_restaurant_labels_select_authenticated"
  ON public.review_restaurant_labels
  FOR SELECT
  TO authenticated
  USING (true);

-- No direct client INSERT/DELETE — all writes go through replace_review_learning_signals

-- ── 4. replace_review_learning_signals ──────────────────────────────────────

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
  _owner_id     uuid;
  _valid_reasons text[] := ARRAY['taste','value','atmosphere','service','volume','access'];
  _rk           text;
  _lk           text;
  _deduped_reasons text[];
  _deduped_labels  text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Verify review ownership
  SELECT user_id INTO _owner_id
  FROM public.reviews
  WHERE id = p_review_id;

  IF _owner_id IS NULL THEN
    RAISE EXCEPTION 'review_not_found';
  END IF;

  IF _owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Normalize: deduplicate and validate reason keys
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

  -- Normalize: deduplicate and validate label keys (max 3)
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

  -- Atomic replace: reason tags
  DELETE FROM public.review_reason_tags WHERE review_id = p_review_id;

  IF array_length(_deduped_reasons, 1) > 0 THEN
    INSERT INTO public.review_reason_tags (review_id, reason_key)
    SELECT p_review_id, rk
    FROM unnest(_deduped_reasons) AS rk;
  END IF;

  -- Atomic replace: restaurant labels
  DELETE FROM public.review_restaurant_labels WHERE review_id = p_review_id;

  IF array_length(_deduped_labels, 1) > 0 THEN
    INSERT INTO public.review_restaurant_labels (review_id, label_key)
    SELECT p_review_id, lk
    FROM unnest(_deduped_labels) AS lk;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_review_learning_signals(uuid, text[], text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.replace_review_learning_signals(uuid, text[], text[])
  TO authenticated;

-- ── 5. get_review_learning_signals ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_review_learning_signals(p_review_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'reason_keys', COALESCE(
      (SELECT jsonb_agg(reason_key ORDER BY reason_key)
       FROM public.review_reason_tags
       WHERE review_id = p_review_id),
      '[]'::jsonb
    ),
    'label_keys', COALESCE(
      (SELECT jsonb_agg(label_key ORDER BY label_key)
       FROM public.review_restaurant_labels
       WHERE review_id = p_review_id),
      '[]'::jsonb
    )
  )
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.reviews
      WHERE id = p_review_id
        AND public.can_view_review(user_id, restaurant_id)
    );
$$;

REVOKE ALL ON FUNCTION public.get_review_learning_signals(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_review_learning_signals(uuid)
  TO authenticated;
