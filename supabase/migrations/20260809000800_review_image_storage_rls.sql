-- Restore review-image visibility after reviews moved to relational visibility.
-- Keep owner-folder access for objects that are not yet linked to a review.

create index if not exists reviews_image_path_idx
on public.reviews (image_path)
where image_path is not null;

create or replace function public.can_view_review_image(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.reviews r
    where r.image_path = p_path
      and public.can_view_review(r.user_id, r.restaurant_id)
  );
$$;

comment on function public.can_view_review_image(text) is
  'Resolves an image path to its review and delegates all visibility decisions to can_view_review.';

revoke all
on function public.can_view_review_image(text)
from public;

grant execute
on function public.can_view_review_image(text)
to authenticated;

drop policy review_images_select_visible_review
on storage.objects;

create policy review_images_select_visible_review
on storage.objects
for select
to authenticated
using (
  bucket_id = 'review-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.can_view_review_image(name)
  )
);
