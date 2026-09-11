create or replace view public.user_public_profiles
with (security_invoker = false) as
select
  id,
  username,
  name,
  onboarding_completed,
  avatar_path,
  updated_at
from public.users;

grant select
on public.user_public_profiles
to authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.user_public_profiles
from authenticated;
