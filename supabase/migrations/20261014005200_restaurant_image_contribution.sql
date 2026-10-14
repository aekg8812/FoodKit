-- Restaurant Main Image Contribution
--
-- Separates "restaurant metadata edit" permission from "main image edit" permission.
-- Owners continue to manage metadata. Reviewers may upload the first photo for restaurants
-- that have none (seed, google_place, manual). Uploaders may replace/delete their own photo.
--
-- Changes:
--   1. Add main_image_uploaded_by to restaurants
--   2. Backfill from created_by for rows that already have a main image and a known owner
--   3. Expand can_manage_restaurant_image Storage helper (owner OR uploader OR reviewer)
--   4. Add claim / replace / delete SECURITY DEFINER RPCs

-- ── 1. Column ────────────────────────────────────────────────────────────────
alter table public.restaurants
  add column main_image_uploaded_by uuid
    references public.users(id) on delete set null;

-- ── 2. Backfill ──────────────────────────────────────────────────────────────
-- Only rows where both image and owner are known. Seed restaurants (created_by=NULL)
-- with a pre-existing image are intentionally left with uploaded_by=NULL.
update public.restaurants
set main_image_uploaded_by = created_by
where main_image_path is not null
  and created_by is not null;

-- ── 3. Storage write helper ──────────────────────────────────────────────────
-- Expanded to allow: restaurant owner OR current uploader OR any reviewer.
-- Storage INSERT/UPDATE/DELETE policies call this function.
-- The RPCs are the atomic gatekeepers that prevent unauthorised DB writes;
-- Storage permission is intentionally permissive for reviewers so first-upload
-- can Upload-then-Claim without race issues in Storage.
create or replace function public.can_manage_restaurant_image(image_name text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _restaurant_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  begin
    _restaurant_id := split_part(image_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;

  return exists (
    select 1
    from public.restaurants r
    where r.id = _restaurant_id
      and (
        -- restaurant creator (any source)
        r.created_by = auth.uid()
        -- user who uploaded the current main image
        or r.main_image_uploaded_by = auth.uid()
        -- any user who has recorded a review at this restaurant
        or exists (
          select 1
          from public.reviews rv
          where rv.restaurant_id = r.id
            and rv.user_id = auth.uid()
        )
      )
  );
end;
$$;

revoke all   on function public.can_manage_restaurant_image(text) from public;
grant execute on function public.can_manage_restaurant_image(text) to authenticated;

-- ── 4a. RPC: claim_restaurant_main_image ────────────────────────────────────
-- First upload only. Atomically sets main_image_path + main_image_uploaded_by
-- WHERE main_image_path IS NULL, preventing race conditions.
-- Eligible: restaurant owner OR user who has reviewed the restaurant.
-- Returns: { "status": "ok" | "already_claimed" | "not_eligible" | "invalid_path" }
create or replace function public.claim_restaurant_main_image(
  p_restaurant_id uuid,
  p_image_path    text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _uid          uuid := auth.uid();
  _rows_updated int;
begin
  if _uid is null then
    return jsonb_build_object('status', 'not_eligible');
  end if;

  -- Path must be scoped to the target restaurant
  if not starts_with(p_image_path, p_restaurant_id::text || '/') then
    return jsonb_build_object('status', 'invalid_path');
  end if;

  -- Eligibility: owner or reviewer
  if not exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id
      and (
        r.created_by = _uid
        or exists (
          select 1 from public.reviews rv
          where rv.restaurant_id = r.id and rv.user_id = _uid
        )
      )
  ) then
    return jsonb_build_object('status', 'not_eligible');
  end if;

  -- Atomic first-claim: only succeeds when no image exists yet
  update public.restaurants
  set
    main_image_path        = p_image_path,
    main_image_uploaded_by = _uid
  where id              = p_restaurant_id
    and main_image_path is null;

  get diagnostics _rows_updated = row_count;

  if _rows_updated = 0 then
    return jsonb_build_object('status', 'already_claimed');
  end if;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all   on function public.claim_restaurant_main_image(uuid, text) from public;
grant execute on function public.claim_restaurant_main_image(uuid, text) to authenticated;

-- ── 4b. RPC: replace_restaurant_main_image ──────────────────────────────────
-- Replace an existing image. Eligible: restaurant owner OR current uploader.
-- Sets main_image_uploaded_by to the caller (replaces uploader attribution).
-- Returns: { "status": "ok", "old_path": "..." } or error status.
create or replace function public.replace_restaurant_main_image(
  p_restaurant_id uuid,
  p_image_path    text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _uid      uuid := auth.uid();
  _old_path text;
begin
  if _uid is null then
    return jsonb_build_object('status', 'not_eligible');
  end if;

  if not starts_with(p_image_path, p_restaurant_id::text || '/') then
    return jsonb_build_object('status', 'invalid_path');
  end if;

  -- Fetch old path while confirming eligibility in one query
  select main_image_path into _old_path
  from public.restaurants
  where id = p_restaurant_id
    and (created_by = _uid or main_image_uploaded_by = _uid);

  if not found then
    return jsonb_build_object('status', 'not_eligible');
  end if;

  update public.restaurants
  set
    main_image_path        = p_image_path,
    main_image_uploaded_by = _uid
  where id = p_restaurant_id;

  return jsonb_build_object('status', 'ok', 'old_path', _old_path);
end;
$$;

revoke all   on function public.replace_restaurant_main_image(uuid, text) from public;
grant execute on function public.replace_restaurant_main_image(uuid, text) to authenticated;

-- ── 4c. RPC: delete_restaurant_main_image ───────────────────────────────────
-- Delete the current image. Eligible: restaurant owner OR current uploader.
-- Returns: { "status": "ok", "old_path": "..." } or error status.
create or replace function public.delete_restaurant_main_image(
  p_restaurant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _uid      uuid := auth.uid();
  _old_path text;
begin
  if _uid is null then
    return jsonb_build_object('status', 'not_eligible');
  end if;

  select main_image_path into _old_path
  from public.restaurants
  where id = p_restaurant_id
    and (created_by = _uid or main_image_uploaded_by = _uid);

  if not found then
    return jsonb_build_object('status', 'not_eligible');
  end if;

  update public.restaurants
  set
    main_image_path        = null,
    main_image_uploaded_by = null
  where id = p_restaurant_id;

  return jsonb_build_object('status', 'ok', 'old_path', _old_path);
end;
$$;

revoke all   on function public.delete_restaurant_main_image(uuid) from public;
grant execute on function public.delete_restaurant_main_image(uuid) to authenticated;
