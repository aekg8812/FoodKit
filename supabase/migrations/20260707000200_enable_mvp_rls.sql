create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
      and role = 'owner'
  )
  or exists (
    select 1
    from public.groups
    where id = target_group_id
      and created_by = auth.uid()
  );
$$;

create or replace function public.is_restaurant_creator(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurants
    where id = target_restaurant_id
      and created_by = auth.uid()
  );
$$;

create or replace function public.join_group_by_invite_code(input_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Authentication is required to join a group.';
  end if;

  select id
  into target_group_id
  from public.groups
  where invite_code = input_invite_code;

  if target_group_id is null then
    raise exception 'Invalid invite code.';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group_id, current_user_id, 'member')
  on conflict (group_id, user_id) do nothing;

  return target_group_id;
end;
$$;

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_owner(uuid) from public;
revoke all on function public.is_restaurant_creator(uuid) from public;
revoke all on function public.join_group_by_invite_code(text) from public;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
grant execute on function public.is_restaurant_creator(uuid) to authenticated;
grant execute on function public.join_group_by_invite_code(text) to authenticated;

alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.restaurants enable row level security;
alter table public.restaurant_accesses enable row level security;
alter table public.reviews enable row level security;
alter table public.user_value_profiles enable row level security;
alter table public.value_questions enable row level security;
alter table public.value_options enable row level security;
alter table public.user_value_answers enable row level security;

-- MVP allows group members to read each other's user rows.
-- Because email is included on public.users, consider a public profile view before wider release.
create policy "users_select_own_or_same_group"
on public.users
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.group_members own_membership
    join public.group_members target_membership
      on target_membership.group_id = own_membership.group_id
    where own_membership.user_id = auth.uid()
      and target_membership.user_id = public.users.id
  )
);

create policy "users_insert_own"
on public.users
for insert
to authenticated
with check (id = auth.uid());

create policy "users_update_own"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "groups_select_member"
on public.groups
for select
to authenticated
using (
  created_by = auth.uid()
  or public.is_group_member(id)
);

create policy "groups_insert_creator"
on public.groups
for insert
to authenticated
with check (created_by = auth.uid());

create policy "groups_update_owner"
on public.groups
for update
to authenticated
using (public.is_group_owner(id))
with check (public.is_group_owner(id));

create policy "group_members_select_same_group"
on public.group_members
for select
to authenticated
using (public.is_group_member(group_id));

create policy "group_members_insert_creator_owner"
on public.group_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and public.is_group_owner(group_id)
);

create policy "restaurants_select_group_visible"
on public.restaurants
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.restaurant_accesses
    where restaurant_id = public.restaurants.id
      and visibility = 'group'
      and public.is_group_member(group_id)
  )
);

create policy "restaurants_insert_creator"
on public.restaurants
for insert
to authenticated
with check (created_by = auth.uid());

create policy "restaurants_update_creator"
on public.restaurants
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "restaurant_accesses_select_group_visible"
on public.restaurant_accesses
for select
to authenticated
using (
  visibility = 'group'
  and public.is_group_member(group_id)
);

create policy "restaurant_accesses_insert_creator_group"
on public.restaurant_accesses
for insert
to authenticated
with check (
  created_by = auth.uid()
  and visibility = 'group'
  and public.is_group_member(group_id)
  and public.is_restaurant_creator(restaurant_id)
);

create policy "reviews_select_group_visible"
on public.reviews
for select
to authenticated
using (
  visibility = 'group'
  and public.is_group_member(group_id)
);

create policy "reviews_insert_own_group_visible"
on public.reviews
for insert
to authenticated
with check (
  user_id = auth.uid()
  and visibility = 'group'
  and public.is_group_member(group_id)
  and rating between 1 and 4
  and exists (
    select 1
    from public.restaurant_accesses
    where restaurant_id = public.reviews.restaurant_id
      and group_id = public.reviews.group_id
      and visibility = 'group'
  )
);

create policy "reviews_update_own"
on public.reviews
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and visibility = 'group'
  and public.is_group_member(group_id)
  and rating between 1 and 4
  and exists (
    select 1
    from public.restaurant_accesses
    where restaurant_id = public.reviews.restaurant_id
      and group_id = public.reviews.group_id
      and visibility = 'group'
  )
);

create policy "reviews_delete_own"
on public.reviews
for delete
to authenticated
using (user_id = auth.uid());

create policy "user_value_profiles_select_own_or_same_group"
on public.user_value_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.group_members own_membership
    join public.group_members target_membership
      on target_membership.group_id = own_membership.group_id
    where own_membership.user_id = auth.uid()
      and target_membership.user_id = public.user_value_profiles.user_id
  )
);

create policy "user_value_profiles_insert_own"
on public.user_value_profiles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "user_value_profiles_update_own"
on public.user_value_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "value_questions_select_authenticated"
on public.value_questions
for select
to authenticated
using (auth.uid() is not null);

create policy "value_options_select_authenticated"
on public.value_options
for select
to authenticated
using (auth.uid() is not null);

create policy "user_value_answers_select_own"
on public.user_value_answers
for select
to authenticated
using (user_id = auth.uid());

create policy "user_value_answers_insert_own"
on public.user_value_answers
for insert
to authenticated
with check (user_id = auth.uid());

create policy "user_value_answers_update_own"
on public.user_value_answers
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
