-- get_group_preference_summary(p_group_id)
-- Returns preference cards selected by valid group members (>= 5 V2 cards),
-- with a count of how many valid members chose each card and the total valid member count.
-- Only returns cards with at least one selection.
-- Auth: caller must be a member of the group.

create or replace function public.get_group_preference_summary(p_group_id uuid)
returns table(
  label                text,
  description          text,
  image_path           text,
  sort_order           integer,
  selected_member_count bigint,
  valid_member_count   bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with
  member_check as (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id  = auth.uid()
      and auth.uid() is not null
  ),
  all_members as (
    select gm.user_id
    from public.group_members gm
    where gm.group_id = p_group_id
      and exists (select 1 from member_check)
  ),
  member_card_counts as (
    select upc.user_id, count(*) as card_count
    from public.user_preference_cards upc
    where upc.user_id in (select user_id from all_members)
    group by upc.user_id
  ),
  valid_members as (
    select user_id from member_card_counts where card_count >= 5
  ),
  vm_count as (
    select count(*) as cnt from valid_members
  ),
  selections as (
    select upc.user_id, upc.preference_card_id
    from public.user_preference_cards upc
    where upc.user_id in (select user_id from valid_members)
  )
  select
    pc.label,
    pc.description,
    pc.image_path,
    pc.sort_order,
    count(distinct s.user_id)      as selected_member_count,
    (select cnt from vm_count)     as valid_member_count
  from public.preference_cards pc
  left join selections s on s.preference_card_id = pc.id
  where pc.is_active = true
    and exists (select 1 from member_check)
  group by pc.id, pc.label, pc.description, pc.image_path, pc.sort_order
  having count(distinct s.user_id) > 0
  order by count(distinct s.user_id) desc, pc.sort_order asc;
$$;

revoke all on function public.get_group_preference_summary(uuid) from public;
grant execute on function public.get_group_preference_summary(uuid) to authenticated;
