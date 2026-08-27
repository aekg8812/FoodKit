-- A4: multiple groups and flat group membership

drop policy groups_update_owner on public.groups;

create policy groups_update_member
on public.groups
for update
to authenticated
using (public.is_group_member(id))
with check (public.is_group_member(id));

create or replace function public.is_group_creator(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and g.created_by = auth.uid()
  );
$$;

revoke all on function public.is_group_creator(uuid) from public;
grant execute on function public.is_group_creator(uuid) to authenticated;

drop policy group_members_insert_creator_owner on public.group_members;

create policy group_members_insert_creator
on public.group_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'member'::group_member_role
  and public.is_group_creator(group_id)
);

update public.group_members
set role = 'member'::group_member_role
where role <> 'member'::group_member_role;

alter table public.group_members
alter column role set default 'member'::group_member_role;

comment on column public.group_members.role is
  'V1では未使用。LINE型フラットグループのため全員 member 固定。V2の管理者概念用に列だけ保持。';

drop function public.is_group_owner(uuid);

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.join_group_by_invite_code(input_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
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

create policy group_members_delete_self
on public.group_members
for delete
to authenticated
using (user_id = auth.uid());

grant delete on public.group_members to authenticated;

create policy groups_delete_member
on public.groups
for delete
to authenticated
using (public.is_group_member(id));

grant delete on public.groups to authenticated;

create or replace function public.delete_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not a member of this group';
  end if;

  delete from public.groups
  where id = p_group_id;
end;
$$;

revoke all on function public.delete_group(uuid) from public;
grant execute on function public.delete_group(uuid) to authenticated;
