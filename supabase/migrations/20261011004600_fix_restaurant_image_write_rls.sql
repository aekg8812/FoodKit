-- Fix: Storage INSERT/UPDATE/DELETE policies for restaurant-images used `r.name`
-- (restaurants.name display column) instead of the storage object path.
-- Replace inline EXISTS checks with a security-definer function to match the
-- SELECT policy pattern and avoid column reference ambiguity.

-- ── Security-definer helper ─────────────────────────────────────────────────
create or replace function public.can_manage_restaurant_image(image_name text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _restaurant_id uuid;
begin
  -- Reject unauthenticated callers early
  if auth.uid() is null then
    return false;
  end if;

  -- Extract restaurant_id from first path segment, guard malformed input
  begin
    _restaurant_id := split_part(image_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;

  -- Only the restaurant creator may write images.
  -- created_by=NULL (seed restaurants) → no match → false.
  return exists (
    select 1
    from public.restaurants r
    where r.id = _restaurant_id
      and r.created_by = auth.uid()
  );
end;
$$;

revoke all on function public.can_manage_restaurant_image(text) from public;
grant execute on function public.can_manage_restaurant_image(text) to authenticated;

-- ── Replace broken Storage write policies ──────────────────────────────────
drop policy if exists "restaurant image insert by creator" on storage.objects;
drop policy if exists "restaurant image update by creator" on storage.objects;
drop policy if exists "restaurant image delete by creator" on storage.objects;

create policy "restaurant image insert by creator"
  on storage.objects for insert
  with check (
    bucket_id = 'restaurant-images'
    and public.can_manage_restaurant_image(name)
  );

create policy "restaurant image update by creator"
  on storage.objects for update
  using (
    bucket_id = 'restaurant-images'
    and public.can_manage_restaurant_image(name)
  );

create policy "restaurant image delete by creator"
  on storage.objects for delete
  using (
    bucket_id = 'restaurant-images'
    and public.can_manage_restaurant_image(name)
  );
