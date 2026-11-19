-- get_logbook_visits: cursor-based pagination for logbook list
-- Handles DESC/ASC NULLS LAST ordering with NULL visit_date rows correctly.
-- Cursor encodes (visit_date, created_at, id) of the last seen row.

CREATE OR REPLACE FUNCTION public.get_logbook_visits(
  p_sort        text        DEFAULT 'newest',
  p_rating      integer     DEFAULT NULL,
  p_first_page  boolean     DEFAULT true,
  p_cursor_vd   date        DEFAULT NULL,
  p_cursor_ca   timestamptz DEFAULT NULL,
  p_cursor_id   uuid        DEFAULT NULL,
  p_limit       integer     DEFAULT 20
)
RETURNS TABLE (
  id              uuid,
  restaurant_id   uuid,
  visit_date      date,
  rating          integer,
  comment         text,
  image_path      text,
  reason_keys     text[],
  label_keys      text[],
  created_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid  uuid    := auth.uid();
  _lim  integer := GREATEST(1, LEAST(p_limit, 100));
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  IF p_sort = 'oldest' THEN
    -- ASC NULLS LAST: 2023-01-01 → ... → 2026-11-17 → NULL
    IF p_first_page OR p_cursor_id IS NULL THEN
      RETURN QUERY
        SELECT rv.id, rv.restaurant_id, rv.visit_date, rv.rating, rv.comment,
               rv.image_path, rv.reason_keys, rv.label_keys, rv.created_at
        FROM public.restaurant_visits rv
        WHERE rv.user_id = _uid
          AND (p_rating IS NULL OR rv.rating = p_rating)
        ORDER BY rv.visit_date ASC NULLS LAST, rv.created_at ASC, rv.id ASC
        LIMIT _lim;
    ELSE
      RETURN QUERY
        SELECT rv.id, rv.restaurant_id, rv.visit_date, rv.rating, rv.comment,
               rv.image_path, rv.reason_keys, rv.label_keys, rv.created_at
        FROM public.restaurant_visits rv
        WHERE rv.user_id = _uid
          AND (p_rating IS NULL OR rv.rating = p_rating)
          AND (
            -- cursor is on a dated row: next rows are later dates, or NULLs
            (p_cursor_vd IS NOT NULL AND (
              rv.visit_date > p_cursor_vd
              OR (rv.visit_date = p_cursor_vd AND rv.created_at > p_cursor_ca)
              OR (rv.visit_date = p_cursor_vd AND rv.created_at = p_cursor_ca AND rv.id > p_cursor_id)
              OR rv.visit_date IS NULL
            ))
            -- cursor is on a NULL-date row: next rows are other NULLs with later created_at/id
            OR (p_cursor_vd IS NULL AND rv.visit_date IS NULL AND (
              rv.created_at > p_cursor_ca
              OR (rv.created_at = p_cursor_ca AND rv.id > p_cursor_id)
            ))
          )
        ORDER BY rv.visit_date ASC NULLS LAST, rv.created_at ASC, rv.id ASC
        LIMIT _lim;
    END IF;

  ELSE
    -- newest (default): DESC NULLS LAST: 2026-11-17 → ... → 2023-01-01 → NULL
    IF p_first_page OR p_cursor_id IS NULL THEN
      RETURN QUERY
        SELECT rv.id, rv.restaurant_id, rv.visit_date, rv.rating, rv.comment,
               rv.image_path, rv.reason_keys, rv.label_keys, rv.created_at
        FROM public.restaurant_visits rv
        WHERE rv.user_id = _uid
          AND (p_rating IS NULL OR rv.rating = p_rating)
        ORDER BY rv.visit_date DESC NULLS LAST, rv.created_at DESC, rv.id DESC
        LIMIT _lim;
    ELSE
      RETURN QUERY
        SELECT rv.id, rv.restaurant_id, rv.visit_date, rv.rating, rv.comment,
               rv.image_path, rv.reason_keys, rv.label_keys, rv.created_at
        FROM public.restaurant_visits rv
        WHERE rv.user_id = _uid
          AND (p_rating IS NULL OR rv.rating = p_rating)
          AND (
            -- cursor is on a dated row: next rows are earlier dates, or NULLs
            (p_cursor_vd IS NOT NULL AND (
              rv.visit_date < p_cursor_vd
              OR (rv.visit_date = p_cursor_vd AND rv.created_at < p_cursor_ca)
              OR (rv.visit_date = p_cursor_vd AND rv.created_at = p_cursor_ca AND rv.id < p_cursor_id)
              OR rv.visit_date IS NULL
            ))
            -- cursor is on a NULL-date row: next rows are other NULLs with earlier created_at/id
            OR (p_cursor_vd IS NULL AND rv.visit_date IS NULL AND (
              rv.created_at < p_cursor_ca
              OR (rv.created_at = p_cursor_ca AND rv.id < p_cursor_id)
            ))
          )
        ORDER BY rv.visit_date DESC NULLS LAST, rv.created_at DESC, rv.id DESC
        LIMIT _lim;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_logbook_visits(text, integer, boolean, date, timestamptz, uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_logbook_visits(text, integer, boolean, date, timestamptz, uuid, integer) TO authenticated;
