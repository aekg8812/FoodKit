-- Add onboarding_version to users.
-- Existing users default to 1 (V1 grandfather).
-- New signups: handle_new_user trigger sets 2.

alter table public.users
  add column if not exists onboarding_version smallint not null default 1;

-- Recreate handle_new_user to set onboarding_version = 2 for all new signups.
-- Preserves all existing logic (username validation, user_value_profiles insert).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username text;
begin
  v_username := new.raw_user_meta_data->>'username';

  if v_username is null
     or v_username !~ '^[A-Za-z0-9_.-]{3,20}$'
     or public.is_username_reserved(v_username)
     or exists (select 1 from public.users where lower(username) = lower(v_username))
  then
    loop
      v_username := 'user_' || substr(md5(random()::text), 1, 8);
      exit when not exists (
        select 1 from public.users where lower(username) = lower(v_username)
      );
    end loop;
  end if;

  insert into public.users (
    id, email, name, username, value_type,
    onboarding_completed, profile_completion, onboarding_version
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    v_username,
    null,
    false,
    0,
    2
  )
  on conflict (id) do nothing;

  insert into public.user_value_profiles (user_id, main_value_type, scores_json, confidence, profile_completion)
  values (
    new.id,
    null,
    '{"cost":0,"taste":0,"atmosphere":0,"hospitality":0}'::jsonb,
    0,
    0
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;
