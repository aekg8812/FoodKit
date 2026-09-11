alter table public.users
add column avatar_path text;

create or replace view public.user_public_profiles
with (security_invoker = false) as
select
  id,
  username,
  name,
  onboarding_completed,
  avatar_path
from public.users;

grant select
on public.user_public_profiles
to authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.user_public_profiles
from authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy avatars_select_all
on storage.objects
for select
to public
using (
  bucket_id = 'avatars'
);

create policy avatars_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy avatars_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
