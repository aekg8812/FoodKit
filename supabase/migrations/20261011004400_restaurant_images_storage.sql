-- restaurant-images: private Storage bucket for Restaurant Main Images.
-- Visibility mirrors restaurant SELECT RLS:
--   - creator (created_by = auth.uid())
--   - seed restaurants (source = 'seed')
--   - restaurants visible via a viewable review
-- Path format: {restaurant_id}/{uuid}.{ext}

-- Create private bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-images',
  'restaurant-images',
  false,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Security-definer function: check whether the requesting user can see
-- the restaurant that owns this Storage object.
-- Mirrors the three restaurant SELECT policies without needing to call them directly.
create or replace function public.can_view_restaurant_image(image_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.restaurants r
    where r.id = (storage.foldername(image_name))[1]::uuid
      and (
        -- creator always sees their own
        r.created_by = auth.uid()
        -- seed restaurants are visible to all authenticated users
        or r.source = 'seed'
        -- any restaurant that has at least one viewable review
        or exists (
          select 1
          from public.reviews rv
          where rv.restaurant_id = r.id
            and public.can_view_review(rv.user_id, rv.restaurant_id)
        )
      )
  )
$$;

revoke all   on function public.can_view_restaurant_image(text) from public;
grant execute on function public.can_view_restaurant_image(text) to authenticated;

-- SELECT: authenticated user can view image if they can view the restaurant
create policy "restaurant image select if restaurant visible"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'restaurant-images'
    and public.can_view_restaurant_image(name)
  );

-- INSERT: only the restaurant creator can upload
create policy "restaurant image insert by creator"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'restaurant-images'
    and exists (
      select 1 from public.restaurants r
      where r.id = (storage.foldername(name))[1]::uuid
        and r.created_by = auth.uid()
    )
  );

-- UPDATE: only the restaurant creator can overwrite
create policy "restaurant image update by creator"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'restaurant-images'
    and exists (
      select 1 from public.restaurants r
      where r.id = (storage.foldername(name))[1]::uuid
        and r.created_by = auth.uid()
    )
  );

-- DELETE: only the restaurant creator can delete
create policy "restaurant image delete by creator"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'restaurant-images'
    and exists (
      select 1 from public.restaurants r
      where r.id = (storage.foldername(name))[1]::uuid
        and r.created_by = auth.uid()
    )
  );
