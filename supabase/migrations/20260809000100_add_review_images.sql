-- Review images: keep the file in private Storage and only its path on the review.
alter table public.reviews
add column image_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'review-images',
  'review-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Files are stored below the uploader's user id: user_id/review_id/file.ext.
create policy "review_images_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "review_images_select_visible_review"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'review-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.reviews
      where image_path = name
        and visibility = 'group'
        and public.is_group_member(group_id)
    )
  )
);

create policy "review_images_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "review_images_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'review-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
